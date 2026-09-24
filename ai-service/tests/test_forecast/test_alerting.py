from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.forecast.alerting import (
    IsotonicCalibrator,
    PlattCalibrator,
    ResidualCalibrator,
    exceedance_thresholds,
    expected_calibration_error,
    poisson_exceed_prob,
    reliability_table,
)


def test_thresholds_use_only_same_calendar_month_and_quantile():
    months = pd.to_datetime(
        ["2000-03-01", "2001-03-01", "2002-03-01", "2003-03-01", "2001-04-01"]
    )
    df = pd.DataFrame(
        {
            "province_id": "a",
            "month": months,
            "incidence_per_100k": [1.0, 2.0, 3.0, 4.0, 1000.0],
        }
    )
    thr = exceedance_thresholds(df, pd.Timestamp("2004-03-01"), 0.75)
    assert thr["a"] == pytest.approx(
        np.quantile([1, 2, 3, 4], 0.75)
    )  # 3.25, khong lan thang 4


def test_poisson_exceed_prob_monotone_and_bounded():
    pop = np.full(4, 1_000_000)
    thr = np.full(4, 10.0)
    p = poisson_exceed_prob(np.array([1.0, 5.0, 10.0, 30.0]), pop, thr)
    assert np.all((p >= 0) & (p <= 1))
    assert np.all(np.diff(p) > 0)
    assert p[-1] > 0.99 and p[0] < 0.01


def _synthetic(n=2000, seed=0):
    rng = np.random.default_rng(seed)
    thr = rng.uniform(2, 20, n)
    pred = thr * np.exp(rng.normal(0, 0.8, n))
    y_true_inc = pred * np.exp(rng.normal(0, 0.5, n))
    return pred, thr, (y_true_inc > thr).astype(int), y_true_inc


@pytest.mark.parametrize(
    "cal_cls", [PlattCalibrator, IsotonicCalibrator, ResidualCalibrator]
)
def test_calibrators_are_monotone_in_prediction_and_bounded(cal_cls):
    pred, thr, y, y_inc = _synthetic()
    cal = (
        cal_cls().fit(pred, thr, y_inc)
        if cal_cls is ResidualCalibrator
        else cal_cls().fit(pred, thr, y)
    )
    grid = np.linspace(0.5, 60, 50)
    p = cal.predict_proba(grid, np.full(50, 10.0))
    assert np.all((p >= 0) & (p <= 1))
    assert np.all(np.diff(p) >= -1e-9)


def test_platt_and_residual_are_reasonably_calibrated_on_synthetic_data():
    pred, thr, y, y_inc = _synthetic(5000)
    for cal in (
        PlattCalibrator().fit(pred, thr, y),
        ResidualCalibrator().fit(pred, thr, y_inc),
    ):
        ece = expected_calibration_error(y, cal.predict_proba(pred, thr))
        assert ece < 0.05


def test_reliability_table_bins():
    y = np.array([0, 0, 1, 1])
    p = np.array([0.05, 0.05, 0.95, 0.95])
    t = reliability_table(y, p, n_bins=10)
    assert list(t["bin"]) == [0, 9]
    assert list(t["observed"]) == [0.0, 1.0]


def test_expanding_threshold_uses_only_previous_years_same_month():
    from app.forecast.alerting import add_expanding_exceedance_threshold

    months = pd.to_datetime([f"{y}-03-01" for y in range(2000, 2006)])
    df = pd.DataFrame(
        {
            "province_id": "a",
            "month": months,
            "incidence_per_100k": [1.0, 2.0, 3.0, 4.0, 100.0, 7.0],
        }
    )
    out = add_expanding_exceedance_threshold(df, 0.75, min_years=3)
    # 2003 (idx 3): truoc do 1,2,3 -> P75 = 2.5 ; khong dung chinh 4.0
    assert out.loc[3, "thr_month"] == pytest.approx(np.quantile([1, 2, 3], 0.75))
    assert np.isnan(out.loc[2, "thr_month"])  # chi 2 nam truoc < min_years
    # 2005 (idx 5): truoc do 1,2,3,4,100
    assert out.loc[5, "thr_month"] == pytest.approx(
        np.quantile([1, 2, 3, 4, 100], 0.75)
    )


def test_expanding_threshold_is_causal_wrt_future_values():
    from app.forecast.alerting import add_expanding_exceedance_threshold

    months = pd.to_datetime([f"{y}-03-01" for y in range(2000, 2008)])
    base = pd.DataFrame(
        {
            "province_id": "a",
            "month": months,
            "incidence_per_100k": np.arange(8, dtype=float),
        }
    )
    a = add_expanding_exceedance_threshold(base)
    b_in = base.copy()
    b_in.loc[7, "incidence_per_100k"] = 1e6
    b = add_expanding_exceedance_threshold(b_in)
    pd.testing.assert_series_equal(a["thr_month"][:7], b["thr_month"][:7])
    assert (
        a["thr_month"].iloc[7] == b["thr_month"].iloc[7]
    )  # chinh dong cuoi cung cung khong doi
