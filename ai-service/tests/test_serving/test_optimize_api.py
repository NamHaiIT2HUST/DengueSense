"""API test for optimize_api FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.serving.optimize_api.main import app

client = TestClient(app)


def test_optimize_healthz():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_allocate_endpoint_milp():
    payload = {
        "budget": 500000000.0,
        "strategy": "milp_marginal",
        "items": [
            {"province_id": "ho_chi_minh", "cases_pred": 500.0, "cost": 100000000.0},
            {"province_id": "an_giang", "cases_pred": 300.0, "cost": 80000000.0},
            {"province_id": "da_nang", "cases_pred": 120.0, "cost": 50000000.0},
        ],
    }
    resp = client.post("/internal/v1/optimize/allocate", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_cost"] <= 500000000.0
    assert data["estimated_cases_prevented"] > 0
    assert len(data["allocations"]) == 3
    assert data["algorithm_used"].startswith("MILP")
    assert data["solve_time_ms"] > 0

    hcm = next(
        (a for a in data["allocations"] if a["province_id"] == "ho_chi_minh"), None
    )
    assert hcm is not None
    assert hcm["teams"] >= 1
    assert "Cloramin B" in hcm["explanation"]
    caps = {item["province_id"]: item["cost"] for item in payload["items"]}
    assert all(a["amount"] <= caps[a["province_id"]] for a in data["allocations"])


def test_allocate_endpoint_simulated_annealing():
    payload = {
        "budget": 300000000.0,
        "strategy": "simulated_annealing",
        "items": [
            {"province_id": "ho_chi_minh", "cases_pred": 400.0, "cost": 100000000.0},
            {"province_id": "ha_noi", "cases_pred": 150.0, "cost": 50000000.0},
        ],
    }
    resp = client.post("/internal/v1/optimize/allocate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_cost"] <= 300000000.0
    assert "Simulated Annealing" in data["algorithm_used"]


@pytest.mark.parametrize(
    "strategy", ["milp_marginal", "simulated_annealing", "greedy_baseline"]
)
def test_allocate_respects_province_budget_cap(strategy):
    payload = {
        "budget": 1_000_000_000,
        "strategy": strategy,
        "items": [{"province_id": "ha_noi", "cases_pred": 120, "cost": 40_000_000}],
    }
    response = client.post("/internal/v1/optimize/allocate", json=payload)
    assert response.status_code == 200
    assert all(a["amount"] <= 40_000_000 for a in response.json()["allocations"])


def test_milp_rejects_infeasible_high_risk_cap():
    response = client.post(
        "/internal/v1/optimize/allocate",
        json={
            "budget": 1_000_000_000,
            "items": [{"province_id": "ha_noi", "cases_pred": 500, "cost": 10_000_000}],
        },
    )
    assert response.status_code == 422
