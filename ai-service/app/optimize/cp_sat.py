import math
from time import monotonic

from ortools.sat.python import cp_model

from app.optimize.evaluate import evaluate_allocation
from app.optimize.staffing import (
    Allocation,
    PhaseSummary,
    SeedSearchSummary,
    SolveResult,
    StaffingScenario,
    integer_lower_bound,
    validate_scenario,
)


def _build_model(scenario):
    model = cp_model.CpModel()
    groups = {g.group_id: g for g in scenario.groups}
    needs = {n.need_id: n for n in scenario.needs}
    cells = {}
    for a in scenario.arcs:
        g, n = groups[a.group_id], needs[a.need_id]
        upper = min(g.available_people, n.max_people) if n.role_id in g.skills else 0
        cells[a.group_id, a.need_id] = model.new_int_var(
            0, upper, f"{a.group_id}:{a.need_id}"
        )
    for g in scenario.groups:
        model.add(
            sum(v for (id, _), v in cells.items() if id == g.group_id)
            <= g.available_people
        )
    shortfalls = {}
    for n in scenario.needs:
        count = sum(v for (_, id), v in cells.items() if id == n.need_id)
        model.add(count >= n.min_people)
        model.add(count <= n.max_people)
        coverage = sum(
            groups[g].hours_per_person * v
            for (g, id), v in cells.items()
            if id == n.need_id
        )
        shortfall = model.new_int_var(0, n.demand_hours, f"shortfall:{n.need_id}")
        model.add_max_equality(shortfall, [0, n.demand_hours - coverage])
        shortfalls[n.need_id] = shortfall
    for lock in scenario.locked_allocations:
        model.add(cells[lock.group_id, lock.need_id] == lock.people)
    cost = sum(a.cost_vnd * cells[a.group_id, a.need_id] for a in scenario.arcs)
    model.add(cost <= scenario.budget_vnd)
    health = sum(n.priority * shortfalls[n.need_id] for n in scenario.needs)
    return model, cells, health, cost


def _solve(scenario, time_limit_s, seed, feasibility_only):
    start = monotonic()
    if (
        isinstance(time_limit_s, bool)
        or not isinstance(time_limit_s, (int, float))
        or not math.isfinite(time_limit_s)
        or time_limit_s <= 0
    ):
        raise ValueError("time_limit_s: expected finite positive number")
    if type(seed) is not int or not 0 <= seed <= 2**31 - 1:
        raise ValueError("seed: expected integer in [0, 2**31-1]")
    deadline = start + time_limit_s
    validate_scenario(scenario)
    names = (
        ["feasibility"]
        if feasibility_only
        else ["weighted_unmet_hours", "total_cost_vnd"]
    )
    phases = [PhaseSummary(objective_name=name) for name in names]
    incumbent = None
    evaluation = None
    first_time = None
    observation = "none"
    error_code = None
    status = "UNKNOWN"
    model = cells = health = cost = None

    def score_key(value):
        return value.score.weighted_unmet_hours, value.score.total_cost_vnd

    def run_phase(index):
        nonlocal model, cells, health, cost, incumbent, evaluation, first_time, observation, error_code
        phase = phases[index]
        if monotonic() >= deadline:
            return "FEASIBLE" if incumbent is not None else "UNKNOWN"
        phase_start = monotonic()
        has_initial = incumbent is not None
        locked_health = evaluation.score.weighted_unmet_hours if has_initial else None
        if has_initial:
            phase.first_feasible_observation = "validated_initial"
            phase.time_to_first_feasible_s = 0.0
            phase.objective_value = evaluation.score.total_cost_vnd
        solver = None

        def accept(rows, candidate):
            nonlocal incumbent, evaluation, first_time, observation, error_code
            if not candidate.feasible:
                error_code = "INVALID_ALLOCATION"
                return False
            if index == 1 and candidate.score.weighted_unmet_hours != locked_health:
                error_code = "HEALTH_CHANGED"
                return False
            if incumbent is None or score_key(candidate) < score_key(evaluation):
                incumbent, evaluation = rows, candidate
            if not feasibility_only:
                phase.objective_value = (
                    evaluation.score.weighted_unmet_hours
                    if index == 0
                    else evaluation.score.total_cost_vnd
                )
            return True

        def read_rows(reader):
            return [
                Allocation(group_id=g, need_id=n, people=int(value))
                for (g, n), var in cells.items()
                if (value := reader.value(var))
            ]

        class Observer(cp_model.CpSolverSolutionCallback):
            def on_solution_callback(self):
                nonlocal first_time, observation, error_code
                try:
                    rows = read_rows(self)
                    if not accept(rows, evaluate_allocation(scenario, rows)):
                        self.stop_search()
                        return
                    now = monotonic()
                    if first_time is None and observation == "none":
                        first_time = now - start
                        observation = "callback"
                    if phase.first_feasible_observation == "none":
                        phase.time_to_first_feasible_s = now - phase_start
                        phase.first_feasible_observation = "callback"
                except (ValueError, RuntimeError, TypeError, OverflowError):
                    error_code = "CALLBACK_ERROR"
                    self.stop_search()

        try:
            if index == 0:
                model, cells, health, cost = _build_model(scenario)
                if not feasibility_only:
                    model.minimize(health)
            else:
                model.add(health == locked_health)
                model.minimize(cost)
                model.clear_hints()
                counts = {(a.group_id, a.need_id): a.people for a in incumbent}
                for key, var in cells.items():
                    model.add_hint(var, counts.get(key, 0))
            invalid = model.validate()
            if invalid:
                phase.status = "MODEL_INVALID"
                phase.raw_status = invalid
                error_code = "MODEL_VALIDATION_FAILED"
                return "MODEL_INVALID"
            remaining = deadline - monotonic()
            if remaining <= 0:
                return "FEASIBLE" if incumbent is not None else "UNKNOWN"
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = remaining
            solver.parameters.random_seed = seed
            solver.parameters.num_search_workers = 1
            solver.parameters.absolute_gap_limit = 0.0
            solver.parameters.relative_gap_limit = 0.0
            raw = solver.solve(model, Observer())
            phase.raw_status = solver.status_name(raw)
            if error_code:
                phase.status = "ERROR"
                return "ERROR"
            if raw in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                rows = read_rows(solver)
                candidate = evaluate_allocation(scenario, rows)
                if not candidate.feasible or (
                    index == 1 and candidate.score.weighted_unmet_hours != locked_health
                ):
                    error_code = (
                        "INVALID_ALLOCATION"
                        if not candidate.feasible
                        else "HEALTH_CHANGED"
                    )
                    phase.status = "ERROR"
                    return "ERROR"
                if observation == "none":
                    observation = "final_only"
                if phase.first_feasible_observation == "none":
                    phase.first_feasible_observation = "final_only"
                if not feasibility_only:
                    actual = (
                        candidate.score.weighted_unmet_hours
                        if index == 0
                        else candidate.score.total_cost_vnd
                    )
                    if solver.objective_value != actual:
                        error_code = "OBJECTIVE_MISMATCH"
                        phase.status = "ERROR"
                        return "ERROR"
                    best = (
                        candidate
                        if incumbent is None
                        or score_key(candidate) < score_key(evaluation)
                        else evaluation
                    )
                    value = (
                        best.score.weighted_unmet_hours
                        if index == 0
                        else best.score.total_cost_vnd
                    )
                    phase.objective_value = value
                    bound = solver.best_objective_bound
                    phase.best_bound = bound if math.isfinite(bound) else None
                    phase.integer_lower_bound = integer_lower_bound(bound)
                    lower = phase.integer_lower_bound
                    if lower is not None:
                        if lower > value:
                            error_code = "BOUND_INCONSISTENT"
                            phase.status = "ERROR"
                            return "ERROR"
                        phase.absolute_gap = value - lower
                        phase.relative_gap = phase.absolute_gap / max(1, abs(value))
                    phase.tolerance = {
                        "absolute": float(solver.parameters.absolute_gap_limit),
                        "relative": float(solver.parameters.relative_gap_limit),
                    }
                    zero_gap = raw == cp_model.OPTIMAL and not any(
                        phase.tolerance.values()
                    )
                    if zero_gap:
                        phase.proven_optimal = True
                        phase.proof_basis = "zero_gap_solver"
                    elif lower == value:
                        phase.proven_optimal = True
                        phase.proof_basis = "integer_bound"
                accept(rows, candidate)
                phase.status = "OPTIMAL" if phase.proven_optimal else "FEASIBLE"
            elif raw == cp_model.INFEASIBLE:
                if incumbent is not None:
                    error_code = (
                        "PHASE2_INFEASIBLE_AFTER_VALID_INCUMBENT"
                        if index
                        else "INFEASIBLE_AFTER_VALID_INCUMBENT"
                    )
                    phase.status = "ERROR"
                else:
                    phase.status = "INFEASIBLE"
            elif raw == cp_model.MODEL_INVALID:
                error_code = "BACKEND_MODEL_INVALID"
                phase.status = "MODEL_INVALID"
            elif raw == cp_model.UNKNOWN:
                phase.status = "FEASIBLE" if incumbent is not None else "UNKNOWN"
            else:
                error_code = "UNRECOGNIZED_STATUS"
                phase.status = "ERROR"
            return phase.status
        except (ValueError, RuntimeError, TypeError, OverflowError) as exc:
            phase.status = "ERROR"
            phase.raw_status = type(exc).__name__
            error_code = "BACKEND_ERROR"
            return "ERROR"
        finally:
            if phase.status != "NOT_RUN":
                phase.runtime_s = monotonic() - phase_start

    status = run_phase(0)
    if (
        not feasibility_only
        and incumbent is not None
        and status not in ("ERROR", "MODEL_INVALID")
    ):
        status = run_phase(1)
    proof = (
        not feasibility_only
        and all(p.proven_optimal for p in phases)
        and status not in ("ERROR", "MODEL_INVALID")
    )
    if status not in ("ERROR", "MODEL_INVALID", "INFEASIBLE"):
        status = (
            "OPTIMAL" if proof else "FEASIBLE" if incumbent is not None else "UNKNOWN"
        )
    if incumbent is not None:
        evaluation = evaluate_allocation(scenario, incumbent)
        if not evaluation.feasible:
            status, proof, error_code = "ERROR", False, "INVALID_FINAL_ALLOCATION"
    runtime = monotonic() - start
    seed_search = None
    if feasibility_only:
        seed_search = SeedSearchSummary(
            source="cp_sat_feasibility",
            status=status,
            runtime_s=runtime,
            time_to_first_feasible_s=first_time,
            first_feasible_observation=observation,
        )
    return SolveResult(
        solver_name="cp_sat",
        status=status,
        proven_optimal=proof,
        allocations=incumbent,
        evaluation=evaluation,
        phases=phases,
        runtime_s=runtime,
        time_limit_s=float(time_limit_s),
        deadline_exceeded=runtime > time_limit_s,
        time_to_first_feasible_s=first_time,
        first_feasible_observation=observation,
        seed_search=seed_search,
        seed=seed,
        error_code=error_code,
        solver_metadata={
            "first_feasible_at_s": (
                start + first_time if first_time is not None else None
            )
        },
    )


def solve_staffing(
    scenario: StaffingScenario, time_limit_s: float, seed: int
) -> SolveResult:
    return _solve(scenario, time_limit_s, seed, feasibility_only=False)


def find_feasible_seed(
    scenario: StaffingScenario, time_limit_s: float, seed: int
) -> SolveResult:
    return _solve(scenario, time_limit_s, seed, feasibility_only=True)
