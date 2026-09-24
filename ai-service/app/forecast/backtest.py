"""Phần dùng chung cho các experiment đánh giá M1/M2/M4 (exp_006+): nạp panel
real-only kèm đặc trưng, ghép cặp (X tại t, y thật tại t+h) neo đúng tại
origin (chống rò rỉ — xem exp_002 RESULTS.md), tính mẫu số MASE, và fit dự
báo 3 model thành viên. exp_002/003/005 giữ bản sao cục bộ riêng (đã chạy và
đóng băng kết quả), không refactor để không đổi số liệu đã công bố.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from app.forecast.features import build_feature_matrix
from app.forecast.models import (
    fit_predict_m1_glm_negbin,
    fit_predict_m2_lightgbm,
    fit_predict_m2_xgboost,
)

TARGET = "incidence_per_100k"
REPORTING_DELAY_MONTHS = 1

FEATURE_COLS_T1 = [
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

_PANEL_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "processed"
    / "v0.2.0"
    / "panel_monthly.parquet"
)


def load_real_panel_with_features(
    panel: pd.DataFrame | None = None,
) -> pd.DataFrame:
    if panel is None:
        panel = pd.read_parquet(_PANEL_PATH)
    real = panel[panel["data_source"] == "real"].copy()
    real = real.sort_values(["province_id", "month"]).reset_index(drop=True)
    return build_feature_matrix(real, reporting_delay_months=REPORTING_DELAY_MONTHS)


def build_horizon_pairs(feat_panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    """Mỗi dòng gốc tại `t` (feature neo tại `t`) + `y_target`/`cases_target`/
    `population_target` = giá trị THẬT tại `t+horizon` (NaN nếu ngoài panel)."""
    keyed = feat_panel.set_index(["province_id", "month"])
    df = feat_panel.copy()
    target_months = df["month"] + pd.DateOffset(months=horizon)
    idx = pd.MultiIndex.from_arrays([df["province_id"], target_months])
    for src, dst in [
        ("incidence_per_100k", "y_target"),
        ("cases", "cases_target"),
        ("population", "population_target"),
    ]:
        df[dst] = keyed[src].reindex(idx).to_numpy(dtype="float64", na_value=np.nan)
    df["_target_month"] = target_months
    return df


def compute_train_naive_errors(train_df: pd.DataFrame) -> np.ndarray:
    errors = []
    for _, g in train_df.groupby("province_id"):
        g = g.set_index("month")[TARGET].sort_index()
        errors.extend((g - g.shift(12)).dropna().abs().tolist())
    return np.array(errors)


def get_member_predictions(
    train_pairs: pd.DataFrame,
    test_rows: pd.DataFrame,
    members: tuple[str, ...] = ("M1_glm_negbin", "M2a_xgboost", "M2b_lightgbm"),
) -> dict[str, dict[str, float]]:
    """{model: {province_id: pred}} cho các model trong `members`. M1 có thể
    lỗi hội tụ (đã biết, exp_002) — bỏ riêng model đó ở fold này. M1 KHÔNG
    dùng được cho tỉnh chưa thấy khi train (hiệu ứng cố định theo tỉnh) nên
    các thí nghiệm LOPO chỉ truyền members=("M2a_xgboost", "M2b_lightgbm")."""
    preds: dict[str, dict[str, float]] = {}
    provinces = test_rows["province_id"]
    if "M1_glm_negbin" in members:
        m1_train = train_pairs.drop(columns=["population"]).rename(
            columns={"cases_target": "_m1_target", "population_target": "population"}
        )
        m1_test = test_rows.drop(columns=["population"]).rename(
            columns={"population_target": "population"}
        )
        try:
            p = fit_predict_m1_glm_negbin(
                m1_train, m1_test, FEATURE_COLS_T1, target_col="_m1_target"
            )
            preds["M1_glm_negbin"] = dict(zip(provinces, p))
        except Exception as exc:  # noqa: BLE001 - bo M1 rieng fold nay
            print(f"  M1 lỗi (bỏ qua fold này): {exc}")
    if "M2a_xgboost" in members:
        p = fit_predict_m2_xgboost(
            train_pairs, test_rows, FEATURE_COLS_T1, target_col="y_target"
        )
        preds["M2a_xgboost"] = dict(zip(provinces, p))
    if "M2b_lightgbm" in members:
        p = fit_predict_m2_lightgbm(
            train_pairs, test_rows, FEATURE_COLS_T1, target_col="y_target"
        )
        preds["M2b_lightgbm"] = dict(zip(provinces, p))
    return preds
