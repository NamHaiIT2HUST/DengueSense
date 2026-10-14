from app.optimize.staffing import (
    Allocation,
    Evaluation,
    Score,
    StaffingScenario,
    validate_scenario,
)


def evaluate_allocation(
    scenario: StaffingScenario, allocations: list[Allocation]
) -> Evaluation:
    validate_scenario(scenario)
    groups = {g.group_id: g for g in scenario.groups}
    needs = {n.need_id: n for n in scenario.needs}
    arcs = {(a.group_id, a.need_id): a for a in scenario.arcs}
    assigned = {id: 0 for id in groups}
    people = {id: 0 for id in needs}
    hours = {id: 0 for id in needs}
    rows = {}
    violations = []
    cost = 0
    for a in allocations:
        Allocation.model_validate(a.model_dump())
        key = a.group_id, a.need_id
        if key in rows:
            violations.append(f"DUPLICATE_ASSIGNMENT:{a.group_id}:{a.need_id}")
        rows[key] = a.people
        if a.group_id not in groups or a.need_id not in needs:
            violations.append(f"REFERENCE:{a.group_id}:{a.need_id}")
            continue
        if key not in arcs:
            violations.append(f"ARC:{a.group_id}:{a.need_id}")
        elif a.people:
            cost += arcs[key].cost_vnd * a.people
        if a.people and needs[a.need_id].role_id not in groups[a.group_id].skills:
            violations.append(f"SKILL:{a.group_id}:{a.need_id}")
        assigned[a.group_id] += a.people
        people[a.need_id] += a.people
        hours[a.need_id] += groups[a.group_id].hours_per_person * a.people
    for g in scenario.groups:
        if assigned[g.group_id] > g.available_people:
            violations.append(f"SUPPLY:{g.group_id}")
    for n in scenario.needs:
        if people[n.need_id] < n.min_people:
            violations.append(f"FLOOR:{n.need_id}")
        if people[n.need_id] > n.max_people:
            violations.append(f"CAPACITY:{n.need_id}")
    for lock in scenario.locked_allocations:
        if rows.get((lock.group_id, lock.need_id), 0) != lock.people:
            violations.append(f"LOCK:{lock.group_id}:{lock.need_id}")
    if cost > scenario.budget_vnd:
        violations.append("BUDGET")
    if violations:
        return Evaluation(feasible=False, violations=violations, score=None)
    shortage = {
        n.need_id: max(0, n.demand_hours - hours[n.need_id]) for n in scenario.needs
    }
    return Evaluation(
        feasible=True,
        violations=[],
        score=Score(
            weighted_unmet_hours=sum(
                n.priority * shortage[n.need_id] for n in scenario.needs
            ),
            total_unmet_hours=sum(shortage.values()),
            total_cost_vnd=cost,
        ),
    )
