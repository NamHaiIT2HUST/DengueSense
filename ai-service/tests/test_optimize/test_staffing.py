import math

import pytest
from pydantic import ValidationError

from app.optimize.evaluate import evaluate_allocation
from app.optimize.staffing import Allocation, L, integer_lower_bound, validate_scenario


def row(g, n, people):
    return Allocation(group_id=g, need_id=n, people=people)


def test_eval_priority_trap(case):
    scenario = case("priority_trap")
    score = evaluate_allocation(scenario, [row("G1", "N1", 2)]).score
    assert score.model_dump() == {
        "weighted_unmet_hours": 8,
        "total_unmet_hours": 8,
        "total_cost_vnd": 40,
    }
    split = evaluate_allocation(scenario, [row("G1", "N1", 1), row("G1", "N2", 1)])
    assert split.feasible
    assert (split.score.weighted_unmet_hours, split.score.total_cost_vnd) == (16, 30)


@pytest.mark.parametrize("value", [-1, True, 1.0, math.nan, math.inf, L + 1])
def test_strict_numeric(case, value):
    data = case("priority_trap").model_dump()
    data["budget_vnd"] = value
    with pytest.raises(ValidationError, match="budget_vnd"):
        type(case("priority_trap")).model_validate(data)


@pytest.mark.parametrize(
    "rows,violation",
    [
        ([("G1", "N1", 3)], "SUPPLY:G1"),
        ([("G1", "N1", 1), ("G1", "N1", 1)], "DUPLICATE_ASSIGNMENT:G1:N1"),
        ([("G2", "N1", 1)], "ARC:G2:N1"),
        ([("unknown", "N1", 1)], "REFERENCE:unknown:N1"),
    ],
)
def test_invalid_allocation(case, rows, violation):
    result = evaluate_allocation(case("priority_trap"), [row(*r) for r in rows])
    assert not result.feasible and result.score is None
    assert violation in result.violations


def test_skill_budget_floor(case):
    s = case("priority_trap")
    s.arcs.append(type(s.arcs[0])(group_id="G2", need_id="N1", cost_vnd=0))
    assert "SKILL:G2:N1" in evaluate_allocation(s, [row("G2", "N1", 1)]).violations
    s.budget_vnd = 0
    assert "BUDGET" in evaluate_allocation(s, [row("G1", "N1", 1)]).violations
    assert "FLOOR:N1" in evaluate_allocation(case("infeasible_floor"), []).violations


def test_locked_exact(case):
    s = case("locked_exact")
    assert evaluate_allocation(s, [row("G1", "N1", 1), row("G1", "N2", 1)]).feasible
    for count in [0, 2]:
        assert (
            "LOCK:G1:N1" in evaluate_allocation(s, [row("G1", "N1", count)]).violations
        )
    assert "LOCK:G1:N1" in evaluate_allocation(s, []).violations
    s.locked_allocations[0].people = 0
    assert evaluate_allocation(s, [row("G1", "N2", 2)]).feasible
    assert "LOCK:G1:N1" in evaluate_allocation(s, [row("G1", "N1", 1)]).violations


@pytest.mark.parametrize(
    "kind,message",
    [
        ("supply", "PROTECTION:G1"),
        ("group", "DUPLICATE_GROUP"),
        ("arc", "DUPLICATE_ARC"),
        ("lock", "DUPLICATE_LOCK"),
        ("reference", "REFERENCE"),
    ],
)
def test_invalid_scenario(case, kind, message):
    s = case("locked_exact")
    if kind == "supply":
        s.groups[0].total_people = 1
    if kind == "group":
        s.groups.append(s.groups[0])
    if kind == "arc":
        s.arcs.append(s.arcs[0])
    if kind == "lock":
        s.locked_allocations.append(s.locked_allocations[0])
    if kind == "reference":
        s.arcs[0].group_id = "unknown"
    with pytest.raises(ValueError, match=message):
        validate_scenario(s)


def test_overflow_envelopes(case):
    s = case("zero_cost")
    s.budget_vnd = L
    validate_scenario(s)
    s.groups[0].hours_per_person = L
    s.needs[0].demand_hours = 1
    with pytest.raises(ValueError, match="shortfall"):
        validate_scenario(s)
    s.groups[0].hours_per_person = 0
    s.needs[0].demand_hours = L
    s.needs[0].priority = 2
    with pytest.raises(ValueError, match="weighted"):
        validate_scenario(s)


@pytest.mark.parametrize(
    "value,expected",
    [
        (8.0, 7),
        (7.9, 7),
        (0.0, 0),
        (math.nan, None),
        (math.inf, None),
        (float(L + 1), None),
        (math.nextafter(8.0, math.inf), 8),
        (math.nextafter(8.0, -math.inf), 7),
    ],
)
def test_bound_conversion(value, expected):
    assert integer_lower_bound(value) == expected


def test_zero_cost(case):
    result = evaluate_allocation(case("zero_cost"), [row("G1", "N1", 1)])
    assert result.feasible and result.score.total_cost_vnd == 0


@pytest.mark.parametrize(
    "kind,label",
    [
        ("hours_product", "hours"),
        ("cost_product", "cost"),
        ("coverage_total", "coverage"),
        ("cost_total", "total_cost"),
        ("weighted_total", "weighted_total"),
        ("supply_total", "supply"),
        ("capacity_total", "capacity"),
        ("protection", "protection"),
    ],
)
def test_expression_envelopes(case, kind, label):
    s = case("cost_tie")
    if kind in ("hours_product", "cost_product"):
        s.groups[0].total_people = 2
        s.needs[0].max_people = 2
        if kind == "hours_product":
            s.groups[0].hours_per_person = L
        else:
            s.arcs[0].cost_vnd = L
    if kind == "coverage_total":
        for g in s.groups:
            g.hours_per_person = L // 2 + 1
    if kind == "cost_total":
        for a in s.arcs:
            a.cost_vnd = L // 2 + 1
    if kind == "weighted_total":
        s.arcs = []
        s.needs.append(s.needs[0].model_copy(deep=True))
        s.needs[1].need_id = "N2"
        for n in s.needs:
            n.demand_hours = L // 2 + 1
    if kind == "supply_total":
        s.groups = s.groups[:1]
        s.groups[0].total_people = L
        s.groups[0].hours_per_person = 0
        s.needs.append(s.needs[0].model_copy(deep=True))
        s.needs[1].need_id = "N2"
        for n in s.needs:
            n.max_people = L
        s.arcs = [s.arcs[0], s.arcs[0].model_copy(deep=True)]
        s.arcs[1].need_id = "N2"
        for a in s.arcs:
            a.cost_vnd = 0
    if kind == "capacity_total":
        for g in s.groups:
            g.total_people = L
            g.hours_per_person = 0
        s.needs[0].max_people = L
        for a in s.arcs:
            a.cost_vnd = 0
    if kind == "protection":
        s.groups[0].committed_people = L
        s.groups[0].reserve_people = 1
    with pytest.raises(ValueError, match=label):
        validate_scenario(s)


def test_exact_supported_limit(case):
    s = case("zero_cost")
    s.arcs = []
    s.needs[0].demand_hours = L
    validate_scenario(s)
    assert evaluate_allocation(s, []).score.weighted_unmet_hours == L


def test_multiskill_supply_sum(case):
    s = case("priority_trap")
    s.groups[0].skills.append("clinical")
    s.needs[1].role_id = "clinical"
    assert (
        "SUPPLY:G1"
        in evaluate_allocation(s, [row("G1", "N1", 2), row("G1", "N2", 1)]).violations
    )


def test_schema_rejects_extra_and_empty_id(case):
    data = case("priority_trap").model_dump()
    data["extra"] = "unexpected"
    with pytest.raises(ValidationError, match="extra"):
        type(case("priority_trap")).model_validate(data)
    del data["extra"]
    data["groups"][0]["group_id"] = " "
    with pytest.raises(ValidationError, match="group_id"):
        type(case("priority_trap")).model_validate(data)
