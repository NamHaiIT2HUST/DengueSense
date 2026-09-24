"""Classifier cảnh báo trực tiếp (exp_012): P(tháng t+h vượt P75 nhân quả của tỉnh
đó cho tháng đó). Đưa từ `experiments/exp_012_direct_classifier/run.py` vào `app`
để dùng lại (đánh giá nhiều mùa, exp_016). Logic KHỚP exp_012 (đã kiểm: cùng cột,
cùng thứ tự — GBM nhạy thứ tự cột).

Đặc trưng: 17 T1 + quy mô tỉnh + ngưỡng tháng đích (`thr_target`, biết trước) + 5
đặc trưng ca bệnh TƯƠNG ĐỐI so ngưỡng (chia cho thr+1). Mô hình: trung bình xác
suất của XGBoost `binary:logistic` và LightGBM `binary`, tham số T1.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.forecast.alerting import add_expanding_exceedance_threshold
from app.forecast.backtest import FEATURE_COLS_T1, build_horizon_pairs
from app.forecast.models import fit_predict_m2_lightgbm, fit_predict_m2_xgboost

REL_SOURCES = [
    "incidence_per_100k_lag_2",
    "incidence_per_100k_lag_3",
    "incidence_per_100k_same_month_last_year",
    "prov_mean_hist",
    "prov_mean_12m",
]
REL_COLS = [f"{c}__vs_thr" for c in REL_SOURCES]
CLF_COLS = (
    FEATURE_COLS_T1 + ["prov_mean_hist", "prov_mean_12m", "thr_target"] + REL_COLS
)


def with_thresholds(panel: pd.DataFrame) -> pd.DataFrame:
    """Gắn `thr_month` (ngưỡng nhân quả của CHÍNH tháng đó) vào panel."""
    thr = add_expanding_exceedance_threshold(panel)[
        ["province_id", "month", "thr_month"]
    ]
    return panel.merge(thr, on=["province_id", "month"], how="left")


def build_pairs(panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Cặp (X tại t, nhãn tại t+h): `thr_target`, các cột tương đối, `label` (NaN
    nếu thiếu ngưỡng hoặc y_target)."""
    hp = build_horizon_pairs(panel, horizon)
    thr = panel.set_index(["province_id", "month"])["thr_month"]
    idx = pd.MultiIndex.from_arrays([hp["province_id"], hp["_target_month"]])
    hp["thr_target"] = thr.reindex(idx).to_numpy(dtype="float64", na_value=np.nan)
    for c in REL_SOURCES:
        hp[f"{c}__vs_thr"] = hp[c] / (hp["thr_target"] + 1.0)
    hp["label"] = np.where(
        hp["thr_target"].notna() & hp["y_target"].notna(),
        (hp["y_target"] > hp["thr_target"]).astype(float),
        np.nan,
    )
    return hp


def fit_predict_classifier(train: pd.DataFrame, test: pd.DataFrame) -> np.ndarray:
    """Xác suất vượt ngưỡng cho các dòng `test`; `train` phải có cột `label`."""
    probs = []
    for fn, obj in (
        (fit_predict_m2_xgboost, "binary:logistic"),
        (fit_predict_m2_lightgbm, "binary"),
    ):
        probs.append(
            np.asarray(
                fn(train, test, CLF_COLS, target_col="label", objective=obj),
                dtype=float,
            )
        )
    return np.clip(np.mean(probs, axis=0), 0.0, 1.0)
