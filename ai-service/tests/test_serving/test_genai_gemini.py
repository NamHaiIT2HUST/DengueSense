import json

import httpx
import pytest

from app.serving.genai_api.gemini import GeminiUnavailable, choose_focus


def test_missing_key_returns_template(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert choose_focus(None, None) == ("monitoring", None)


def test_only_normalized_hints_reach_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-secret")
    captured = {}

    def fake_post(url, *, headers, json, timeout):
        captured.update(json)
        assert headers["x-goog-api-key"] == "test-secret"
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "modelVersion": "gemini-test",
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": '{"focus":"coordination"}'}]},
                    }
                ],
            },
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    assert choose_focus("Báo cáo của Nguyễn Văn An", "phối hợp Hà Nội") == (
        "coordination",
        "gemini-test",
    )
    body = json.dumps(captured, ensure_ascii=False)
    assert (
        "Nguyễn Văn An" not in body
        and "Hà Nội" not in body
        and "test-secret" not in body
    )


def test_rejects_untrusted_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "test-secret")

    def fake_post(url, **kwargs):
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [{"text": '{"focus":"invented content"}'}]
                        },
                    }
                ]
            },
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    with pytest.raises(GeminiUnavailable):
        choose_focus(None, None)
