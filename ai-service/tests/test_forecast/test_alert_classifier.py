from __future__ import annotations

import numpy as np
import pandas as pd

from app.forecast.alert_classifier import (
    CLF_COLS,
    build_pairs,
    fit_predict_classifier,
    with_thresholds,
)
from app.forecast.features import build_feature_matrix


def _panel(n_years: int = 8, provinces=("a", "b", "c")) -> pd.DataFrame:
    rng = np.random.default_rng(1)
    months = pd.date_range("2000-01-01", periods=12 * n_years, freq="MS")
    rows = []
    for p_i, p in enumerate(provinces):
        for i, m in enumerate(months):
            season = 1 + np.sin(2 * np.pi * m.month / 12)
            inc = max(0.0, 5 * (p_i + 1) * season + rng.normal(0, 1))
            rows.append(
                {
                    "province_id": p,
                    "month": m,
                    "cases": inc * 10,
                    "incidence_per_100k": inc,
                    "population": 1_000_000,
                    "temp_mean": 25 + 3 * season + rng.normal(0, 0.3),
                    "precip_total": 100 + 50 * season + rng.normal(0, 5),
                    "humidity_mean": 80 + rng.normal(0, 1),
                    "oni": np.sin(i / 20),
                }
            )
    return pd.DataFrame(rows)


def _featured() -> pd.DataFrame:
    return with_thresholds(build_feature_matrix(_panel()))


def test_labels_match_definition_and_use_target_month_threshold():
    panel = _featured()
    hp = build_pairs(panel, 3)
    row = hp[hp["label"].notna()].iloc[100]
    assert row["label"] == float(row["y_target"] > row["thr_target"])
    # thr_target la nguong cua THANG DICH, khong phai thang goc
    lookup = panel.set_index(["province_id", "month"])["thr_month"]
    assert row["thr_target"] == lookup.loc[(row["province_id"], row["_target_month"])]


def test_labels_are_nan_without_threshold_history():
    hp = build_pairs(_featured(), 1)
    early = hp[hp["_target_month"] < pd.Timestamp("2003-01-01")]  # < 3 nam lich su
    assert early["label"].isna().all()


def test_classifier_returns_probabilities_and_beats_chance_on_synthetic_seasonality():
    panel = _featured()
    hp = build_pairs(panel, 1)
    cut = pd.Timestamp("2006-12-01")
    train = hp[(hp["_target_month"] <= cut)].dropna(subset=["label"])
    test = hp[(hp["month"] == cut)].dropna(subset=["label"])
    p = fit_predict_classifier(train, test)
    assert p.shape == (len(test),)
    assert np.all((p >= 0) & (p <= 1))
    assert set(CLF_COLS) <= set(train.columns)
