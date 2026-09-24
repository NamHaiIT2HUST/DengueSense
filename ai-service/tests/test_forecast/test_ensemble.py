from __future__ import annotations

import math

from app.forecast.ensemble import combine_ensemble, validation_error_weights


def test_combine_ensemble_simple_average():
    preds = {
        "a": {"p1": 1.0, "p2": 2.0},
        "b": {"p1": 3.0, "p2": 4.0},
    }
    out = combine_ensemble(preds, ["p1", "p2"])
    assert out["p1"] == 2.0
    assert out["p2"] == 3.0


def test_combine_ensemble_weighted_average():
    preds = {
        "a": {"p1": 0.0},
        "b": {"p1": 10.0},
    }
    out = combine_ensemble(preds, ["p1"], weights={"a": 0.9, "b": 0.1})
    assert math.isclose(out["p1"], 1.0)


def test_combine_ensemble_renormalizes_when_a_model_is_missing():
    preds = {
        "a": {"p1": 5.0},
        "b": {},  # M1-style convergence failure - khong co du bao cho p1
    }
    out = combine_ensemble(preds, ["p1"], weights={"a": 0.3, "b": 0.7})
    assert out["p1"] == 5.0


def test_combine_ensemble_skips_nan_predictions():
    preds = {
        "a": {"p1": float("nan")},
        "b": {"p1": 6.0},
    }
    out = combine_ensemble(preds, ["p1"])
    assert out["p1"] == 6.0


def test_combine_ensemble_drops_province_with_no_valid_predictions():
    preds = {"a": {}, "b": {}}
    out = combine_ensemble(preds, ["p1"])
    assert "p1" not in out


def test_validation_error_weights_favors_lower_error():
    weights = validation_error_weights({"a": 1.0, "b": 4.0})
    assert weights["a"] > weights["b"]
    assert math.isclose(sum(weights.values()), 1.0)


def test_route_by_group_uses_alt_only_for_selected_groups():
    from app.forecast.ensemble import route_by_group

    out = route_by_group(
        {"a": 1.0, "b": 2.0},
        {"a": 10.0, "b": 20.0},
        {"a": "Bac", "b": "Nam"},
        ["Bac"],
    )
    assert out == {"a": 10.0, "b": 2.0}


def test_route_by_group_falls_back_when_chosen_source_missing():
    from app.forecast.ensemble import route_by_group

    out = route_by_group({"a": 1.0}, {}, {"a": "Bac"}, ["Bac"])
    assert out == {"a": 1.0}
