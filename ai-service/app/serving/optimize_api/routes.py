from fastapi import APIRouter

router = APIRouter()

@router.get("/plans")
def list_plans():
    return []
