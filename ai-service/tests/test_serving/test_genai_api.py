from fastapi.testclient import TestClient

from app.serving.genai_api.main import app

client = TestClient(app)


def test_healthz():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_generate_draft_b2b():
    payload = {
        "draft_type": "b2b",
        "slots": {
            "run_id": "0192f0e1-7c1a-7000-8000-000000000001",
            "province_ids": ["ha_noi", "an_giang"],
            "origin_month": "2010-03",
            "cases_predicted_total": 1250.0,
            "budget_allocated": 500000000.0,
        },
    }
    resp = client.post("/internal/v1/genai/draft", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["draft_type"] == "b2b"
    assert "BÁO CÁO PHÂN TÍCH" in data["content"]
    assert "1,250" in data["content"]
    assert "500,000,000" in data["content"]
    assert len(data["content_hash"]) == 64
    assert len(data["citations"]) >= 2
    assert len(data["guardrails"]) == 6
    assert all(g["passed"] for g in data["guardrails"])


def test_generate_draft_b2g():
    payload = {
        "draft_type": "b2g",
        "slots": {
            "run_id": "0192f0e1-7c1a-7000-8000-000000000001",
            "province_ids": ["ho_chi_minh"],
            "origin_month": "2010-03",
            "cases_predicted_total": 3500.0,
        },
    }
    resp = client.post("/internal/v1/genai/draft", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["draft_type"] == "b2g"
    assert "CÔNG ĐIỆN CHỈ ĐẠO" in data["content"]
    assert "3,500" in data["content"]
    assert len(data["content_hash"]) == 64
    assert len(data["guardrails"]) == 6
    assert all(g["passed"] for g in data["guardrails"])
