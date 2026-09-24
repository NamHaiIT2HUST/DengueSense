"""Giải thích model (docs/02 §5, SHAP): TreeSHAP CHÍNH XÁC có sẵn trong LightGBM
(`pred_contrib=True`) và XGBoost (`pred_contribs=True`) — không cần thư viện
`shap`. Giá trị SHAP ở KHÔNG GIAN ĐIỂM THÔ của model: log(số ca) với objective
Poisson/Tweedie, logit với binary; cột cuối = giá trị nền (base value). Tính chất
cộng tính: tổng đóng góp + nền = điểm thô (test trong tests/test_explain.py).

Các hàm fit ở đây dùng CÙNG tham số T1 mặc định như `models.py` nhưng trả về
đối tượng model (để lấy đóng góp), không chỉ dự báo.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.forecast.models import (
    DEFAULT_LIGHTGBM_PARAMS,
    DEFAULT_XGBOOST_PARAMS,
    _drop_incomplete_rows,
)


def fit_lightgbm_model(
    train_df: pd.DataFrame,
    feature_cols: list[str],
    target_col: str,
    objective: str = "poisson",
    seed: int = 42,
    params: dict | None = None,
):
    import lightgbm as lgb

    clean = _drop_incomplete_rows(train_df, feature_cols)
    model = lgb.LGBMRegressor(
        objective=objective,
        random_state=seed,
        verbosity=-1,
        **{**DEFAULT_LIGHTGBM_PARAMS, **(params or {})},
    )
    model.fit(clean[feature_cols], clean[target_col])
    return model


def fit_xgboost_model(
    train_df: pd.DataFrame,
    feature_cols: list[str],
    target_col: str,
    objective: str = "count:poisson",
    seed: int = 42,
    params: dict | None = None,
):
    import xgboost as xgb

    clean = _drop_incomplete_rows(train_df, feature_cols)
    model = xgb.XGBRegressor(
        objective=objective,
        random_state=seed,
        **{**DEFAULT_XGBOOST_PARAMS, **(params or {})},
    )
    model.fit(clean[feature_cols], clean[target_col])
    return model


def tree_shap(model, X: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """(đóng góp n×p, nền n) — TreeSHAP chính xác của LightGBM/XGBoost sklearn API."""
    name = type(model).__module__
    if name.startswith("lightgbm"):
        contrib = np.asarray(model.predict(X, pred_contrib=True), dtype=float)
    elif name.startswith("xgboost"):
        import xgboost as xgb

        contrib = np.asarray(
            model.get_booster().predict(xgb.DMatrix(X), pred_contribs=True),
            dtype=float,
        )
    else:
        raise TypeError(f"Model không hỗ trợ: {type(model)}")
    return contrib[:, :-1], contrib[:, -1]


# Nhóm đặc trưng theo ý nghĩa (để báo cáo "tín hiệu nào dẫn dắt dự báo")
_FAMILIES = [
    ("Mùa vụ", ("sin_month", "cos_month")),
    ("ONI (El Niño)", ("oni_",)),
    ("Khí hậu (nhiệt/mưa/ẩm)", ("temp_mean", "precip_total", "humidity_mean")),
    (
        "Ca bệnh gần đây (lag, đà tăng)",
        ("incidence_per_100k_lag", "momentum", "acceleration"),
    ),
    (
        "Chuẩn mùa vụ của tỉnh",
        ("same_month_last_year", "deviation_from_median"),
    ),
    ("Quy mô / ngưỡng của tỉnh", ("prov_mean", "thr_target", "__vs_thr")),
    ("Không gian (láng giềng/toàn quốc)", ("nb_", "nat_")),
]


def feature_family(name: str) -> str:
    """Nhóm ý nghĩa của 1 cột đặc trưng (khớp theo tiền tố/từ khoá, thứ tự ưu tiên)."""
    if "__vs_thr" in name or name.startswith(("prov_mean", "thr_target")):
        return "Quy mô / ngưỡng của tỉnh"
    if name.startswith(("incidence_per_100k_same_month", "incidence_per_100k_dev")):
        return "Chuẩn mùa vụ của tỉnh"
    for family, keys in _FAMILIES:
        if any(name.startswith(k) or k in name for k in keys):
            return family
    return "Khác"
