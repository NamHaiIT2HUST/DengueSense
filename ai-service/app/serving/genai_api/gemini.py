"""Gemini selects a presentation focus; model text is never used as evidence."""

from __future__ import annotations

import json
import os
from typing import Literal

import httpx

Focus = Literal["monitoring", "coordination", "readiness"]
_ALLOWED: frozenset[str] = frozenset({"monitoring", "coordination", "readiness"})
_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent"


class GeminiUnavailable(Exception):
    """The provider is unavailable or returned an invalid response."""


def choose_focus(
    title: str | None, instruction: str | None
) -> tuple[Focus, str | None]:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        return "monitoring", None
    # Never send user text, province identifiers, slots, PII or credentials in the prompt.
    hint = (" ".join((title or "", instruction or ""))).casefold()
    flags = [
        name
        for name, terms in (
            ("monitoring", ("giám sát", "theo dõi")),
            ("coordination", ("phối hợp", "điều phối")),
            ("readiness", ("sẵn sàng", "chuẩn bị")),
        )
        if any(term in hint for term in terms)
    ]
    prompt = (
        "Select one presentation focus for a dengue surveillance demo. "
        "Output JSON with only the key focus, whose value is monitoring, "
        "coordination, or readiness. No facts or medical advice. "
        "Recognized presentation hints: " + ", ".join(flags)
    )
    try:
        response = httpx.post(
            _ENDPOINT,
            headers={"x-goog-api-key": key, "content-type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 64,
                    "thinkingConfig": {"thinkingLevel": "minimal"},
                    "responseSchema": {
                        "type": "OBJECT",
                        "properties": {
                            "focus": {
                                "type": "STRING",
                                "enum": ["monitoring", "coordination", "readiness"],
                            }
                        },
                        "required": ["focus"],
                    },
                },
            },
            timeout=12.0,
        )
        response.raise_for_status()
        data = response.json()
        candidate = data["candidates"][0]
        if candidate.get("finishReason") != "STOP":
            raise ValueError("generation did not complete")
        value = json.loads(candidate["content"]["parts"][0]["text"])["focus"]
        if value not in _ALLOWED:
            raise ValueError("unknown focus")
        version = data.get("modelVersion")
        if not isinstance(version, str) or not version:
            version = "gemini-3.1-flash-lite"
        # Runtime membership check above narrows this untrusted provider output.
        if value == "coordination":
            return "coordination", version
        if value == "readiness":
            return "readiness", version
        return "monitoring", version
    except (
        httpx.HTTPError,
        ValueError,
        KeyError,
        IndexError,
        TypeError,
        AttributeError,
    ) as exc:
        raise GeminiUnavailable("Gemini unavailable or response invalid") from exc
