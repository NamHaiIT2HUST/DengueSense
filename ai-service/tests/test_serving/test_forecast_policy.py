from itertools import pairwise

import pytest

from app.serving.forecast_api import policy


def test_reliability_by_region_matches_model_card():
    assert policy.reliability_for("Bắc") == {
        "region_level": "low_in_outbreak_years",
        "note_code": "bac_outbreak_years",
    }
    assert policy.reliability_for("Trung")["region_level"] == "high"
    # Nam ngang baseline theo mùa — KHÔNG được ghi là "cao" (model card §12.4)
    assert policy.reliability_for("Nam")["region_level"] == "equal_to_seasonal_baseline"


def test_unknown_region_is_an_error_not_a_guess():
    with pytest.raises(ValueError):
        policy.reliability_for("Tây")


@pytest.mark.parametrize(
    "feature,family",
    [
        ("incidence_per_100k_lag_2", "recent_cases"),
        ("momentum", "recent_cases"),
        ("acceleration", "recent_cases"),
        ("incidence_per_100k_same_month_last_year", "seasonal_norm"),
        ("incidence_per_100k_deviation_from_median", "seasonal_norm"),
        ("sin_month", "seasonal_norm"),
        ("cos_month", "seasonal_norm"),
        ("temp_mean_lag_1", "climate"),
        ("precip_total_roll_mean_3", "climate"),
        ("humidity_mean_lag_1", "climate"),
        ("oni_lag_3", "climate"),
        ("something_else", "other"),
    ],
)
def test_feature_family(feature, family):
    assert policy.feature_family(feature) == family


def test_every_t1_feature_has_a_non_other_family():
    from app.forecast.backtest import FEATURE_COLS_T1

    assert [f for f in FEATURE_COLS_T1 if policy.feature_family(f) == "other"] == []


def _flags(**kw):
    base = {"exceed_prob": 0.1, "estimated_share": 0.0, "origin_month": "2010-03"}
    return policy.forecast_flags(**{**base, **kw})


def test_no_flags_when_quiet_and_real():
    assert _flags() == []


def test_underprediction_flag_when_model_says_exceedance_is_more_likely_than_not():
    assert _flags(exceed_prob=0.5) == ["outbreak_underprediction_risk"]
    assert _flags(exceed_prob=0.49) == []


def test_estimated_inputs_and_out_of_validated_period_and_stale():
    assert _flags(estimated_share=0.25) == ["estimated_inputs"]
    assert _flags(origin_month="2010-06") == []
    assert _flags(origin_month="2010-07") == ["out_of_validated_period"]
    assert _flags(stale=True) == ["stale_data"]
    assert _flags(
        exceed_prob=0.9, estimated_share=1.0, stale=True, origin_month="2012-01"
    ) == [
        "outbreak_underprediction_risk",
        "estimated_inputs",
        "stale_data",
        "out_of_validated_period",
    ]


def test_input_sources_shares_sum_to_one():
    s = policy.input_sources(["real"] * 9 + ["estimated"] * 3)
    assert s == {"real": 0.75, "estimated": 0.25, "imputed": 0.0}
    assert sum(s.values()) == pytest.approx(1.0)


def test_input_sources_rejects_empty_and_unknown():
    with pytest.raises(ValueError):
        policy.input_sources([])
    with pytest.raises(ValueError):
        policy.input_sources(["real", "simulated"])


def test_exceed_prob_legend_is_contiguous_and_covers_zero_to_one():
    legend = policy.exceed_prob_legend()
    assert len(legend) == 5
    assert legend[0]["min"] == 0.0 and legend[-1]["max"] == 1.0
    assert all(a["max"] == b["min"] for a, b in pairwise(legend))


def test_incidence_legend_uses_vietnamese_decimals_and_validates_edges():
    legend = policy.incidence_legend([2.0, 5.5, 12.0, 30.0], 400.0)
    assert [c["label"] for c in legend] == [
        "Dưới 2,0",
        "2,0–5,5",
        "5,5–12,0",
        "12,0–30,0",
        "Từ 30,0",
    ]
    assert legend[-1]["max"] == 400.0
    with pytest.raises(ValueError):
        policy.incidence_legend([2.0, 2.0, 12.0, 30.0], 400.0)  # không tăng ngặt
    with pytest.raises(ValueError):
        policy.incidence_legend([2.0, 5.5, 12.0], 400.0)
    with pytest.raises(ValueError):
        policy.incidence_legend([2.0, 5.5, 12.0, float("nan")], 400.0)
