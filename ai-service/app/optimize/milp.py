import math
from time import monotonic

from ortools.linear_solver import pywraplp

from app.optimize.evaluate import evaluate_allocation
from app.optimize.settings import MilpSettings
from app.optimize.staffing import (
    Allocation,
    L,
    PhaseSummary,
    SolveResult,
    StaffingScenario,
    validate_scenario,
)


def _build_model(scenario):
    validate_scenario(scenario)
    groups = {g.group_id: g for g in scenario.groups}
    needs = {n.need_id: n for n in scenario.needs}
    upper = {
        (a.group_id, a.need_id): (
            min(groups[a.group_id].available_people, needs[a.need_id].max_people)
            if needs[a.need_id].role_id in groups[a.group_id].skills
            else 0
        )
        for a in scenario.arcs
    }
    for n in scenario.needs:
        coverage = sum(
            groups[g].hours_per_person * u
            for (g, id), u in upper.items()
            if id == n.need_id
        )
        if (
            max(
                2 * n.demand_hours,
                n.demand_hours + coverage + max(0, coverage - n.demand_hours),
            )
            > L
        ):
            raise ValueError(f"MILP_ENVELOPE:{n.need_id}")
    solver = pywraplp.Solver.CreateSolver("SCIP")
    if solver is None:
        return None
    cells = {key: solver.IntVar(0, u, f"{key[0]}:{key[1]}") for key, u in upper.items()}
    for g in scenario.groups:
        solver.Add(
            sum(v for (id, _), v in cells.items() if id == g.group_id)
            <= g.available_people
        )
    unmet, binary = {}, {}
    for n in scenario.needs:
        count = sum(v for (_, id), v in cells.items() if id == n.need_id)
        solver.Add(count >= n.min_people)
        solver.Add(count <= n.max_people)
        coverage = sum(
            groups[g].hours_per_person * v
            for (g, id), v in cells.items()
            if id == n.need_id
        )
        cap = sum(
            groups[g].hours_per_person * u
            for (g, id), u in upper.items()
            if id == n.need_id
        )
        u = solver.IntVar(0, n.demand_hours, f"u:{n.need_id}")
        z = solver.BoolVar(f"z:{n.need_id}")
        unmet[n.need_id], binary[n.need_id] = u, z
        solver.Add(u >= n.demand_hours - coverage)
        solver.Add(u <= n.demand_hours * z)
        solver.Add(
            u <= n.demand_hours - coverage + max(0, cap - n.demand_hours) * (1 - z)
        )
    for lock in scenario.locked_allocations:
        solver.Add(cells[lock.group_id, lock.need_id] == lock.people)
    cost = sum(a.cost_vnd * cells[a.group_id, a.need_id] for a in scenario.arcs)
    solver.Add(cost <= scenario.budget_vnd)
    health = sum(n.priority * unmet[n.need_id] for n in scenario.needs)
    return solver, cells, unmet, binary, health, cost


def _read_solution(scenario, solver, cells, unmet, settings, phase, locked_health):
    variables = solver.variables()
    values = {v.index(): v.solution_value() for v in variables}
    rounded = {}
    for v in variables:
        value = values[v.index()]
        if (
            not math.isfinite(value)
            or value < v.lb() - settings.feasibility_tolerance
            or value > v.ub() + settings.feasibility_tolerance
        ):
            raise ValueError("non-finite/out-of-domain variable")
        integer = round(value)
        if (
            abs(value - integer) > settings.integrality_tolerance
            or not v.lb() <= integer <= v.ub()
        ):
            raise ValueError("non-integral variable")
        rounded[v.index()] = integer
    for row in solver.constraints():
        lhs = sum(row.GetCoefficient(v) * values[v.index()] for v in variables)
        exact = sum(int(row.GetCoefficient(v)) * rounded[v.index()] for v in variables)
        if (
            lhs < row.lb() - settings.feasibility_tolerance
            or lhs > row.ub() + settings.feasibility_tolerance
            or not row.lb() <= exact <= row.ub()
        ):
            raise ValueError("row residual")
    groups = {g.group_id: g for g in scenario.groups}
    for n in scenario.needs:
        coverage = sum(
            groups[g].hours_per_person * values[v.index()]
            for (g, id), v in cells.items()
            if id == n.need_id
        )
        exact_coverage = sum(
            groups[g].hours_per_person * rounded[v.index()]
            for (g, id), v in cells.items()
            if id == n.need_id
        )
        if (
            abs(values[unmet[n.need_id].index()] - max(0, n.demand_hours - coverage))
            > settings.feasibility_tolerance
        ):
            raise ValueError("raw shortfall")
        if rounded[unmet[n.need_id].index()] != max(0, n.demand_hours - exact_coverage):
            raise ValueError("integer shortfall")
    allocations = [
        Allocation(group_id=g, need_id=n, people=rounded[v.index()])
        for (g, n), v in cells.items()
        if rounded[v.index()]
    ]
    evaluation = evaluate_allocation(scenario, allocations)
    if not evaluation.feasible or (
        locked_health is not None
        and evaluation.score.weighted_unmet_hours != locked_health
    ):
        raise ValueError("allocation/health lock")
    objective = (
        evaluation.score.weighted_unmet_hours
        if phase == 0
        else evaluation.score.total_cost_vnd
    )
    raw_objective = solver.Objective().Value()
    if (
        not math.isfinite(raw_objective)
        or abs(raw_objective - objective) > settings.objective_tolerance
    ):
        raise ValueError("objective residual")
    return allocations, evaluation


def solve_staffing(
    scenario: StaffingScenario,
    time_limit_s: float,
    seed: int,
    *,
    settings: MilpSettings,
) -> SolveResult:
    start = monotonic()
    if (
        isinstance(time_limit_s, bool)
        or not isinstance(time_limit_s, (int, float))
        or not math.isfinite(time_limit_s)
        or time_limit_s <= 0
    ):
        raise ValueError("time_limit_s")
    if type(seed) is not int or not 0 <= seed <= 2**31 - 1:
        raise ValueError("seed")
    settings = MilpSettings.model_validate(settings.model_dump())
    validate_scenario(scenario)
    deadline = start + time_limit_s
    phases = [
        PhaseSummary(
            objective_name=name,
            tolerance={
                "absolute": settings.absolute_gap_limit,
                "relative": settings.relative_gap_limit,
            },
        )
        for name in ["weighted_unmet_hours", "total_cost_vnd"]
    ]
    status, code = "UNKNOWN", None
    allocations = evaluation = None
    metadata = {
        "requested_settings": settings.model_dump(),
        "accepted_parameters": None,
        "backend_version": None,
    }
    solver = None
    raw_names = {
        pywraplp.Solver.OPTIMAL: "OPTIMAL",
        pywraplp.Solver.FEASIBLE: "FEASIBLE",
        pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
        pywraplp.Solver.NOT_SOLVED: "NOT_SOLVED",
        pywraplp.Solver.MODEL_INVALID: "MODEL_INVALID",
        pywraplp.Solver.UNBOUNDED: "UNBOUNDED",
        pywraplp.Solver.ABNORMAL: "ABNORMAL",
    }
    for index, phase in enumerate(phases):
        if monotonic() >= deadline:
            break
        phase_start = monotonic()
        locked = (
            evaluation.score.weighted_unmet_hours if evaluation is not None else None
        )
        if index == 1:
            phase.first_feasible_observation = "validated_initial"
            phase.time_to_first_feasible_s = 0.0
            phase.objective_value = evaluation.score.total_cost_vnd
        try:
            if index == 0:
                built = _build_model(scenario)
                if built is None:
                    status, phase.status, code = (
                        "ERROR",
                        "ERROR",
                        "BACKEND_CONFIGURATION",
                    )
                    break
                solver, cells, unmet, _, health, cost = built
                parameters = (
                    f"numerics/feastol = {settings.feasibility_tolerance}\nlimits/gap = {settings.relative_gap_limit}\n"
                    f"limits/absgap = {settings.absolute_gap_limit}\nrandomization/randomseedshift = {seed}"
                )
                metadata["backend_version"] = solver.SolverVersion()
                if not solver.SetNumThreads(
                    settings.threads
                ) or not solver.SetSolverSpecificParametersAsString(parameters):
                    status, phase.status, code = (
                        "ERROR",
                        "ERROR",
                        "BACKEND_CONFIGURATION",
                    )
                    break
                metadata["accepted_parameters"] = parameters
                solver.Minimize(health)
            else:
                solver.Add(health == locked)
                solver.Minimize(cost)
            remaining_ms = int((deadline - monotonic()) * 1000)
            if remaining_ms < 1:
                break
            solver.SetTimeLimit(remaining_ms)
            raw = solver.Solve()
            phase.raw_status = raw_names.get(raw, str(raw))
            if raw in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
                try:
                    candidate, check = _read_solution(
                        scenario, solver, cells, unmet, settings, index, locked
                    )
                except ValueError:
                    status, phase.status, code = (
                        "ERROR",
                        "ERROR",
                        "NUMERICAL_VALIDATION",
                    )
                    break
                if evaluation is None or (
                    check.score.weighted_unmet_hours,
                    check.score.total_cost_vnd,
                ) < (
                    evaluation.score.weighted_unmet_hours,
                    evaluation.score.total_cost_vnd,
                ):
                    allocations, evaluation = candidate, check
                phase.objective_value = (
                    evaluation.score.weighted_unmet_hours
                    if index == 0
                    else evaluation.score.total_cost_vnd
                )
                bound = solver.Objective().BestBound()
                phase.best_bound = bound if math.isfinite(bound) else None
                if index == 0:
                    phase.first_feasible_observation = "final_only"
                status = phase.status = "FEASIBLE"
            elif raw == pywraplp.Solver.NOT_SOLVED:
                status = phase.status = (
                    "FEASIBLE" if allocations is not None else "UNKNOWN"
                )
            elif raw == pywraplp.Solver.INFEASIBLE:
                status = phase.status = (
                    "ERROR" if allocations is not None else "INFEASIBLE"
                )
                if allocations is not None:
                    code = "PHASE2_INFEASIBLE_AFTER_VALID_INCUMBENT"
            elif raw == pywraplp.Solver.MODEL_INVALID:
                status = phase.status = "MODEL_INVALID"
                code = "BACKEND_MODEL_INVALID"
            else:
                status = phase.status = "ERROR"
                code = (
                    "UNEXPECTED_UNBOUNDED"
                    if raw == pywraplp.Solver.UNBOUNDED
                    else "BACKEND_ERROR"
                )
        except (RuntimeError, ValueError, TypeError, OverflowError) as exc:
            if isinstance(exc, ValueError) and str(exc).startswith("MILP_ENVELOPE:"):
                raise
            status = phase.status = "ERROR"
            code = "BACKEND_ERROR"
            phase.raw_status = type(exc).__name__
        finally:
            if phase.status != "NOT_RUN":
                phase.runtime_s = monotonic() - phase_start
        if allocations is None or status in ("ERROR", "MODEL_INVALID"):
            break
    if allocations is not None:
        final = evaluate_allocation(scenario, allocations)
        if not final.feasible:
            status, code = "ERROR", "INVALID_FINAL_ALLOCATION"
        evaluation = final
    runtime = monotonic() - start
    return SolveResult(
        solver_name="scip",
        status=status,
        allocations=allocations,
        evaluation=evaluation,
        phases=phases,
        runtime_s=runtime,
        time_limit_s=float(time_limit_s),
        deadline_exceeded=runtime > time_limit_s,
        time_to_first_feasible_s=None,
        first_feasible_observation="final_only" if allocations is not None else "none",
        seed=seed,
        error_code=code,
        solver_metadata=metadata,
    )
