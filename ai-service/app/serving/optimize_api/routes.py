from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class AllocateItem(BaseModel):
    province_id: str
    cases_pred: float
    cost: float


class AllocateRequest(BaseModel):
    budget: float
    items: list[AllocateItem]


class Allocation(BaseModel):
    province_id: str
    amount: float
    explanation: str


class AllocateResponse(BaseModel):
    total_cost: float
    estimated_cases_prevented: float
    allocations: list[Allocation]


@router.post("/allocate", response_model=AllocateResponse)
def allocate_resources(req: AllocateRequest) -> AllocateResponse:
    # Dummy implementation for Đợt 2 - AI layer sẽ thay thế bằng CP-SAT/MILP
    allocs = []
    total_cost = 0.0
    cases_prevented = 0.0

    # Greedy (P1 baseline) tạm thời
    sorted_items = sorted(req.items, key=lambda x: x.cases_pred, reverse=True)

    for item in sorted_items:
        if total_cost + item.cost <= req.budget:
            allocs.append(
                Allocation(
                    province_id=item.province_id,
                    amount=1.0,
                    explanation=f"Phân bổ do rủi ro cao ({item.cases_pred} ca dự kiến)",
                )
            )
            total_cost += item.cost
            cases_prevented += item.cases_pred * 0.2  # Giả định giảm 20%

    return AllocateResponse(
        total_cost=total_cost,
        estimated_cases_prevented=cases_prevented,
        allocations=allocs,
    )
