import itertools
import math

from app.optimize.evaluate import evaluate_allocation
from app.optimize.staffing import Allocation


def oracle(scenario):
    groups = {g.group_id: g for g in scenario.groups}
    needs = {n.need_id: n for n in scenario.needs}
    bounds = [
        (
            min(groups[a.group_id].available_people, needs[a.need_id].max_people)
            if needs[a.need_id].role_id in groups[a.group_id].skills
            else 0
        )
        for a in scenario.arcs
    ]
    assert math.prod(u + 1 for u in bounds) <= 100000, "oracle candidate limit exceeded"
    best = None
    for vector in itertools.product(*(range(u + 1) for u in bounds)):
        rows = [
            Allocation(group_id=a.group_id, need_id=a.need_id, people=v)
            for a, v in zip(scenario.arcs, vector)
            if v
        ]
        result = evaluate_allocation(scenario, rows)
        if result.feasible:
            score = (result.score.weighted_unmet_hours, result.score.total_cost_vnd)
            if best is None or score < best:
                best = score
    return best
