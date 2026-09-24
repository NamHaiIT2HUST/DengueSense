from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.forecast.multiseason import (
    cluster_bootstrap_ci,
    season_splits,
    sign_test_pvalue,
)


def _panel(start="1994-02-01", end="2010-12-01") -> pd.DataFrame:
    months = pd.date_range(start, end, freq="MS")
    return pd.DataFrame(
        {
            "month": np.tile(months, 2),
            "province_id": ["a"] * len(months) + ["b"] * len(months),
        }
    )


def test_season_2010_reproduces_the_original_outer_origins():
    sp = season_splits(_panel(), [2010])[2010]
    assert len(sp) == 8
    assert sp[0].train_end == pd.Timestamp("2009-11-01")
    assert sp[-1].train_end == pd.Timestamp("2010-06-01")


def test_each_season_has_8_origins_ending_at_june_and_targets_within_december():
    splits = season_splits(_panel(), [2006, 2007, 2008, 2009, 2010])
    for y, sp in splits.items():
        assert len(sp) == 8
        assert sp[0].train_end == pd.Timestamp(f"{y - 1}-11-01")
        assert sp[-1].train_end == pd.Timestamp(f"{y}-06-01")
        last_target = max(s.target_month(6) for s in sp if 6 in s.usable_horizons)
        assert last_target == pd.Timestamp(f"{y}-12-01")


def test_seasons_never_look_beyond_their_december():
    splits = season_splits(_panel(), [2007])
    latest = max(s.target_month(h) for s in splits[2007] for h in s.usable_horizons)
    assert latest <= pd.Timestamp("2007-12-01")


def test_bootstrap_ci_brackets_the_mean_and_is_reproducible():
    x = np.random.default_rng(0).normal(0.2, 0.1, 50)
    m, lo, hi = cluster_bootstrap_ci(x, n_boot=2000)
    assert lo < m < hi
    assert (m, lo, hi) == cluster_bootstrap_ci(x, n_boot=2000)
    assert 0.15 < lo and hi < 0.25  # 50 diem sd 0.1 -> CI ~ +-0.028


def test_bootstrap_ci_ignores_nan():
    m, _, _ = cluster_bootstrap_ci(np.array([1.0, 3.0, np.nan]))
    assert m == pytest.approx(2.0)


def test_sign_test():
    assert sign_test_pvalue(np.ones(20)) < 0.001
    assert sign_test_pvalue(np.array([1.0, -1.0] * 10)) == pytest.approx(1.0)
    assert sign_test_pvalue(np.zeros(5)) == 1.0
