"""Middleware ASGI thuần: mã yêu cầu, log truy cập, giới hạn thân, bắt lỗi không lường trước.

Gộp vào MỘT middleware để mọi đường (kể cả lỗi 500) đều mang `request_id` và đều ra problem+json — nếu để
Starlette xử lý `Exception` ở lớp ngoài cùng thì contextvar đã bị reset, phản hồi 500 mất request_id.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from typing import Any

from starlette.datastructures import Headers
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.serving.common.logging import request_id_var
from app.serving.common.problem import (
    internal_error,
    problem_response,
    validation_error,
)

HEADER_REQUEST_ID = "x-request-id"
# Chỉ nhận mã do client gửi nếu an toàn để ghi vào log/header (chống chèn dòng log) — giống httpx.RequestID.
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
_HEALTH_ROUTES = {"/healthz", "/readyz"}


class ObservabilityMiddleware:
    def __init__(
        self, app: ASGIApp, logger: logging.Logger, max_body_bytes: int
    ) -> None:
        self.app = app
        self.logger = logger
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        incoming = headers.get(HEADER_REQUEST_ID, "")
        request_id = (
            incoming if _VALID_REQUEST_ID.match(incoming) else str(uuid.uuid4())
        )
        token = request_id_var.set(request_id)
        start = time.perf_counter()
        state: dict[str, Any] = {"status": 500, "bytes": 0, "started": False}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                state["status"] = message["status"]
                state["started"] = True
                raw = list(message.get("headers", []))
                raw.append((b"x-request-id", request_id.encode()))
                raw.append((b"x-content-type-options", b"nosniff"))
                raw.append((b"referrer-policy", b"no-referrer"))
                if not any(k.lower() == b"cache-control" for k, _ in raw):
                    raw.append((b"cache-control", b"no-store"))
                message = {**message, "headers": raw}
            elif message["type"] == "http.response.body":
                state["bytes"] += len(message.get("body", b""))
            await send(message)

        try:
            declared = headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > self.max_body_bytes:
                # Trả 400 (đồng nhất phía Go: thân quá lớn → validation_error), không đọc thân.
                response = problem_response(
                    validation_error("thân request quá lớn"), scope["path"]
                )
                await response(scope, receive, send_wrapper)
            else:
                await self.app(scope, receive, send_wrapper)
        # Chốt chặn cuối: mọi lỗi lạ → 500 chung, chi tiết chỉ vào log.
        except Exception:
            self.logger.exception("unhandled_exception")
            if not state["started"]:
                response = problem_response(internal_error(), scope["path"])
                await response(scope, receive, send_wrapper)
        finally:
            self._log_access(scope, state, start)
            request_id_var.reset(token)

    def _log_access(self, scope: Scope, state: dict[str, Any], start: float) -> None:
        route = scope.get("route")
        route_path = getattr(route, "path", None)
        if not route_path:
            # Tránh bùng nổ nhãn khi bị dò đường dẫn; /healthz, /readyz là route thật nên vẫn có mẫu.
            route_path = "unmatched"
        status = int(state["status"])
        if route_path in _HEALTH_ROUTES:
            level = logging.DEBUG
        elif status >= 500:
            level = logging.ERROR
        elif status >= 400:
            level = logging.WARNING
        else:
            level = logging.INFO
        self.logger.log(
            level,
            "http_request",
            extra={
                "fields": {
                    "method": scope["method"],
                    "route": route_path,
                    "status": status,
                    "duration_ms": int((time.perf_counter() - start) * 1000),
                    "bytes": state["bytes"],
                }
            },
        )
