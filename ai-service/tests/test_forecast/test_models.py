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
