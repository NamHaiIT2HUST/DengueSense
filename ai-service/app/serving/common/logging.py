"""Log JSON 1 dòng / sự kiện ra stdout, cùng trường với phía Go (docs/09 §13.1).

Trường: ts (UTC, hậu tố Z), level (DEBUG|INFO|WARN|ERROR), msg, service, version, request_id (nếu có),
cộng các trường tuỳ ý truyền qua `extra={"fields": {...}}`. KHÔNG log token, mật khẩu, khoá, query string,
thân request.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

# Mã yêu cầu của request đang xử lý; đặt bởi ObservabilityMiddleware, đọc bởi formatter.
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)

_LEVEL_NAMES = {"WARNING": "WARN", "CRITICAL": "ERROR"}


class JsonFormatter(logging.Formatter):
    def __init__(self, service: str, version: str) -> None:
        super().__init__()
        self._service = service
        self._version = version

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created, tz=UTC).isoformat(
            timespec="microseconds"
        )
        payload: dict[str, Any] = {
            "ts": ts.replace("+00:00", "Z"),
            "level": _LEVEL_NAMES.get(record.levelname, record.levelname),
            "msg": record.getMessage(),
            "service": self._service,
            "version": self._version,
        }
        request_id = request_id_var.get()
        if request_id:
            payload["request_id"] = request_id
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            payload.update(fields)
        if record.exc_info:
            payload["stack"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(
    service: str, version: str, level: str, stream: Any = None
) -> logging.Logger:
    """Cấu hình logger `service` (không đụng root logger) và trả về nó."""
    logger = logging.getLogger(service)
    logger.handlers.clear()
    handler = logging.StreamHandler(stream or sys.stdout)
    handler.setFormatter(JsonFormatter(service, version))
    logger.addHandler(handler)
    logger.setLevel("WARNING" if level in ("warn", "warning") else level.upper())
    logger.propagate = False
    return logger
