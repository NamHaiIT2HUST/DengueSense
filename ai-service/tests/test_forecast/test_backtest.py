from __future__ import annotations

import numpy as np
import pandas as pd

from app.forecast.backtest import build_horizon_pairs, compute_train_naive_errors


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
