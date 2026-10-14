"""Layer 2 Resource Optimization Solvers (MILP, Simulated Annealing, Greedy Baseline).

Implements the Marginal Benefit Formulation (P2) using Google OR-Tools CP-SAT,
along with Metaheuristic (Simulated Annealing) and Baseline (Greedy P1) as
specified in docs/04-phuong-phap-toi-uu.md and presentation Slide 5.
"""

from __future__ import annotations

import math
import random
import time
from typing import Literal

from ortools.sat.python import cp_model

from .model import (
    OptimizationResult,
    OptimizedProvinceAllocation,
    OptimizeItemInput,
    ResourceCostConfig,
)


def _calculate_cases_prevented(
    cases_pred: float, beds: int, supplies: int, teams: int
) -> float:
    """Calculate cases prevented using concave diminishing returns function:

    ΔCases = Cases_pred * e_i * (1 - exp(-k * intensity))
    """
    if cases_pred <= 0:
        return 0.0
    intensity = 3.0 * beds + 1.0 * supplies + 8.0 * teams
    if intensity <= 0:
        return 0.0
    # Diminishing returns: maximum prevention rate is 45% of predicted cases
    factor = 1.0 - math.exp(-0.035 * intensity)
    return round(cases_pred * 0.45 * factor, 1)


def _generate_explanation(
    province_id: str,
    cases_pred: float,
    beds: int,
    supplies: int,
    teams: int,
    amount: float,
    cases_prevented: float,
) -> str:
    """Generate professional epidemiological rationale for allocated resources."""
    return (
        f"Dự báo {cases_pred:,.0f} ca. Phân bổ tối ưu: {beds} giường dã chiến, "
        f"{supplies * 20}L Cloramin B (kèm {max(1, supplies // 5)} máy phun ULV), "
        f"{teams} đội cơ động. Dự kiến giảm thiểu {cases_prevented:,.0f} ca mắc."
    )


def solve_milp_marginal(
    items: list[OptimizeItemInput],
    budget: float,
    cost_config: ResourceCostConfig | None = None,
) -> OptimizationResult:
    """Solve the multi-resource allocation problem with concave diminishing marginal returns

    using Google OR-Tools CP-SAT (Mixed Integer Linear/Constraint Programming).
    """
    start_time = time.perf_counter()
    cfg = cost_config or ResourceCostConfig()

    if not items or budget <= 0:
        return OptimizationResult(
            budget=budget,
            total_cost=0.0,
            estimated_cases_prevented=0.0,
            allocations=[],
            algorithm="MILP (Google OR-Tools CP-SAT)",
            solve_time_ms=0.0,
            is_optimal=True,
            strategy="milp_marginal",
        )

    model = cp_model.CpModel()

    bed_vars = []
    sup_vars = []
    team_vars = []
    tier1_vars = []
    tier2_vars = []
    tier3_vars = []

    cost_scale = (
        1_000_000  # Scale down large currency amounts to avoid integer overflow
    )
    scaled_budget = int(budget // cost_scale)
    c_bed = int(cfg.cost_per_bed // cost_scale)
    c_sup = int(cfg.cost_per_supply_unit // cost_scale)
    c_team = int(cfg.cost_per_team // cost_scale)

    item_costs = []

    for i, it in enumerate(items):
        max_b = min(80, max(0, int(it.cases_pred * 0.3)))
        max_s = min(200, max(0, int(it.cases_pred * 0.8)))
        max_t = min(10, max(0, int(it.cases_pred * 0.05) + 1))

        b = model.NewIntVar(0, max_b, f"beds_{i}")
        s = model.NewIntVar(0, max_s, f"supplies_{i}")
        t = model.NewIntVar(0, max_t, f"teams_{i}")

        bed_vars.append(b)
        sup_vars.append(s)
        team_vars.append(t)

        # Floor equity constraints for high-risk provinces
        if it.cases_pred >= 250 or it.is_high_risk:
            model.Add(t >= 1)
            model.Add(s >= 5)

        # Cost expression
        cost_i = model.NewIntVar(0, scaled_budget, f"cost_{i}")
        model.Add(cost_i == c_bed * b + c_sup * s + c_team * t)
        item_costs.append(cost_i)

        # Piecewise linear concave marginal benefit approximation
        # intensity = 2 * b + 1 * s + 5 * t
        z = model.NewIntVar(0, 1000, f"z_{i}")
        model.Add(z == 2 * b + s + 5 * t)

        z1 = model.NewIntVar(0, 15, f"z1_{i}")
        z2 = model.NewIntVar(0, 35, f"z2_{i}")
        z3 = model.NewIntVar(0, 500, f"z3_{i}")

        model.Add(z == z1 + z2 + z3)
        tier1_vars.append(z1)
        tier2_vars.append(z2)
        tier3_vars.append(z3)

    # Global budget constraint
    model.Add(sum(item_costs) <= scaled_budget)

    # Objective: Maximize total marginal cases prevented
    # Slope of tier1 (high marginal benefit), tier2 (moderate), tier3 (diminishing)
    obj_terms = []
    for i, it in enumerate(items):
        weight = max(1, int(it.cases_pred))
        # 4x for tier1, 2x for tier2, 1x for tier3
        obj_terms.append(
            weight * (4 * tier1_vars[i] + 2 * tier2_vars[i] + tier3_vars[i])
        )

    model.Maximize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    status = solver.Solve(model)

    solve_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
    is_optimal = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

    allocations: list[OptimizedProvinceAllocation] = []
    total_cost = 0.0
    total_prevented = 0.0

    for i, it in enumerate(items):
        if is_optimal:
            b_val = solver.Value(bed_vars[i])
            s_val = solver.Value(sup_vars[i])
            t_val = solver.Value(team_vars[i])
        else:
            b_val, s_val, t_val = 0, 0, 0

        p_cost = (
            b_val * cfg.cost_per_bed
            + s_val * cfg.cost_per_supply_unit
            + t_val * cfg.cost_per_team
        )
        prevented = _calculate_cases_prevented(it.cases_pred, b_val, s_val, t_val)

        if p_cost > 0 or it.cases_pred > 0:
            explanation = _generate_explanation(
                it.province_id, it.cases_pred, b_val, s_val, t_val, p_cost, prevented
            )
            allocations.append(
                OptimizedProvinceAllocation(
                    province_id=it.province_id,
                    amount=p_cost,
                    beds=b_val,
                    supplies=s_val,
                    teams=t_val,
                    cases_prevented=prevented,
                    explanation=explanation,
                )
            )
            total_cost += p_cost
            total_prevented += prevented

    # Sort allocations by amount descending
    allocations.sort(key=lambda a: a.amount, reverse=True)

    return OptimizationResult(
        budget=budget,
        total_cost=total_cost,
        estimated_cases_prevented=round(total_prevented, 1),
        allocations=allocations,
        algorithm="MILP (Google OR-Tools CP-SAT)",
        solve_time_ms=solve_time_ms,
        is_optimal=is_optimal,
        strategy="milp_marginal",
    )


def solve_simulated_annealing(
    items: list[OptimizeItemInput],
    budget: float,
    cost_config: ResourceCostConfig | None = None,
    max_iterations: int = 1500,
) -> OptimizationResult:
    """Solve using Simulated Annealing metaheuristic (Slide 5 specification)."""
    start_time = time.perf_counter()
    cfg = cost_config or ResourceCostConfig()

    if not items or budget <= 0:
        return OptimizationResult(
            budget=budget,
            total_cost=0.0,
            estimated_cases_prevented=0.0,
            allocations=[],
            algorithm="Simulated Annealing (Metaheuristic)",
            solve_time_ms=0.0,
            is_optimal=True,
            strategy="simulated_annealing",
        )

    # Initial state
    current_state = {it.province_id: [0, 0, 0] for it in items}

    def calc_state(state: dict[str, list[int]]) -> tuple[float, float]:
        cost = 0.0
        prevented = 0.0
        for it in items:
            b, s, t = state[it.province_id]
            cost += (
                b * cfg.cost_per_bed
                + s * cfg.cost_per_supply_unit
                + t * cfg.cost_per_team
            )
            prevented += _calculate_cases_prevented(it.cases_pred, b, s, t)
        return cost, prevented

    current_cost, current_score = calc_state(current_state)
    best_state = {k: list(v) for k, v in current_state.items()}
    best_cost, best_score = current_cost, current_score

    temp = 100.0
    cooling_rate = 0.992

    for _ in range(max_iterations):
        it = random.choice(items)
        pid = it.province_id
        res_idx = random.randint(0, 2)
        delta = 1 if random.random() < 0.6 else -1

        new_val = max(0, current_state[pid][res_idx] + delta)
        old_val = current_state[pid][res_idx]
        current_state[pid][res_idx] = new_val

        cost, score = calc_state(current_state)
        if cost <= budget and (
            score > current_score
            or math.exp((score - current_score) / max(temp, 1e-4)) > random.random()
        ):
            current_score = score
            current_cost = cost
            if score > best_score:
                best_score = score
                best_cost = cost
                best_state = {k: list(v) for k, v in current_state.items()}
        else:
            current_state[pid][res_idx] = old_val

        temp *= cooling_rate

    solve_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

    allocations: list[OptimizedProvinceAllocation] = []
    for it in items:
        b, s, t = best_state[it.province_id]
        p_cost = (
            b * cfg.cost_per_bed + s * cfg.cost_per_supply_unit + t * cfg.cost_per_team
        )
        prevented = _calculate_cases_prevented(it.cases_pred, b, s, t)
        if p_cost > 0 or it.cases_pred > 0:
            allocations.append(
                OptimizedProvinceAllocation(
                    province_id=it.province_id,
                    amount=p_cost,
                    beds=b,
                    supplies=s,
                    teams=t,
                    cases_prevented=prevented,
                    explanation=_generate_explanation(
                        it.province_id, it.cases_pred, b, s, t, p_cost, prevented
                    ),
                )
            )

    allocations.sort(key=lambda a: a.amount, reverse=True)

    return OptimizationResult(
        budget=budget,
        total_cost=best_cost,
        estimated_cases_prevented=round(best_score, 1),
        allocations=allocations,
        algorithm="Simulated Annealing (Metaheuristic)",
        solve_time_ms=solve_time_ms,
        is_optimal=False,
        strategy="simulated_annealing",
    )


def solve_greedy_baseline(
    items: list[OptimizeItemInput],
    budget: float,
    cost_config: ResourceCostConfig | None = None,
) -> OptimizationResult:
    """P1 Greedy Baseline: ranks provinces by risk score / predicted cases (docs/04 comparator)."""
    start_time = time.perf_counter()
    cfg = cost_config or ResourceCostConfig()

    sorted_items = sorted(items, key=lambda x: x.cases_pred, reverse=True)
    allocations = []
    total_cost = 0.0
    total_prevented = 0.0

    for it in sorted_items:
        # Fixed package per province in greedy baseline
        beds = min(30, int(it.cases_pred * 0.15))
        supplies = min(100, int(it.cases_pred * 0.5))
        teams = min(4, int(it.cases_pred * 0.03) + 1)
        cost = (
            beds * cfg.cost_per_bed
            + supplies * cfg.cost_per_supply_unit
            + teams * cfg.cost_per_team
        )

        if total_cost + cost <= budget and cost > 0:
            prevented = _calculate_cases_prevented(it.cases_pred, beds, supplies, teams)
            allocations.append(
                OptimizedProvinceAllocation(
                    province_id=it.province_id,
                    amount=cost,
                    beds=beds,
                    supplies=supplies,
                    teams=teams,
                    cases_prevented=prevented,
                    explanation=_generate_explanation(
                        it.province_id,
                        it.cases_pred,
                        beds,
                        supplies,
                        teams,
                        cost,
                        prevented,
                    ),
                )
            )
            total_cost += cost
            total_prevented += prevented

    return OptimizationResult(
        budget=budget,
        total_cost=total_cost,
        estimated_cases_prevented=round(total_prevented, 1),
        allocations=allocations,
        algorithm="Greedy Risk-Ranking Baseline (P1)",
        solve_time_ms=round((time.perf_counter() - start_time) * 1000, 2),
        is_optimal=False,
        strategy="greedy_baseline",
    )


def optimize_allocation(
    items: list[OptimizeItemInput],
    budget: float,
    strategy: Literal[
        "milp_marginal", "simulated_annealing", "greedy_baseline"
    ] = "milp_marginal",
    cost_config: ResourceCostConfig | None = None,
) -> OptimizationResult:
    """Unified entrypoint for Layer 2 optimization."""
    if strategy == "simulated_annealing":
        return solve_simulated_annealing(items, budget, cost_config)
    if strategy == "greedy_baseline":
        return solve_greedy_baseline(items, budget, cost_config)
    return solve_milp_marginal(items, budget, cost_config)
