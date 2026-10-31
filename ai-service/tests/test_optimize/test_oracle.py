import pytest

from app.optimize.cp_sat import solve_staffing
from app.optimize.tests.oracle import oracle


@pytest.mark.parametrize(
    "name,expected",
    [
        ("priority_trap", (8, 40)),
        ("cost_tie", (0, 10)),
        ("zero_cost", (0, 0)),
        ("locked_exact", (48, 30)),
        ("infeasible_floor", None),
    ],
)
def test_oracle_matches_cp_sat(case, name, expected):
    s = case(name)
    assert oracle(s) == expected
    result = solve_staffing(s, 5.0, 42)
    if expected is None:
        assert result.status == "INFEASIBLE"
    else:
        assert result.proven_optimal and result.evaluation.feasible
        assert (
            result.evaluation.score.weighted_unmet_hours,
            result.evaluation.score.total_cost_vnd,
        ) == expected


@pytest.mark.parametrize("budget", [0, 10, 20, 30, 40, 50])
@pytest.mark.parametrize("available", [0, 1, 2])
def test_small_budget_supply_variants(case, budget, available):
    s = case("priority_trap")
    s.budget_vnd = budget
    s.groups[0].total_people = available + 2
    expected = oracle(s)
    result = solve_staffing(s, 5.0, 42)
    assert result.proven_optimal
    assert (
        result.evaluation.score.weighted_unmet_hours,
        result.evaluation.score.total_cost_vnd,
    ) == expected


def test_zero_lock(case):
    s = case("locked_exact")
    s.locked_allocations[0].people = 0
    assert oracle(s) == (64, 10)
    result = solve_staffing(s, 5.0, 42)
    assert result.proven_optimal
    assert (
        result.evaluation.score.weighted_unmet_hours,
        result.evaluation.score.total_cost_vnd,
    ) == (64, 10)
