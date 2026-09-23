"""exp_002 — Model zoo Tier 1, T1 (cấu hình mặc định): M1 GLM NegBin (hiệu
ứng cố định theo tỉnh), M2a XGBoost, M2b LightGBM. Xem config.yaml cho tham
số, RESULTS.md cho kết quả + diễn giải, so với exp_001 (B2/B3 baseline).

Chạy: python experiments/exp_002_model_zoo_tier1/run.py   (từ ai-service/)

Cùng giao thức real-only rolling-origin như exp_001 để so sánh công bằng.

⚠️ BẪY ĐÃ GẶP THẬT VÀ ĐÃ SỬA (xem RESULTS.md "Điều bất ngờ"): `features.py`
sinh lag/momentum/... GẮN VỚI THÁNG CỦA CHÍNH DÒNG ĐÓ (đúng cho mục đích
nhân quả nói chung), nhưng lấy thẳng feature của dòng tại `target_month`
(=train_end+h) để dự báo sẽ khiến lag ngắn (vd lag_2) đọc dữ liệu SAU
`train_end` khi h>=3 — rò rỉ tương lai thật sự (h=6: lag_2 đọc dữ liệu
4 tháng SAU train_end). Đây là bug "direct multi-horizon" kinh điển khi
ghép trực tiếp features tự tham chiếu vào dòng test mà không neo theo
origin. Cách sửa: ghép cặp (X tại `t`, y THẬT tại `t+h`) cho MỌI origin
lịch sử (train) và cho chính origin đang xét (test) — feature LUÔN được
đọc tại đúng 1 mốc `train_end`/`t`, không bao giờ đọc xa hơn `t`.
"""

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import pandas as pd

from app.forecast.features import build_feature_matrix
from app.forecast.metrics import mae, mase
from app.forecast.models import (
    fit_predict_m1_glm_negbin,
    fit_predict_m2_lightgbm,
    fit_predict_m2_xgboost,
)
from app.forecast.splits import assert_test_is_real_only, make_splits

TARGET = "incidence_per_100k"
HORIZONS = (1, 2, 3, 6)
N_ORIGINS = 8
EMBARGO_MONTHS = 1
REPORTING_DELAY_MONTHS = 1

FEATURE_COLS = [
    "sin_month",
    "cos_month",
    "temp_mean_lag_1",
    "temp_mean_lag_2",
    "precip_total_lag_1",
    "precip_total_lag_2",
    "humidity_mean_lag_1",
    "temp_mean_roll_mean_3",
    "precip_total_roll_mean_3",
    "incidence_per_100k_lag_2",
    "incidence_per_100k_lag_3",
    "momentum",
    "acceleration",
    "oni_lag_3",
    "oni_lag_6",
    "incidence_per_100k_same_month_last_year",
    "incidence_per_100k_deviation_from_median",
]

_PANEL_PATH = _ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
_OUT_PATH = Path(__file__).resolve().parent / "results.json"


def load_real_panel_with_features() -> pd.DataFrame:
    panel = pd.read_parquet(_PANEL_PATH)
    real = panel[panel["data_source"] == "real"].copy()
    real = real.sort_values(["province_id", "month"]).reset_index(drop=True)
    return build_feature_matrix(real, reporting_delay_months=REPORTING_DELAY_MONTHS)


def build_horizon_pairs(feat_panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Với mỗi dòng gốc tại tháng `t` (đã có feature cols, neo đúng tại
    `t`), ghép thêm `y_target`/`cases_target`/`population_target` = giá trị
    THẬT tại `t+horizon`. Dòng nào `t+horizon` ngoài phạm vi panel (hoặc
    không tồn tại) -> NaN, sẽ bị loại ở bước dropna khi train."""
    incidence_lookup = feat_panel.set_index(["province_id", "month"])[
        "incidence_per_100k"
    ]
    cases_lookup = feat_panel.set_index(["province_id", "month"])["cases"]
    population_lookup = feat_panel.set_index(["province_id", "month"])["population"]

    df = feat_panel.copy()
    target_months = df["month"] + pd.DateOffset(months=horizon)
    idx = pd.MultiIndex.from_arrays([df["province_id"], target_months])
    df["y_target"] = incidence_lookup.reindex(idx).to_numpy(
        dtype="float64", na_value=np.nan
    )
    df["cases_target"] = cases_lookup.reindex(idx).to_numpy(
        dtype="float64", na_value=np.nan
    )
    # population goc la Int64 nullable -> np.log() sau nay se loi neu con
    # dtype object/Int64 lan pd.NA; ep ve float64 tuong minh o day.
    df["population_target"] = population_lookup.reindex(idx).to_numpy(
        dtype="float64", na_value=np.nan
    )
    df["_target_month"] = target_months
    return df


def compute_train_naive_errors(train_df: pd.DataFrame) -> np.ndarray:
    errors = []
    for _, g in train_df.groupby("province_id"):
        g = g.set_index("month")[TARGET].sort_index()
        shifted = g.shift(12)
        errors.extend((g - shifted).dropna().abs().tolist())
    return np.array(errors)


def run() -> list[dict]:
    feat_panel = load_real_panel_with_features()
    splits = make_splits(
        feat_panel,
        n_origins=N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    horizon_pairs_cache = {h: build_horizon_pairs(feat_panel, h) for h in HORIZONS}

    rows: list[dict] = []
    for split in splits:
        raw_train_for_naive = feat_panel[feat_panel["month"] <= split.train_end]
        train_naive_errors = compute_train_naive_errors(raw_train_for_naive)

        for h in split.usable_horizons:
            target_month = split.target_month(h)
            assert_test_is_real_only(feat_panel, target_month)

            hp = horizon_pairs_cache[h]
            # TRAIN: chi cap (t, t+h) ma CA t va t+h deu <= train_end (da
            # "xay ra roi" tinh tu goc nhin train_end) — khong dung cap nao
            # co t+h > train_end de tranh ro ri.
            train_pairs = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["y_target"])

            # TEST: dung DUY NHAT dong tai t=train_end (feature neo dung
            # moc "hien tai"), target THAT la gia tri tai target_month.
            test_rows = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
            if test_rows.empty or train_pairs.empty:
                continue
            y_true = test_rows.set_index("province_id")["y_target"]

            # cases_target dung cho M1 (target dang dem) voi offset =
            # population_target (dan so DUNG TAI thang du bao, khong phai
            # tai train_end) — phai DROP cot "population" goc (dan so tai
            # t) truoc khi doi ten, khong se bi trung ten cot (population
            # goc + population_target cung thanh "population" -> DataFrame
            # 2 cot thay vi Series, gay loi kho hieu o np.log() sau).
            m1_train = train_pairs.drop(columns=["population"]).rename(
                columns={
                    "cases_target": "_m1_target",
                    "population_target": "population",
                }
            )
            m1_test = test_rows.drop(columns=["population"]).rename(
                columns={"population_target": "population"}
            )

            model_preds = {}
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                try:
                    m1_pred = fit_predict_m1_glm_negbin(
                        m1_train, m1_test, FEATURE_COLS, target_col="_m1_target"
                    )
                    model_preds["M1_glm_negbin"] = dict(
                        zip(test_rows["province_id"], m1_pred)
                    )
                except Exception as exc:  # noqa: BLE001 - giu cac fold khac
                    print(f"[origin {split.origin} h={h}] M1 lỗi: {exc}")

            m2a_pred = fit_predict_m2_xgboost(
                train_pairs, test_rows, FEATURE_COLS, target_col="y_target"
            )
            model_preds["M2a_xgboost"] = dict(zip(test_rows["province_id"], m2a_pred))

            m2b_pred = fit_predict_m2_lightgbm(
                train_pairs, test_rows, FEATURE_COLS, target_col="y_target"
            )
            model_preds["M2b_lightgbm"] = dict(zip(test_rows["province_id"], m2b_pred))

            for model_name, preds in model_preds.items():
                y_pred = pd.Series(preds).reindex(y_true.index)
                valid = y_pred.notna() & y_true.notna()
                if valid.sum() == 0:
                    continue
                rows.append(
                    {
                        "origin": split.origin,
                        "train_end": str(split.train_end.date()),
                        "horizon": h,
                        "target_month": str(target_month.date()),
                        "model": model_name,
                        "n_provinces": int(valid.sum()),
                        "mae": mae(y_true[valid], y_pred[valid]),
                        "mase": mase(y_true[valid], y_pred[valid], train_naive_errors),
                    }
                )
            print(f"[origin {split.origin}/{N_ORIGINS - 1}] h={h} xong.")
    return rows


def summarize(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    summary = (
        df.groupby(["model", "horizon"])
        .agg(
            mase_mean=("mase", "mean"),
            mase_std=("mase", "std"),
            mae_mean=("mae", "mean"),
            n_origins=("origin", "nunique"),
        )
        .reset_index()
    )
    return summary


if __name__ == "__main__":
    _rows = run()
    _OUT_PATH.write_text(
        json.dumps(_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    _summary = summarize(_rows)
    pd.set_option("display.width", 120)
    print()
    print(_summary.pivot(index="model", columns="horizon", values="mase_mean").round(3))
    print()
    print(f"Đã ghi {len(_rows)} dòng kết quả chi tiết vào {_OUT_PATH}")
