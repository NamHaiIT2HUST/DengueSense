from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
import pytest

from app.forecast.features import build_feature_matrix
from app.forecast.models import (
    fit_predict_m1_glm_negbin,
    fit_predict_m2_lightgbm,
    fit_predict_m2_xgboost,
    fit_predict_scale_aware,
)

FEATURE_COLS = ["sin_month", "cos_month", "temp_mean_lag_1", "momentum"]


def _make_panel(n_months: int = 60, n_provinces: int = 6) -> pd.DataFrame:
    """Panel giả lập nhiều tỉnh với MỨC INCIDENCE CƠ SỞ KHÁC HẲN NHAU theo
    tỉnh (province effect thật, không phải nhiễu) — dùng để kiểm tra M1 học
    được hiệu ứng tỉnh, không dồn dự báo về 1 mức chung."""
    rng = np.random.default_rng(0)
    months = pd.date_range("2015-01-01", periods=n_months, freq="MS")
    province_base = {f"p{i}": 5.0 * (i + 1) for i in range(n_provinces)}
    rows = []
    for p, base in province_base.items():
        population = 1_000_000 * (5 - list(province_base).index(p) % 5)
        for i, m in enumerate(months):
            incidence = max(0.1, base + rng.normal(0, 1.0))
            cases = incidence / 100_000 * population
            rows.append(
                {
                    "province_id": p,
                    "month": m,
                    "population": population,
                    "cases": cases,
                    "incidence_per_100k": incidence,
                    "temp_mean": 25.0 + 3 * np.sin(2 * np.pi * m.month / 12),
                    "precip_total": 100.0 + rng.normal(0, 10),
                    "humidity_mean": 75.0,
                    "oni": 0.0,
                }
            )
    return pd.DataFrame(rows)


@pytest.fixture
def train_test_split():
    panel = _make_panel()
    feat = build_feature_matrix(panel, reporting_delay_months=1)
    train = feat[feat["month"] <= "2018-06-01"]
    test = feat[feat["month"] == "2018-12-01"]
    return train, test


def test_m1_glm_negbin_returns_incidence_not_cases(train_test_split):
    """Regression test cho bug đã gặp thật: quên đổi cases->incidence_per_
    100k trước khi trả về, khiến dự báo lệch hàng chục lần so với thực tế."""
    train, test = train_test_split
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pred = fit_predict_m1_glm_negbin(train, test, FEATURE_COLS)

    actual = test["incidence_per_100k"].to_numpy()
    # incidence_per_100k trong panel gia lap nam trong khoang ~[0, 35] —
    # neu con bug tra ve "cases" thay vi incidence, pred se lon hon actual
    # hang chuc-hang tram lan (vi nhan voi population hang trieu).
    assert np.median(pred) < 5 * np.median(actual) + 20


def test_m1_glm_negbin_captures_province_effect(train_test_split):
    """Tỉnh có incidence nền cao (p5) phải được dự báo cao hơn hẳn tỉnh nền
    thấp (p0) — đây chính xác là điểm yếu B4 pooled ở exp_001 (xem
    RESULTS.md) mà M1 (có hiệu ứng tỉnh) phải khắc phục được."""
    train, test = train_test_split
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pred = fit_predict_m1_glm_negbin(train, test, FEATURE_COLS)

    result = pd.Series(pred, index=test["province_id"].to_numpy())
    assert result["p5"] > result["p0"]


def test_m1_raises_with_single_province():
    panel = _make_panel(n_provinces=1)
    feat = build_feature_matrix(panel, reporting_delay_months=1)
    train = feat[feat["month"] <= "2018-06-01"]
    test = feat[feat["month"] == "2018-12-01"]
    with pytest.raises(ValueError, match=">= 2 tỉnh"):
        fit_predict_m1_glm_negbin(train, test, FEATURE_COLS)


def test_m2_xgboost_no_nan_and_reasonable_scale(train_test_split):
    train, test = train_test_split
    pred = fit_predict_m2_xgboost(train, test, FEATURE_COLS)
    actual = test["incidence_per_100k"].to_numpy()
    assert not np.isnan(pred).any()
    assert np.all(pred >= 0)
    assert np.median(pred) < 5 * np.median(actual) + 20


def test_m2_lightgbm_no_nan_and_reasonable_scale(train_test_split):
    train, test = train_test_split
    pred = fit_predict_m2_lightgbm(train, test, FEATURE_COLS)
    actual = test["incidence_per_100k"].to_numpy()
    assert not np.isnan(pred).any()
    assert np.all(pred >= 0)
    assert np.median(pred) < 5 * np.median(actual) + 20


def test_scale_aware_prediction_scales_with_province_baseline():
    """2 tinh cung dang tuong doi, tinh B lon gap 10 lan: du bao B phai lon hon
    A ro ret (mo hinh tuyet doi pooled thuong khong lam duoc dieu nay)."""
    rng = np.random.default_rng(0)
    rows = []
    for prov, mult in [("A", 1.0), ("B", 10.0)]:
        for i in range(300):
            rel = rng.uniform(0.5, 2.0)
            base = mult * 3.0
            rows.append(
                {
                    "province_id": prov,
                    "prov_mean_hist": base,
                    "incidence_per_100k_lag_2": base * rel,
                    "temp": rng.normal(),
                    "y_target": base * rel * rng.uniform(0.9, 1.1),
                }
            )
    df = pd.DataFrame(rows)
    case_cols = ["incidence_per_100k_lag_2"]
    test = pd.DataFrame(
        {
            "province_id": ["A", "B"],
            "prov_mean_hist": [3.0, 30.0],
            "incidence_per_100k_lag_2": [3.0, 30.0],
            "temp": [0.0, 0.0],
        }
    )
    pred = fit_predict_scale_aware(
        fit_predict_m2_lightgbm,
        df,
        test,
        ["temp"],
        case_cols=case_cols,
        extra_cols=["prov_mean_hist"],
    )
    assert (pred >= 0).all()
    assert pred[1] > 5 * pred[0]


def test_scale_aware_never_negative():
    df = pd.DataFrame(
        {
            "prov_mean_hist": [0.0] * 60,
            "incidence_per_100k_lag_2": [0.0] * 60,
            "temp": np.linspace(-1, 1, 60),
            "y_target": [0.0, 0.0, 0.0, 1.0] * 15,  # co so khong, khong suy bien
        }
    )
    pred = fit_predict_scale_aware(
        fit_predict_m2_lightgbm,
        df,
        df.head(3),
        ["temp"],
        case_cols=["incidence_per_100k_lag_2"],
        extra_cols=["prov_mean_hist"],
    )
    assert (pred >= 0).all()
