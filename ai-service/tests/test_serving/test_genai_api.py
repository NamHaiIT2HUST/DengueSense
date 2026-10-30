import hashlib
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from app.serving.genai_api.gemini import GeminiUnavailable
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
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GENAI_DEMO_MODE", raising=False)
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


def test_b2g_demo_is_explicitly_labelled_and_unsigned(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("GENAI_DEMO_MODE", "true")
    response = client.post("/internal/v1/genai/draft", json=payload("b2g"))
    assert response.status_code == 200
    result = response.json()
    validate_schema("GenerateDraftResponse", result)
    assert "MÔ PHỎNG CUỘC THI" in result["content"]
    assert "CHƯA KÝ" in result["content"]
    assert len(result["citations"]) == 3
    assert result["citations"][0]["document_id"] == "vn-moh-qd3711-2014"
    assert result["citations"][1]["document_version"] == "02/2016/QĐ-TTg"
    assert "Điều 2" in result["citations"][1]["provision"]
    assert "Khoản 2" in result["citations"][1]["provision"]
    assert "Điểm a" in result["citations"][1]["provision"]
    assert "Một xã, phường, thị trấn" in result["citations"][1]["quote"]
    assert "03 năm gần nhất" in result["citations"][1]["quote"]
    assert "congbao.chinhphu.vn" in result["citations"][1]["source_url"]
    assert (
        "công báo chính phủ"
        in next(g for g in result["guardrails"] if g["code"] == "G3")["detail"].lower()
    )


def test_unknown_province_is_blocked_and_untrusted_numbers_not_copied() -> None:
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
    response = client.post("/internal/v1/genai/draft", json=bad)
    assert response.status_code == 200
    assert "999" not in response.json()["content"]
    assert "bổ sung thủ công" in response.json()["content"]


def test_text_hints_are_not_copied_into_demo_draft() -> None:
    request = payload()
    request["title"] = "Báo cáo theo dõi"
    request["extra_instructions"] = "Phối hợp với Nguyễn Văn An"
    response = client.post("/internal/v1/genai/draft", json=request)
    assert response.status_code == 200
    assert "Nguyễn Văn An" not in response.json()["content"]
    assert "bổ sung thủ công" in response.json()["content"]


def test_gemini_failure_is_labelled_and_does_not_claim_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail(*args: object) -> None:
        raise GeminiUnavailable("unavailable")

    monkeypatch.setattr("app.serving.genai_api.routes.choose_focus", fail)
    response = client.post("/internal/v1/genai/draft", json=payload())
    assert response.status_code == 200
    result = response.json()
    assert "Mẫu cố định dự phòng" in result["content"]
    assert "model_used" not in result


def test_requires_service_token() -> None:
    response = client.post(
        "/internal/v1/genai/draft",
        json=payload(),
        headers={"Authorization": "Bearer invalid"},
    )
    assert response.status_code == 401


def test_missing_verification_key_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GENAI_JWT_PUBLIC_KEY", raising=False)
    response = client.post("/internal/v1/genai/draft", json=payload())
    assert response.status_code == 503


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
