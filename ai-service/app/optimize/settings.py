from typing import Annotated

from pydantic import Field

from app.optimize.staffing import Record

Tolerance = Annotated[float, Field(strict=True, gt=0, lt=0.5, allow_inf_nan=False)]
Gap = Annotated[float, Field(strict=True, ge=0, allow_inf_nan=False)]


class MilpSettings(Record):
    integrality_tolerance: Tolerance
    feasibility_tolerance: Tolerance
    objective_tolerance: Tolerance
    relative_gap_limit: Gap
    absolute_gap_limit: Gap
    threads: Annotated[int, Field(strict=True, ge=1, le=1)]


Fraction = Annotated[float, Field(strict=True, gt=0, lt=1, allow_inf_nan=False)]
Positive = Annotated[float, Field(strict=True, gt=0, allow_inf_nan=False)]
PositiveCount = Annotated[int, Field(strict=True, gt=0)]


class HeuristicSettings(Record):
    health_fraction: Fraction
    initial_temperature_fraction: Positive
    min_temperature: Positive
    cooling_rate: Fraction
    candidate_batch_size: PositiveCount
    tabu_tenure: PositiveCount
    diversify_after: PositiveCount
