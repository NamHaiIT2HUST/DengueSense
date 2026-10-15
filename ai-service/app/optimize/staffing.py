import math
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

L = 2**53 - 1
Count = Annotated[int, Field(strict=True, ge=0, le=L)]
ID = Annotated[str, StringConstraints(strict=True, min_length=1, pattern=r"\S")]
Status = Literal[
    "OPTIMAL", "FEASIBLE", "INFEASIBLE", "UNKNOWN", "MODEL_INVALID", "ERROR"
]
Observation = Literal["callback", "validated_initial", "final_only", "none"]


class Record(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class StaffGroup(Record):
    group_id: ID
    source_site_id: ID
    skills: list[ID]
    total_people: Count
    committed_people: Count
    reserve_people: Count
    hours_per_person: Count

    @property
    def available_people(self) -> int:
        return self.total_people - self.committed_people - self.reserve_people


class StaffNeed(Record):
    need_id: ID
    site_id: ID
    role_id: ID
    demand_hours: Count
    priority: Count
    min_people: Count
    max_people: Count


class StaffArc(Record):
    group_id: ID
    need_id: ID
    cost_vnd: Count


class Allocation(Record):
    group_id: ID
    need_id: ID
    people: Count


class StaffingScenario(Record):
    schema_version: Literal["1"]
    scenario_id: ID
    scope_id: ID
    period_id: ID
    budget_vnd: Count
    groups: list[StaffGroup]
    needs: list[StaffNeed]
    arcs: list[StaffArc]
    locked_allocations: list[Allocation]
    data_source: Literal["simulated", "real"]
    policy_verified: bool
    assumption_ids: list[ID]
    source_refs: list[ID]


class Score(Record):
    weighted_unmet_hours: Count
    total_unmet_hours: Count
    total_cost_vnd: Count


class Evaluation(Record):
    feasible: bool
    violations: list[str]
    score: Score | None


class PhaseSummary(Record):
    objective_name: str
    status: Status | Literal["NOT_RUN"] = "NOT_RUN"
    objective_value: int | None = None
    best_bound: float | None = None
    integer_lower_bound: int | None = None
    absolute_gap: int | None = None
    relative_gap: float | None = None
    tolerance: dict[str, float] = Field(
        default_factory=lambda: {"absolute": 0.0, "relative": 0.0}
    )
    proven_optimal: bool = False
    proof_basis: Literal["zero_gap_solver", "integer_bound", "none"] = "none"
    raw_status: str | None = None
    runtime_s: float = 0.0
    time_to_first_feasible_s: float | None = None
    first_feasible_observation: Observation = "none"


class SeedSearchSummary(Record):
    source: str
    status: Status
    runtime_s: float
    time_to_first_feasible_s: float | None
    first_feasible_observation: Observation


class SolveResult(Record):
    solver_name: str
    status: Status
    proven_optimal: bool = False
    allocations: list[Allocation] | None = None
    evaluation: Evaluation | None = None
    phases: list[PhaseSummary]
    runtime_s: float
    time_limit_s: float | None
    deadline_exceeded: bool
    time_to_first_feasible_s: float | None
    first_feasible_observation: Observation
    seed_search: SeedSearchSummary | None = None
    seed: int
    error_code: str | None = None
    solver_metadata: dict | None = None
    search_steps: Count | None = None


def integer_lower_bound(bound: float | None, guaranteed: bool = True) -> int | None:
    if (
        not guaranteed
        or bound is None
        or not math.isfinite(bound)
        or not -L <= bound <= L
    ):
        return None
    return max(0, math.floor(math.nextafter(bound, -math.inf)))


def validate_scenario(scenario: StaffingScenario) -> None:
    StaffingScenario.model_validate(scenario.model_dump())

    def unique(values, label):
        if len(values) != len(set(values)):
            raise ValueError(f"DUPLICATE_{label}")

    def envelope(value, label):
        if value > L:
            raise ValueError(f"OVERFLOW:{label}")

    unique([g.group_id for g in scenario.groups], "GROUP")
    unique([n.need_id for n in scenario.needs], "NEED")
    unique([(a.group_id, a.need_id) for a in scenario.arcs], "ARC")
    unique([(a.group_id, a.need_id) for a in scenario.locked_allocations], "LOCK")
    if scenario.data_source == "simulated" and (
        scenario.policy_verified or not scenario.assumption_ids
    ):
        raise ValueError("PROVENANCE:simulated")
    groups = {g.group_id: g for g in scenario.groups}
    needs = {n.need_id: n for n in scenario.needs}
    arcs = {(a.group_id, a.need_id) for a in scenario.arcs}
    for g in scenario.groups:
        unique(g.skills, f"SKILL:{g.group_id}")
        envelope(g.committed_people + g.reserve_people, f"protection:{g.group_id}")
        if g.available_people < 0:
            raise ValueError(f"PROTECTION:{g.group_id}")
    for a in [*scenario.arcs, *scenario.locked_allocations]:
        if a.group_id not in groups or a.need_id not in needs:
            raise ValueError(f"REFERENCE:{a.group_id}:{a.need_id}")
    for a in scenario.locked_allocations:
        if (a.group_id, a.need_id) not in arcs:
            raise ValueError(f"LOCK_ARC:{a.group_id}:{a.need_id}")
    supply = {g.group_id: 0 for g in scenario.groups}
    capacity = {n.need_id: 0 for n in scenario.needs}
    coverage = {n.need_id: 0 for n in scenario.needs}
    cost = 0
    for a in scenario.arcs:
        g, n = groups[a.group_id], needs[a.need_id]
        upper = min(g.available_people, n.max_people) if n.role_id in g.skills else 0
        envelope(g.hours_per_person * upper, f"hours:{g.group_id}:{n.need_id}")
        envelope(a.cost_vnd * upper, f"cost:{g.group_id}:{n.need_id}")
        supply[g.group_id] += upper
        capacity[n.need_id] += upper
        coverage[n.need_id] += g.hours_per_person * upper
        cost += a.cost_vnd * upper
    for id, value in supply.items():
        envelope(value, f"supply:{id}")
    for id, value in capacity.items():
        envelope(value, f"capacity:{id}")
    for n in scenario.needs:
        envelope(coverage[n.need_id], f"coverage:{n.need_id}")
        envelope(n.demand_hours + coverage[n.need_id], f"shortfall:{n.need_id}")
        envelope(n.priority * n.demand_hours, f"weighted:{n.need_id}")
    envelope(cost, "total_cost")
    envelope(sum(n.priority * n.demand_hours for n in scenario.needs), "weighted_total")
    envelope(sum(n.demand_hours for n in scenario.needs), "unmet_total")
