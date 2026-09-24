from __future__ import annotations

import numpy as np
import pandas as pd

from app.forecast.backtest import (
    build_horizon_pairs,
    calendarize_panel,
    compute_train_naive_errors,
)
from app.forecast.features import add_disease_lag_features


def _panel() -> pd.DataFrame:
    months = pd.date_range("2000-01-01", periods=30, freq="MS")
    rows = []
    for p, base in [("a", 1.0), ("b", 100.0)]:
        for i, m in enumerate(months):
            rows.append(
                {
                    "province_id": p,
                    "month": m,
                    "incidence_per_100k": base + i,
                    "cases": (base + i) * 10,
                    "population": 1_000_000,
                }
            )
    return pd.DataFrame(rows)


def test_build_horizon_pairs_target_is_true_value_at_t_plus_h():
    panel = _panel()
    hp = build_horizon_pairs(panel, horizon=3)
    row = hp[(hp["province_id"] == "b") & (hp["month"] == pd.Timestamp("2000-05-01"))]
    # thang 2000-05 la index 4 -> t+3 = index 7 -> 100 + 7
    assert row["y_target"].iloc[0] == 107.0
    assert row["_target_month"].iloc[0] == pd.Timestamp("2000-08-01")


def test_build_horizon_pairs_nan_when_target_outside_panel():
    hp = build_horizon_pairs(_panel(), horizon=6)
    last = hp[hp["month"] == hp["month"].max()]
    assert last["y_target"].isna().all()


def test_train_naive_errors_are_seasonal_lag_12_absolute_differences():
    errs = compute_train_naive_errors(_panel())
    # moi tinh: chuoi tang deu 1/thang -> |y[t]-y[t-12]| = 12; 18 diem x 2 tinh
    assert len(errs) == 36
    assert np.allclose(errs, 12.0)


def test_calendarize_makes_row_lag_equal_calendar_lag_across_a_gap():
    panel = _panel()
    panel = panel[panel["month"] != pd.Timestamp("2000-10-01")]  # thieu 1 thang
    naive = add_disease_lag_features(panel, max_lag=3, reporting_delay_months=1)
    cal = calendarize_panel(panel)
    cal = add_disease_lag_features(cal, max_lag=3, reporting_delay_months=1)
    cal = cal[~cal["_inserted"]]
    target = (cal["province_id"] == "b") & (cal["month"] == pd.Timestamp("2000-12-01"))
    naive_t = (naive["province_id"] == "b") & (
        naive["month"] == pd.Timestamp("2000-12-01")
    )
    # 2000-12: lag 2 thang = 2000-10 (thieu) -> phai la NaN theo lich; theo dong thi
    # lay nham 2000-09 (gia tri that, sai thoi diem)
    assert np.isnan(cal.loc[target, "incidence_per_100k_lag_2"].iloc[0])
    assert not np.isnan(naive.loc[naive_t, "incidence_per_100k_lag_2"].iloc[0])
    # thang khong bi anh huong giu nguyen gia tri
    ok = (cal["province_id"] == "a") & (cal["month"] == pd.Timestamp("2000-06-01"))
    ok_n = (naive["province_id"] == "a") & (
        naive["month"] == pd.Timestamp("2000-06-01")
    )
    assert (
        cal.loc[ok, "incidence_per_100k_lag_2"].iloc[0]
        == naive.loc[ok_n, "incidence_per_100k_lag_2"].iloc[0]
    )
