"""M4-R2 — ensemble sản xuất (exp_005/007/008): trung bình (M1 + 2*GBM)/3, trong
đó phần GBM (M2a XGBoost + M2b LightGBM, T1) được ĐỊNH TUYẾN THEO VÙNG bằng
cấu hình chọn trên cửa sổ VALIDATION (exp_007, exp_008):

  Bắc  : scale-aware (V3, dự báo tỉ lệ so với quy mô tỉnh) + objective Tweedie
  Trung: GBM T1 chuẩn (Poisson, đặc trưng T1)
  Nam  : GBM T1 chuẩn, pha 50% với Climatology (B3)

Ghi chú trung thực: gain của Bắc-Tweedie (−44% trên validation) KHÔNG tái lập
ở outer (1.429 vs 1.416); gain của Nam-blend B3 tái lập (−10%). Xem
experiments/exp_008_outbreak_north/RESULTS.md.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.forecast.backtest import (
    FEATURE_COLS_T1,
    TARGET,
    get_member_predictions,
)
from app.forecast.models import (
    SCALE_AWARE_CASE_COLS,
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


def _gbm_avg(fn_kwargs, train_pairs, test_rows, scale_aware: bool) -> dict[str, float]:
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
    mean = np.mean(preds, axis=0)
    return dict(zip(test_rows["province_id"], mean.tolist()))


def predict_m4(
    train_pairs: pd.DataFrame,
    test_rows: pd.DataFrame,
    hist_panel: pd.DataFrame,
    target_month: pd.Timestamp,
    regions: dict[str, str],
) -> dict[str, float]:
    """Dự báo M4-R2 cho 1 (origin, horizon). `train_pairs`/`test_rows` theo
    `backtest.build_horizon_pairs` (đặc trưng neo tại origin); `hist_panel` =
    dữ liệu ≤ train_end (tính B3). M1 lỗi hội tụ thì bỏ M1 ở fold đó."""
    m1 = get_member_predictions(train_pairs, test_rows, members=("M1_glm_negbin",))
    std = _gbm_avg(
        [(fit_predict_m2_xgboost, {}), (fit_predict_m2_lightgbm, {})],
        train_pairs,
        test_rows,
        scale_aware=False,
    )
    tw = {"params": {"tweedie_variance_power": TWEEDIE_POWER}}
    v3 = _gbm_avg(
        [
            (fit_predict_m2_xgboost, {"objective": "reg:tweedie", **tw}),
            (fit_predict_m2_lightgbm, {"objective": "tweedie", **tw}),
        ],
        train_pairs,
        test_rows,
        scale_aware=True,
    )
    return assemble_m4(
        m1.get("M1_glm_negbin", {}),
        std,
        v3,
        climatology_forecast(hist_panel, target_month),
        regions,
    )
