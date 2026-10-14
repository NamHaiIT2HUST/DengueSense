"""API test for optimize_api FastAPI endpoints."""

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
