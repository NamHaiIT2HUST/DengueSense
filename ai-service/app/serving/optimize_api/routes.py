from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.optimize import OptimizeItemInput, optimize_allocation

router = APIRouter()


class AllocateItem(BaseModel):
    province_id: str
    cases_pred: float
    cost: float = Field(default=0.0)


class AllocateRequest(BaseModel):
    budget: float
    items: list[AllocateItem]
    strategy: Literal["milp_marginal", "simulated_annealing", "greedy_baseline"] = (
        "milp_marginal"
    )


class Allocation(BaseModel):
    province_id: str
    amount: float
    explanation: str
    beds: int = 0
    supplies: int = 0
    teams: int = 0


class AllocateResponse(BaseModel):
    total_cost: float
    estimated_cases_prevented: float
    allocations: list[Allocation]
    algorithm_used: str
    solve_time_ms: float


@router.post("/allocate", response_model=AllocateResponse)
def allocate_resources(req: AllocateRequest) -> AllocateResponse:
    inputs = [
        OptimizeItemInput(
            province_id=item.province_id,
            cases_pred=item.cases_pred,
            is_high_risk=item.cases_pred >= 250,
        )
        for item in req.items
    ]

    result = optimize_allocation(
        items=inputs,
        budget=req.budget,
        strategy=req.strategy,
    )

    allocations = [
        Allocation(
            province_id=a.province_id,
            amount=a.amount,
            explanation=a.explanation,
            beds=a.beds,
            supplies=a.supplies,
            teams=a.teams,
        )
        for a in result.allocations
    ]

    return AllocateResponse(
        total_cost=result.total_cost,
        estimated_cases_prevented=result.estimated_cases_prevented,
        allocations=allocations,
        algorithm_used=result.algorithm,
        solve_time_ms=result.solve_time_ms,
    )
