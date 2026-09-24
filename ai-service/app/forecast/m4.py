"""M4-R2 — ensemble sản xuất (exp_005/007/008): trung bình (M1 + 2*GBM)/3, trong
đó phần GBM (M2a XGBoost + M2b LightGBM, T1) được ĐỊNH TUYẾN THEO VÙNG bằng
cấu hình chọn trên cửa sổ VALIDATION (exp_007, exp_008):

  Bắc  : scale-aware (V3, dự báo tỉ lệ so với quy mô tỉnh) + objective Tweedie
  Trung: GBM T1 chuẩn (Poisson, đặc trưng T1)
  Nam  : GBM T1 chuẩn, pha 50% với Climatology (B3)

Ghi chú trung thực: gain của Bắc-Tweedie (−44% trên validation) KHÔNG tái lập
ở outer (1.429 vs 1.416); gain của Nam-blend B3 tái lập (−10%). Xem
experiments/exp_008_outbreak_north/RESULTS.md.

`predict_m4_many` fit MỘT lần rồi dự báo cho nhiều bản đầu vào (vd đầu vào bị
nhiễu/khuyết cho kiểm định độ vững, exp_010) — `predict_m4` = trường hợp 1 bản.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.forecast.backtest import FEATURE_COLS_T1, TARGET
from app.forecast.models import (
    SCALE_AWARE_CASE_COLS,
    fit_predict_m1_glm_negbin,
    fit_predict_m2_lightgbm,
    fit_predict_m2_xgboost,
    fit_predict_scale_aware,
)

NONCASE_COLS = [c for c in FEATURE_COLS_T1 if c not in SCALE_AWARE_CASE_COLS]
SCALE_COLS = ["prov_mean_hist", "prov_mean_12m"]
B3_BLEND_WEIGHT = 0.5
TWEEDIE_POWER = 1.5

# vùng -> (dùng V3 scale-aware + tweedie?, pha B3?)
ROUTING = {
    "Bắc": {"scale_aware_tweedie": True, "blend_b3": False},
    "Trung": {"scale_aware_tweedie": False, "blend_b3": False},
    "Nam": {"scale_aware_tweedie": False, "blend_b3": True},
}


def climatology_forecast(
    hist: pd.DataFrame, target_month: pd.Timestamp
) -> dict[str, float]:
    """B3: trung bình lịch sử (tới train_end) của đúng tháng dương lịch, theo tỉnh."""
    sub = hist[hist["month"].dt.month == target_month.month]
    return sub.groupby("province_id")[TARGET].mean().to_dict()


def assemble_m4(
    m1_preds: dict[str, float],
    gbm_std: dict[str, float],
    gbm_v3_tweedie: dict[str, float],
    b3: dict[str, float],
    regions: dict[str, str],
    routing: dict[str, dict] | None = None,
) -> dict[str, float]:
    """Ghép dự báo từng tỉnh theo `routing`; sau đó (M1 + 2*GBM)/3, thiếu M1
    thì chỉ GBM. Hàm thuần — kiểm thử được không cần fit model."""
    routing = ROUTING if routing is None else routing
    out = {}
    for p, std_pred in gbm_std.items():
        cfg = routing.get(regions.get(p), {})
        gbm = std_pred
        if cfg.get("scale_aware_tweedie"):
            gbm = gbm_v3_tweedie.get(p, std_pred)
        if cfg.get("blend_b3") and p in b3:
            gbm = (1 - B3_BLEND_WEIGHT) * gbm + B3_BLEND_WEIGHT * b3[p]
        m1 = m1_preds.get(p)
        out[p] = float(gbm if m1 is None or np.isnan(m1) else (m1 + 2 * gbm) / 3)
    return out


def _gbm_avg_array(fn_kwargs, train_pairs, test_rows, scale_aware: bool) -> np.ndarray:
    preds = []
    for fn, kw in fn_kwargs:
        if scale_aware:
            arr = fit_predict_scale_aware(
                fn,
                train_pairs,
                test_rows,
                NONCASE_COLS,
                case_cols=SCALE_AWARE_CASE_COLS,
                extra_cols=SCALE_COLS,
                **kw,
            )
        else:
            arr = fn(
                train_pairs, test_rows, FEATURE_COLS_T1, target_col="y_target", **kw
            )
        preds.append(np.asarray(arr, dtype=float))
    return np.mean(preds, axis=0)


def _m1_array(train_pairs: pd.DataFrame, test_rows: pd.DataFrame) -> np.ndarray:
    """M1 cho từng dòng test; NaN nếu M1 lỗi hội tụ, hoặc nếu dòng đó thiếu
    bất kỳ đặc trưng nào (M1 tuyến tính không xử lý NaN — khi đầu vào khuyết
    thì M4 tự lùi về phần GBM cho dòng đó, xem `assemble_m4`)."""
    out = np.full(len(test_rows), np.nan)
    complete = test_rows[FEATURE_COLS_T1 + ["population_target"]].notna().all(axis=1)
    if not complete.any():
        return out
    m1_train = train_pairs.drop(columns=["population"]).rename(
        columns={"cases_target": "_m1_target", "population_target": "population"}
    )
    m1_test = (
        test_rows[complete.to_numpy()]
        .drop(columns=["population"])
        .rename(columns={"population_target": "population"})
    )
    try:
        pred = fit_predict_m1_glm_negbin(
            m1_train, m1_test, FEATURE_COLS_T1, target_col="_m1_target"
        )
        out[complete.to_numpy()] = np.asarray(pred, dtype=float)
    except Exception as exc:  # noqa: BLE001 - M1 co the loi hoi tu (exp_002)
        print(f"  M1 lỗi (bỏ M1 ở fold này): {exc}")
    return out


def _fit_components(
    train_pairs: pd.DataFrame, stacked: pd.DataFrame
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Fit MỖI model đúng 1 lần, dự báo trên các dòng test xếp chồng: (M1, GBM chuẩn,
    GBM scale-aware+Tweedie). Tách riêng để nhiều cấu hình định tuyến dùng chung
    các lần fit (exp_016: ablation định tuyến qua nhiều mùa)."""
    m1 = _m1_array(train_pairs, stacked)
    std = _gbm_avg_array(
        [(fit_predict_m2_xgboost, {}), (fit_predict_m2_lightgbm, {})],
        train_pairs,
        stacked,
        scale_aware=False,
    )
    tw = {"params": {"tweedie_variance_power": TWEEDIE_POWER}}
    v3 = _gbm_avg_array(
        [
            (fit_predict_m2_xgboost, {"objective": "reg:tweedie", **tw}),
            (fit_predict_m2_lightgbm, {"objective": "tweedie", **tw}),
        ],
        train_pairs,
        stacked,
        scale_aware=True,
    )
    return m1, std, v3


def _split_and_assemble(
    stacked, sizes, m1, std, v3, b3, regions, routing
) -> list[dict[str, float]]:
    results = []
    start = 0
    for size in sizes:
        sl = slice(start, start + size)
        start += size
        ids = stacked["province_id"].iloc[sl].tolist()
        results.append(
            assemble_m4(
                dict(zip(ids, m1[sl].tolist())),
                dict(zip(ids, std[sl].tolist())),
                dict(zip(ids, v3[sl].tolist())),
                b3,
                regions,
                routing,
            )
        )
    return results


def predict_m4_many(
    train_pairs: pd.DataFrame,
    test_frames: list[pd.DataFrame],
    hist_panel: pd.DataFrame,
    target_month: pd.Timestamp,
    regions: dict[str, str],
) -> list[dict[str, float]]:
    """Dự báo M4-R2 cho NHIỀU bản `test_rows` (cùng train_pairs): fit mỗi model
    đúng 1 lần trên `train_pairs`, dự báo trên các dòng test xếp chồng, rồi
    tách lại theo từng bản. Mỗi bản: mỗi tỉnh đúng 1 dòng (như `test_rows`).
    `hist_panel` = dữ liệu ≤ train_end (tính B3)."""
    sizes = [len(f) for f in test_frames]
    stacked = pd.concat(test_frames, ignore_index=True)
    m1, std, v3 = _fit_components(train_pairs, stacked)
    b3 = climatology_forecast(hist_panel, target_month)
    return _split_and_assemble(stacked, sizes, m1, std, v3, b3, regions, None)


def predict_m4_routings(
    train_pairs: pd.DataFrame,
    test_rows: pd.DataFrame,
    hist_panel: pd.DataFrame,
    target_month: pd.Timestamp,
    regions: dict[str, str],
    routings: dict[str, dict[str, dict] | None],
) -> dict[str, dict[str, float]]:
    """Dự báo cho NHIỀU cấu hình định tuyến vùng, fit chỉ 1 lần: {tên: {tỉnh: dự
    báo}}. `routings[tên]=None` → ROUTING mặc định (M4-R2); `{}` → không định
    tuyến (GBM chuẩn cho mọi vùng = M4 ensemble đồng đều, exp_005)."""
    m1, std, v3 = _fit_components(train_pairs, test_rows.reset_index(drop=True))
    b3 = climatology_forecast(hist_panel, target_month)
    stacked = test_rows.reset_index(drop=True)
    return {
        name: _split_and_assemble(
            stacked, [len(stacked)], m1, std, v3, b3, regions, routing
        )[0]
        for name, routing in routings.items()
    }


def predict_m4(
    train_pairs: pd.DataFrame,
    test_rows: pd.DataFrame,
    hist_panel: pd.DataFrame,
    target_month: pd.Timestamp,
    regions: dict[str, str],
) -> dict[str, float]:
    """Dự báo M4-R2 cho 1 (origin, horizon). `train_pairs`/`test_rows` theo
    `backtest.build_horizon_pairs` (đặc trưng neo tại origin)."""
    return predict_m4_many(train_pairs, [test_rows], hist_panel, target_month, regions)[
        0
    ]
