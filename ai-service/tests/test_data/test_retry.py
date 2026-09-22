from __future__ import annotations

import pytest

from app.data._retry import retry_with_backoff


def test_succeeds_immediately_without_retry():
    calls = []

    def fn():
        calls.append(1)
        return "ok"

    result = retry_with_backoff(fn, attempts=4, base_delay=0)
    assert result == "ok"
    assert len(calls) == 1


def test_retries_then_succeeds(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("app.data._retry.time.sleep", lambda _: None)
    attempts_made = []

    def flaky():
        attempts_made.append(1)
        if len(attempts_made) < 3:
            raise ConnectionError("mất mạng")
        return "ok"

    result = retry_with_backoff(flaky, attempts=4, base_delay=1)
    assert result == "ok"
    assert len(attempts_made) == 3


def test_raises_after_exhausting_attempts(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("app.data._retry.time.sleep", lambda _: None)

    def always_fails():
        raise ConnectionError("mất mạng mãi")

    with pytest.raises(ConnectionError, match="mất mạng mãi"):
        retry_with_backoff(always_fails, attempts=3, base_delay=1)


def test_on_retry_callback_receives_attempt_and_delay(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("app.data._retry.time.sleep", lambda _: None)
    seen = []

    def flaky():
        if len(seen) < 2:
            raise ValueError("lỗi tạm thời")
        return "ok"

    retry_with_backoff(
        flaky,
        attempts=4,
        base_delay=2,
        on_retry=lambda attempt, exc, delay: seen.append((attempt, delay)),
    )
    assert seen == [(1, 2.0), (2, 4.0)]
