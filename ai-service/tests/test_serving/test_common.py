"""Kiểm thử hạ tầng dùng chung của các API Python (app.serving.common)."""

from __future__ import annotations

import io
import json
import logging
import re
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict

from app.serving.common.health import ReadyCheck
from app.serving.common.logging import JsonFormatter, configure_logging
from app.serving.common.problem import ApiError, validation_error
from app.serving.common.settings import (
    DEFAULT_MAX_BODY_BYTES,
    ServingSettings,
    SettingsError,
    load_settings,
)
from app.serving.forecast_api.main import create_app, create_app_from_env

_ERRORS_MD = Path(__file__).resolve().parents[3] / "contracts" / "errors.md"


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    horizon: int
    mode: str


def make_app(
    readiness: tuple[ReadyCheck, ...] = (), max_body: int = 1024
) -> tuple[FastAPI, io.StringIO]:
    settings = ServingSettings("forecast", "abc1234", "debug", max_body)
    app = create_app(settings, readiness)
    buf = io.StringIO()
    # Ghi log vào bộ đệm để kiểm nội dung; giữ nguyên formatter của service.
    logger = logging.getLogger("forecast")
    logger.handlers.clear()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(JsonFormatter("forecast", "abc1234"))
    logger.addHandler(handler)

    @app.post("/echo")
    async def echo(body: Payload) -> dict[str, int]:
        return {"horizon": body.horizon}

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("SECRET_DB_PASSWORD=hunter2 tại /srv/app/db.py")

    @app.get("/domain-error")
    async def domain_error() -> None:
        raise ApiError(409, "common.conflict", "Xung đột trạng thái", "đã duyệt rồi")

    @app.get("/items/{item_id}")
    async def item(item_id: int) -> dict[str, int]:
        return {"id": item_id}

    return app, buf


def log_lines(buf: io.StringIO) -> list[dict[str, object]]:
    return [json.loads(line) for line in buf.getvalue().splitlines() if line.strip()]


def problem(resp) -> dict:  # type: ignore[no-untyped-def]
    assert resp.headers["content-type"].startswith("application/problem+json")
    return resp.json()


# ---------- health ----------


def test_healthz_and_readyz_ok():
    app, _ = make_app()
    client = TestClient(app)
    assert client.get("/healthz").json() == {"status": "ok"}
    assert client.get("/readyz").json() == {"status": "ready"}


def test_readyz_fails_with_503_problem_and_does_not_leak_dependency_detail():
    async def broken() -> None:
        raise ConnectionError("dial tcp 10.0.0.5:5432: connection refused")

    app, _ = make_app(readiness=(broken,))
    client = TestClient(app)
    resp = client.get("/readyz")
    assert resp.status_code == 503
    body = problem(resp)
    assert body["code"] == "common.dependency_unavailable"
    assert "10.0.0.5" not in resp.text
    assert (
        client.get("/healthz").status_code == 200
    ), "healthz không phụ thuộc phụ thuộc"


def test_readyz_times_out_slow_dependency(monkeypatch: pytest.MonkeyPatch):
    import asyncio

    from app.serving.common import health

    monkeypatch.setattr(health, "READY_TIMEOUT_SECONDS", 0.05)

    async def slow() -> None:
        await asyncio.sleep(1)

    app, _ = make_app(readiness=(slow,))
    assert TestClient(app).get("/readyz").status_code == 503


# ---------- request id ----------


def test_request_id_generated_or_accepted_when_safe():
    app, _ = make_app()
    client = TestClient(app)

    generated = client.get("/healthz").headers["x-request-id"]
    assert re.fullmatch(r"[0-9a-f-]{36}", generated)

    ok = client.get("/healthz", headers={"X-Request-ID": "client-req-0001"})
    assert ok.headers["x-request-id"] == "client-req-0001"

    for bad in ("short", "has space in it 123", "x" * 65):
        got = client.get("/healthz", headers={"X-Request-ID": bad}).headers[
            "x-request-id"
        ]
        assert got != bad and re.fullmatch(r"[0-9a-f-]{36}", got)


def test_security_headers_present():
    app, _ = make_app()
    resp = TestClient(app).get("/healthz")
    assert resp.headers["x-content-type-options"] == "nosniff"
    assert resp.headers["referrer-policy"] == "no-referrer"
    assert resp.headers["cache-control"] == "no-store"


# ---------- problem+json ----------


def test_unknown_route_and_wrong_method_are_problem_json():
    app, _ = make_app()
    client = TestClient(app)
    resp = client.get("/khong-co")
    assert resp.status_code == 404
    assert problem(resp)["code"] == "common.not_found"

    resp = client.post("/healthz")
    assert resp.status_code == 405
    assert problem(resp)["code"] == "common.method_not_allowed"


def test_problem_shape_matches_go_side_and_carries_request_id():
    app, _ = make_app()
    resp = TestClient(app).get(
        "/domain-error", headers={"X-Request-ID": "req-abcdef12"}
    )
    body = problem(resp)
    assert resp.status_code == 409
    assert body == {
        "type": "https://denguesense.vn/errors/conflict",
        "title": "Xung đột trạng thái",
        "status": 409,
        "code": "common.conflict",
        "detail": "đã duyệt rồi",
        "instance": "/domain-error",
        "request_id": "req-abcdef12",
    }


def test_validation_error_lists_fields_without_echoing_input():
    app, _ = make_app()
    client = TestClient(app)

    resp = client.post(
        "/echo", json={"horizon": "MẬT-KHẨU-NGƯỜI-DÙNG", "mode": "x", "la": 1}
    )
    assert resp.status_code == 400
    body = problem(resp)
    assert body["code"] == "common.validation_error"
    fields = {e["field"]: e["message"] for e in body["errors"]}
    assert set(fields) == {"horizon", "la"}
    assert "MẬT-KHẨU" not in resp.text, "không được lặp lại giá trị đầu vào"

    resp = client.post("/echo", json={"mode": "x"})
    assert {e["field"] for e in problem(resp)["errors"]} == {"horizon"}

    resp = client.get("/items/abc")
    assert resp.status_code == 400
    assert problem(resp)["errors"][0]["field"] == "item_id"


def test_unhandled_exception_becomes_generic_500_and_is_logged():
    app, buf = make_app()
    resp = TestClient(app, raise_server_exceptions=False).get(
        "/boom", headers={"X-Request-ID": "req-crash-0001"}
    )
    assert resp.status_code == 500
    body = problem(resp)
    assert body["code"] == "common.internal_error"
    assert body["request_id"] == "req-crash-0001", "500 vẫn phải mang request_id"
    assert "hunter2" not in resp.text and "/srv/app" not in resp.text
    assert resp.headers["x-request-id"] == "req-crash-0001"

    crash = [line for line in log_lines(buf) if line["msg"] == "unhandled_exception"]
    assert crash and "hunter2" in str(crash[0]["stack"]), "chi tiết phải nằm trong log"
    assert crash[0]["request_id"] == "req-crash-0001"


def test_oversized_body_rejected_with_validation_problem():
    app, _ = make_app(max_body=100)
    resp = TestClient(app).post("/echo", content=b"x" * 5000)
    assert resp.status_code == 400
    assert problem(resp)["code"] == "common.validation_error"


# ---------- access log ----------


def test_access_log_fields_levels_and_no_query_string():
    app, buf = make_app()
    client = TestClient(app, raise_server_exceptions=False)
    client.get("/items/42?token=GIATRI-TRUY-VAN")
    client.get("/khong-co")
    client.get("/healthz")
    client.get("/boom")

    access = [line for line in log_lines(buf) if line["msg"] == "http_request"]
    by_status = {int(str(line["status"])): line for line in access}
    ok = by_status[200]
    assert ok["route"] in {"/items/{item_id}", "/healthz"}
    assert {"ts", "level", "msg", "service", "version", "request_id"} <= set(ok)
    assert ok["service"] == "forecast" and ok["version"] == "abc1234"
    assert by_status[404]["level"] == "WARN"
    assert by_status[404]["route"] == "unmatched"
    assert by_status[500]["level"] == "ERROR"
    assert "GIATRI-TRUY-VAN" not in buf.getvalue(), "không được log query string"

    health_line = next(line for line in access if line["route"] == "/healthz")
    assert health_line["level"] == "DEBUG"
    items = [line for line in access if line["route"] == "/items/{item_id}"]
    assert items and items[0]["level"] == "INFO", "log mẫu route, không log id thô"


def test_json_formatter_renames_warning_and_handles_unicode():
    stream = io.StringIO()
    logger = configure_logging("svc-x", "v1", "warn", stream)
    logger.info("bị lọc")
    logger.warning("cảnh báo tiếng Việt", extra={"fields": {"k": "v"}})
    lines = [json.loads(line) for line in stream.getvalue().splitlines()]
    assert len(lines) == 1
    assert lines[0]["level"] == "WARN" and lines[0]["msg"] == "cảnh báo tiếng Việt"
    assert lines[0]["k"] == "v" and lines[0]["service"] == "svc-x"
    assert lines[0]["ts"].endswith("Z")


# ---------- settings ----------


def test_settings_defaults_and_overrides():
    s = load_settings("forecast", "FORECAST", {})
    assert s == ServingSettings("forecast", "dev", "info", DEFAULT_MAX_BODY_BYTES)

    s = load_settings(
        "forecast",
        "FORECAST",
        {
            "FORECAST_LOG_LEVEL": " DEBUG ",
            "FORECAST_MAX_BODY_BYTES": "2048",
            "BUILD_VERSION": "abc123",
        },
    )
    assert (s.log_level, s.max_body_bytes, s.version) == ("debug", 2048, "abc123")


def test_settings_errors_name_variables_but_never_values():
    secret = "s3cr3t-value"
    with pytest.raises(SettingsError) as exc:
        load_settings(
            "forecast",
            "FORECAST",
            {"FORECAST_LOG_LEVEL": secret, "FORECAST_MAX_BODY_BYTES": secret},
        )
    message = str(exc.value)
    assert "FORECAST_LOG_LEVEL" in message and "FORECAST_MAX_BODY_BYTES" in message
    assert secret not in message

    for bad in ("0", "-5", "1.5", "abc"):
        with pytest.raises(SettingsError):
            load_settings("forecast", "FORECAST", {"FORECAST_MAX_BODY_BYTES": bad})


def test_create_app_from_env_fails_fast_on_bad_config():
    with pytest.raises(SettingsError):
        create_app_from_env({"FORECAST_LOG_LEVEL": "verbose"})
    assert create_app_from_env({}) is not None


# ---------- hợp đồng mã lỗi ----------


def test_error_codes_emitted_are_in_the_catalog():
    """Mọi mã lỗi mà app.serving.common phát ra PHẢI có (đúng HTTP status) trong contracts/errors.md."""
    from app.serving.common import problem as p

    catalog = _ERRORS_MD.read_text(encoding="utf-8")
    emitted = [
        validation_error("x"),
        p.not_found(),
        p.method_not_allowed(),
        p.internal_error(),
        p.dependency_unavailable(),
    ]
    for err in emitted:
        assert (
            f"| `{err.code}` | {err.status} |" in catalog
        ), f"{err.code} (HTTP {err.status}) thiếu hoặc lệch trạng thái ở contracts/errors.md"
