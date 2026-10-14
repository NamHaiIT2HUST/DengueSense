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
            "budget_allocated": 750000000.0,
            "beds_allocated": 80,
            "supplies_allocated": 1500,
            "teams_allocated": 8,
        },
    }
    resp = client.post("/internal/v1/genai/draft", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["draft_type"] == "b2g"
    assert "CÔNG ĐIỆN CHỈ ĐẠO" in data["content"]
    assert "3,500" in data["content"]
    assert "750,000,000" in data["content"]
    assert "80" in data["content"]
    assert "1,500" in data["content"]
    assert "8" in data["content"]
    assert len(data["content_hash"]) == 64
    assert len(data["guardrails"]) == 6
    assert all(g["passed"] for g in data["guardrails"])

    citation_sources = [c["source"] for c in data["citations"]]
    assert any("30/2020/NĐ-CP" in s for s in citation_sources)
    assert any("02/2016/QĐ-BYT" in s for s in citation_sources)
    assert any("3711/QĐ-BYT" in s for s in citation_sources)


def test_guardrail_g1_strict_lock_pass():
    payload = {
        "draft_type": "b2b",
        "slots": {
            "run_id": "0192f0e1-7c1a-7000-8000-000000000001",
            "province_ids": ["da_nang"],
            "origin_month": "2010-04",
            "cases_predicted_total": 620.0,
            "budget_allocated": 250000000.0,
            "beds_allocated": 40,
            "supplies_allocated": 600,
            "teams_allocated": 5,
        },
    }
    resp = client.post("/internal/v1/genai/draft", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    g1 = next(g for g in data["guardrails"] if g["code"] == "G1")
    assert g1["passed"] is True
    assert "Zero-Hallucination" in g1["name"]
