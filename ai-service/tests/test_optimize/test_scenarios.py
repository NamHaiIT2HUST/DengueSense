from pathlib import Path

import pytest

from app.optimize.evaluate import evaluate_allocation
from app.optimize.scenarios import generate_scenarios
from app.optimize.staffing import validate_scenario


def profile(name="priority_trap"):
    return {
        "base_fixture": str(Path(__file__).parent / "fixtures" / f"{name}.json"),
        "replicas": 5,
        "demand_percent_choices": [50, 100, 150, 200],
        "budget_percent_choices": [0, 50, 100, 150],
        "available_percent_choices": [50, 100, 150],
        "source_refs": ["D08"],
        "assumption_ids": ["stress-v1"],
    }


def test_generate_repeatable():
    a = generate_scenarios(profile(), 42, 3)
    b = generate_scenarios(profile(), 42, 3)
    assert [s.model_dump() for s in a] == [s.model_dump() for s in b]
    assert len(a) == 3 and len(a[0].groups) == 10
    for s in a:
        validate_scenario(s)
        assert len({g.group_id for g in s.groups}) == 10
        assert len({g.source_site_id for g in s.groups}) == 10


def test_generated_data_never_claims_real():
    for s in generate_scenarios(profile(), 42, 2):
        assert s.data_source == "simulated" and not s.policy_verified
        assert "stress-v1" in s.assumption_ids
        assert s.source_refs == ["D08"]


def test_preserves_infeasible_locks_and_floor():
    p = profile("infeasible_floor")
    p.update(
        replicas=1,
        demand_percent_choices=[100],
        available_percent_choices=[50],
        budget_percent_choices=[0],
    )
    s = generate_scenarios(p, 42, 1)[0]
    assert s.needs[0].min_people == 3
    assert "FLOOR:N1-r0" in evaluate_allocation(s, []).violations


@pytest.mark.parametrize(
    "field,value",
    [
        ("replicas", True),
        ("replicas", 0),
        ("demand_percent_choices", []),
        ("available_percent_choices", [-1]),
        ("budget_percent_choices", [1.0]),
        ("assumption_ids", []),
    ],
)
def test_invalid_profile(field, value):
    p = profile()
    p[field] = value
    with pytest.raises(ValueError):
        generate_scenarios(p, 42, 1)


def test_zero_demand_and_cost():
    p = profile("zero_cost")
    p.update(replicas=1, demand_percent_choices=[0], budget_percent_choices=[0])
    s = generate_scenarios(p, 0, 1)[0]
    assert s.needs[0].demand_hours == 0 and s.budget_vnd == 0


def test_keeps_exact_locks():
    p = profile("locked_exact")
    p.update(replicas=2)
    s = generate_scenarios(p, 42, 1)[0]
    assert [(a.group_id, a.need_id, a.people) for a in s.locked_allocations] == [
        ("G1-r0", "N1-r0", 1),
        ("G1-r1", "N1-r1", 1),
    ]
