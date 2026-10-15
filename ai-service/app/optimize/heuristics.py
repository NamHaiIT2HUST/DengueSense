import math
import random
from time import monotonic

from app.optimize.evaluate import evaluate_allocation
from app.optimize.settings import HeuristicSettings
from app.optimize.staffing import (
    Allocation,
    L,
    PhaseSummary,
    SolveResult,
    StaffingScenario,
)


def _inverse(move):
    return tuple((key, -delta) for key, delta in move)


def _moves(scenario, counts, deadline=None):
    keys = sorted((a.group_id, a.need_id) for a in scenario.arcs)
    locked = {(a.group_id, a.need_id) for a in scenario.locked_allocations}
    free = [key for key in keys if key not in locked]
    occupied = [key for key in free if counts.get(key, 0) > 0]
    moves = set()
    for key in free:
        if deadline is not None and monotonic() >= deadline:
            return None
        moves.add(((key, 1),))
        if counts.get(key, 0) > 0:
            moves.add(((key, -1),))
    for source in occupied:
        for target in free:
            if deadline is not None and monotonic() >= deadline:
                return None
            if source != target:
                moves.add(tuple(sorted(((source, -1), (target, 1)))))
    for i, (g1, n1) in enumerate(occupied):
        for g2, n2 in occupied[i + 1 :]:
            if deadline is not None and monotonic() >= deadline:
                return None
            a, b = (g1, n2), (g2, n1)
            if g1 != g2 and n1 != n2 and a in free and b in free:
                moves.add(
                    tuple(sorted((((g1, n1), -1), ((g2, n2), -1), (a, 1), (b, 1))))
                )
    return sorted(moves)


def _apply(scenario, counts, move):
    candidate = counts.copy()
    for key, delta in move:
        candidate[key] = candidate.get(key, 0) + delta
        if not 0 <= candidate[key] <= L:
            return None
    rows = [
        Allocation(group_id=g, need_id=n, people=people)
        for (g, n), people in sorted(candidate.items())
        if people
    ]
    result = evaluate_allocation(scenario, rows)
    return (candidate, rows, result) if result.feasible else None


def _accept(delta, temperature, random_value):
    return delta <= 0 or random_value < math.exp(-delta / temperature)


def _search(scenario, initial, time_limit_s, seed, settings, max_steps, method):
    start = monotonic()
    step_mode = time_limit_s is None
    if step_mode:
        if type(max_steps) is not int or not 0 < max_steps <= L:
            raise ValueError("max_steps")
    elif (
        max_steps is not None
        or isinstance(time_limit_s, bool)
        or not isinstance(time_limit_s, (int, float))
        or not math.isfinite(time_limit_s)
        or time_limit_s <= 0
    ):
        raise ValueError("time_limit_s/max_steps")
    if type(seed) is not int or not 0 <= seed <= 2**31 - 1:
        raise ValueError("seed")
    settings = HeuristicSettings.model_validate(settings.model_dump())
    evaluation = evaluate_allocation(scenario, initial)
    if not evaluation.feasible:
        raise ValueError("INITIAL:" + ",".join(evaluation.violations))
    first = monotonic() - start
    best_rows = list(initial)
    best_eval = evaluation
    rng = random.Random(seed)
    deadline = None if step_mode else start + time_limit_s
    phases = [
        PhaseSummary(objective_name=name)
        for name in ["weighted_unmet_hours", "total_cost_vnd"]
    ]
    steps = 0
    health_steps = (
        math.floor(settings.health_fraction * max_steps) if step_mode else None
    )
    for index, phase in enumerate(phases):
        phase_start = monotonic()
        if not step_mode and phase_start >= deadline:
            break
        budget = (
            health_steps
            if index == 0
            else max_steps - health_steps if step_mode else None
        )
        if step_mode and budget == 0:
            continue
        phase_deadline = (
            None
            if step_mode
            else (
                phase_start + settings.health_fraction * (deadline - phase_start)
                if index == 0
                else deadline
            )
        )
        locked_health = best_eval.score.weighted_unmet_hours
        current = {(a.group_id, a.need_id): a.people for a in best_rows}
        current_eval = best_eval
        temperature = max(
            settings.min_temperature,
            settings.initial_temperature_fraction
            * (
                current_eval.score.weighted_unmet_hours
                if index == 0
                else current_eval.score.total_cost_vnd
            ),
        )
        phase_steps = 0
        accepted = 0
        stagnation = 0
        tabu = {}
        phase.status = "FEASIBLE"
        phase.first_feasible_observation = "validated_initial"
        phase.time_to_first_feasible_s = 0.0
        while phase_steps < budget if step_mode else monotonic() < phase_deadline:
            moves = _moves(scenario, current, phase_deadline)
            if not moves:
                break
            rng.shuffle(moves)
            cap = (
                min(settings.candidate_batch_size, budget - phase_steps)
                if step_mode
                else settings.candidate_batch_size
            )
            candidates = []
            interrupted = False
            for move in moves[:cap]:
                if not step_mode and monotonic() >= phase_deadline:
                    interrupted = True
                    break
                phase_steps += 1
                steps += 1
                candidate = _apply(scenario, current, move)
                if candidate is None:
                    continue
                counts, rows, check = candidate
                if index == 1 and check.score.weighted_unmet_hours != locked_health:
                    continue
                score = (check.score.weighted_unmet_hours, check.score.total_cost_vnd)
                best_score = (
                    best_eval.score.weighted_unmet_hours,
                    best_eval.score.total_cost_vnd,
                )
                if (
                    method == "tabu"
                    and tabu.get(move, -1) > accepted
                    and score >= best_score
                ):
                    continue
                candidates.append((move, counts, rows, check))
                if method == "sa":
                    break
            if interrupted:
                break
            if not candidates:
                continue
            if method == "sa":
                selected = candidates[0]
                check = selected[3]
                delta = (
                    (
                        check.score.weighted_unmet_hours
                        - current_eval.score.weighted_unmet_hours
                    )
                    if index == 0
                    else check.score.total_cost_vnd - current_eval.score.total_cost_vnd
                )
                take = _accept(delta, temperature, rng.random())
                temperature = max(
                    settings.min_temperature, temperature * settings.cooling_rate
                )
                if not take:
                    continue
            else:
                if stagnation >= settings.diversify_after:
                    selected = rng.choice(candidates)
                    stagnation = 0
                else:
                    selected = min(
                        candidates,
                        key=lambda c: (
                            (
                                c[3].score.weighted_unmet_hours,
                                c[3].score.total_cost_vnd,
                                c[0],
                            )
                            if index == 0
                            else (
                                c[3].score.total_cost_vnd,
                                c[3].score.weighted_unmet_hours,
                                c[0],
                            )
                        ),
                    )
            move, current, rows, current_eval = selected
            accepted += 1
            if method == "tabu":
                tabu[_inverse(move)] = accepted + settings.tabu_tenure
            if (
                current_eval.score.weighted_unmet_hours,
                current_eval.score.total_cost_vnd,
            ) < (best_eval.score.weighted_unmet_hours, best_eval.score.total_cost_vnd):
                best_rows, best_eval = rows, current_eval
                stagnation = 0
            else:
                stagnation += 1
        phase.objective_value = (
            best_eval.score.weighted_unmet_hours
            if index == 0
            else best_eval.score.total_cost_vnd
        )
        phase.runtime_s = monotonic() - phase_start
    final = evaluate_allocation(scenario, best_rows)
    runtime = monotonic() - start
    return SolveResult(
        solver_name=method,
        status="FEASIBLE",
        allocations=best_rows,
        evaluation=final,
        phases=phases,
        runtime_s=runtime,
        time_limit_s=None if step_mode else float(time_limit_s),
        deadline_exceeded=False if step_mode else runtime > time_limit_s,
        time_to_first_feasible_s=first,
        first_feasible_observation="validated_initial",
        seed=seed,
        search_steps=steps,
        solver_metadata={
            "requested_settings": settings.model_dump(),
            "first_feasible_at_s": start + first,
        },
    )


def improve_sa(
    scenario: StaffingScenario,
    initial: list[Allocation],
    time_limit_s: float | None,
    seed: int,
    *,
    settings: HeuristicSettings,
    max_steps: int | None = None
) -> SolveResult:
    return _search(scenario, initial, time_limit_s, seed, settings, max_steps, "sa")


def improve_tabu(
    scenario: StaffingScenario,
    initial: list[Allocation],
    time_limit_s: float | None,
    seed: int,
    *,
    settings: HeuristicSettings,
    max_steps: int | None = None
) -> SolveResult:
    return _search(scenario, initial, time_limit_s, seed, settings, max_steps, "tabu")
