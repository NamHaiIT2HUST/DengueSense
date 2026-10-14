import json
import random
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator

from app.optimize.staffing import ID, Count, Record, StaffingScenario, validate_scenario

GENERATOR_VERSION = "fixture-perturbation-v1"


class ScenarioProfile(Record):
    base_fixture: ID
    replicas: Annotated[int, Field(strict=True, ge=1)]
    demand_percent_choices: list[Count]
    budget_percent_choices: list[Count]
    available_percent_choices: list[Count]
    source_refs: list[ID]
    assumption_ids: list[ID]

    @field_validator(
        "demand_percent_choices",
        "budget_percent_choices",
        "available_percent_choices",
        "assumption_ids",
    )
    @classmethod
    def nonempty(cls, value):
        if not value:
            raise ValueError("must not be empty")
        return value


def generate_scenarios(profile: dict, seed: int, count: int) -> list[StaffingScenario]:
    settings = ScenarioProfile.model_validate(profile)
    if type(seed) is not int or not 0 <= seed <= 2**31 - 1:
        raise ValueError("seed: expected integer in [0, 2**31-1]")
    if type(count) is not int or count < 1:
        raise ValueError("count: expected positive integer")
    base = StaffingScenario.model_validate(
        json.loads(Path(settings.base_fixture).read_text())
    )
    validate_scenario(base)
    rng = random.Random(seed)
    scenarios = []
    for index in range(count):
        data = base.model_dump()
        data.update(
            scenario_id=f"{base.scenario_id}-seed{seed}-{index}",
            groups=[],
            needs=[],
            arcs=[],
            locked_allocations=[],
            data_source="simulated",
            policy_verified=False,
            assumption_ids=list(
                dict.fromkeys(
                    [*base.assumption_ids, *settings.assumption_ids, GENERATOR_VERSION]
                )
            ),
            source_refs=settings.source_refs,
        )
        for replica in range(settings.replicas):
            suffix = f"-r{replica}"
            for group in base.groups:
                row = group.model_dump()
                available = (
                    group.available_people
                    * rng.choice(settings.available_percent_choices)
                    // 100
                )
                row.update(
                    group_id=group.group_id + suffix,
                    source_site_id=group.source_site_id + suffix,
                    total_people=available
                    + group.committed_people
                    + group.reserve_people,
                )
                data["groups"].append(row)
            for need in base.needs:
                row = need.model_dump()
                demand = (
                    need.demand_hours * rng.choice(settings.demand_percent_choices) + 99
                ) // 100
                row.update(
                    need_id=need.need_id + suffix,
                    site_id=need.site_id + suffix,
                    demand_hours=demand,
                )
                data["needs"].append(row)
            for key in ["arcs", "locked_allocations"]:
                for original in getattr(base, key):
                    row = original.model_dump()
                    row.update(
                        group_id=original.group_id + suffix,
                        need_id=original.need_id + suffix,
                    )
                    data[key].append(row)
        data["budget_vnd"] = (
            base.budget_vnd
            * settings.replicas
            * rng.choice(settings.budget_percent_choices)
            // 100
        )
        scenario = StaffingScenario.model_validate(data)
        validate_scenario(scenario)
        scenarios.append(scenario)
    return scenarios
