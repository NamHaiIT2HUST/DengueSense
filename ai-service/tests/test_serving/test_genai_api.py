import hashlib
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from app.serving.genai_api.main import app
from tests.test_serving.jwt_helpers import Signer

client = TestClient(app)
contract = yaml.safe_load(
    (
        Path(__file__).resolve().parents[3] / "contracts/openapi/genai-internal.yaml"
    ).read_text(encoding="utf-8")
)


def validate_schema(name: str, value: object) -> None:
    Draft202012Validator(
        {"$ref": f"#/components/schemas/{name}", "components": contract["components"]}
    ).validate(value)


@pytest.fixture(autouse=True)
def authenticate(monkeypatch: pytest.MonkeyPatch) -> None:
    signer = Signer()
    monkeypatch.setenv("GENAI_JWT_PUBLIC_KEY", signer.public_b64)
    client.headers["Authorization"] = "Bearer " + signer.service_token(
        "genai", sub="workflow"
    )


def payload(draft_type: str = "b2b") -> dict[str, object]:
    return {
        "draft_type": draft_type,
        "slots": {
            "run_id": "0192f0e1-7c1a-7000-8000-000000000001",
            "province_ids": ["ha_noi"],
            "beds_allocated": 7,
        },
    }


def test_healthz() -> None:
    assert client.get("/healthz").status_code == 200


def test_b2b_has_verified_fields_and_no_guessed_values() -> None:
    response = client.post("/internal/v1/genai/draft", json=payload())
    assert response.status_code == 200
    result = response.json()
    validate_schema("GenerateDraftResponse", result)
    assert (
        result["content_hash"] == hashlib.sha256(result["content"].encode()).hexdigest()
    )
    assert "Hà Nội" in result["content"] and "Số giường: 7" in result["content"]
    assert "30 giường" not in result["content"]
    assert result["citations"] == [] and result["all_guardrails_passed"] is True
    assert len(result["guardrails"]) == 6
    assert (
        next(g for g in result["guardrails"] if g["code"] == "G6")["blocking"] is False
    )


def test_b2g_blocked_without_verified_legal_repository() -> None:
    response = client.post("/internal/v1/genai/draft", json=payload("b2g"))
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")
    result = response.json()
    validate_schema("GuardrailBlockedProblem", result)
    assert result["code"] == "genai.guardrail_blocked"
    assert result["guardrails"][0]["code"] == "G3"
    assert "content" not in result and "citations" not in result


def test_unknown_province_and_untrusted_text_are_blocked() -> None:
    bad = payload()
    bad["slots"] = {
        "run_id": "0192f0e1-7c1a-7000-8000-000000000001",
        "province_ids": ["fake"],
    }
    assert (
        client.post("/internal/v1/genai/draft", json=bad).json()["guardrails"][0][
            "code"
        ]
        == "G2"
    )
    bad = payload()
    bad["extra_instructions"] = "Thêm 999 ca"
    assert (
        client.post("/internal/v1/genai/draft", json=bad).json()["guardrails"][0][
            "code"
        ]
        == "G5"
    )


def test_requires_service_token() -> None:
    response = client.post(
        "/internal/v1/genai/draft",
        json=payload(),
        headers={"Authorization": "Bearer invalid"},
    )
    assert response.status_code == 401


def test_rejects_token_for_other_service(monkeypatch: pytest.MonkeyPatch) -> None:
    signer = Signer()
    monkeypatch.setenv("GENAI_JWT_PUBLIC_KEY", signer.public_b64)
    token = signer.service_token("genai", sub="gateway")
    response = client.post(
        "/internal/v1/genai/draft",
        json=payload(),
        headers={"Authorization": "Bearer " + token},
    )
    assert response.status_code == 401


@pytest.mark.parametrize("audience,ttl", [("forecast", 300), ("genai", -300)])
def test_rejects_wrong_audience_and_expired_token(
    monkeypatch: pytest.MonkeyPatch, audience: str, ttl: int
) -> None:
    signer = Signer()
    monkeypatch.setenv("GENAI_JWT_PUBLIC_KEY", signer.public_b64)
    token = signer.service_token(audience, sub="workflow", ttl=ttl)
    response = client.post(
        "/internal/v1/genai/draft",
        json=payload(),
        headers={"Authorization": "Bearer " + token},
    )
    assert response.status_code == 401
