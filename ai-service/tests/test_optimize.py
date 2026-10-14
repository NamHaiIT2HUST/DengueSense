"""Unit tests for Layer 2 Resource Optimization (MILP, Simulated Annealing, Greedy Baseline)."""

import pytest

from app.optimize import (
    OptimizeItemInput,
    optimize_allocation,
    solve_greedy_baseline,
    solve_milp_marginal,
    solve_simulated_annealing,
)


@pytest.fixture
def sample_items() -> list[OptimizeItemInput]:
    return [
        OptimizeItemInput(
            province_id="ho_chi_minh", cases_pred=650.0, is_high_risk=True
        ),
        OptimizeItemInput(province_id="an_giang", cases_pred=320.0, is_high_risk=True),
        OptimizeItemInput(province_id="dong_nai", cases_pred=210.0, is_high_risk=False),
        OptimizeItemInput(province_id="da_nang", cases_pred=140.0, is_high_risk=False),
        OptimizeItemInput(province_id="ha_noi", cases_pred=80.0, is_high_risk=False),
    ]


def test_milp_marginal_solves_under_budget(sample_items: list[OptimizeItemInput]):
    budget = 500_000_000.0  # 500 triệu VNĐ
    res = solve_milp_marginal(sample_items, budget)

    assert res.is_optimal is True
    assert res.total_cost <= budget
    assert res.estimated_cases_prevented > 0
    assert len(res.allocations) > 0
    assert res.algorithm.startswith("MILP")
    assert res.solve_time_ms < 1000.0  # Must solve in < 1 second

    # Top province should be allocated resources
    hcm = next((a for a in res.allocations if a.province_id == "ho_chi_minh"), None)
    assert hcm is not None
    assert hcm.teams >= 1
    assert hcm.supplies >= 5
    assert "TP" in hcm.explanation or "ca" in hcm.explanation


def test_milp_beats_greedy_baseline(sample_items: list[OptimizeItemInput]):
    budget = 400_000_000.0
    res_milp = solve_milp_marginal(sample_items, budget)
    res_greedy = solve_greedy_baseline(sample_items, budget)

    assert res_milp.total_cost <= budget
    assert res_greedy.total_cost <= budget
    # MILP marginal benefit formulation should prevent more or equal cases than naive greedy
    assert res_milp.estimated_cases_prevented >= res_greedy.estimated_cases_prevented


def test_simulated_annealing_metaheuristic(sample_items: list[OptimizeItemInput]):
    budget = 300_000_000.0
    res_sa = solve_simulated_annealing(sample_items, budget, max_iterations=200)

    assert res_sa.total_cost <= budget
    assert res_sa.estimated_cases_prevented > 0
    assert len(res_sa.allocations) > 0


def test_empty_or_zero_budget():
    res = optimize_allocation([], budget=100_000_000.0)
    assert res.total_cost == 0.0
    assert res.estimated_cases_prevented == 0.0

    items = [OptimizeItemInput(province_id="hcm", cases_pred=100.0)]
    res_zero = optimize_allocation(items, budget=0.0)
    assert res_zero.total_cost == 0.0
