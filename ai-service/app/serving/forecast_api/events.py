"""Phong bì sự kiện (CloudEvents 1.0) của `forecast` — khớp `backend/pkg/eventx` và `contracts/events/*.json`.

Sự kiện được ghi vào bảng `outbox` CÙNG giao dịch với thay đổi nghiệp vụ (docs/09 §7.4); relay gửi lên NATS sau.
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any

SPEC_VERSION = "1.0"
SOURCE = "denguesense/forecast"
TYPE_RUN_COMPLETED = "forecast.run.completed"
TYPE_RUN_FAILED = "forecast.run.failed"

_TYPE = re.compile(r"^[a-z]+(\.[a-z_]+){2,}$")


def new_event(
    event_type: str,
    subject: str,
    data: dict[str, Any],
    *,
    version: int = 1,
    at: datetime | None = None,
) -> dict[str, Any]:
    if not _TYPE.match(event_type):
        raise ValueError(
            f"type {event_type!r} không hợp lệ (dạng <service>.<thực_thể>.<động_từ_quá_khứ>)"
        )
    if version < 1:
        raise ValueError("version schema phải ≥ 1")
    when = (at or datetime.now(UTC)).astimezone(UTC)
    return {
        "specversion": SPEC_VERSION,
        "id": str(uuid.uuid4()),
        "source": SOURCE,
        "type": event_type,
        "dataschema": f"contracts/events/{event_type}.v{version}.json",
        "time": when.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "subject": subject,
        "data": data,
    }


def run_completed(
    run_id: str,
    run_mode: str,
    origin_month: str,
    model_version: str,
    data_version: str,
    province_count: int,
    horizons: list[int],
    at: datetime | None = None,
) -> dict[str, Any]:
    return new_event(
        TYPE_RUN_COMPLETED,
        f"run/{run_id}",
        {
            "run_id": run_id,
            "run_mode": run_mode,
            "origin_month": origin_month,
            "model_version": model_version,
            "data_version": data_version,
            "province_count": province_count,
            "horizons": sorted(horizons),
        },
        at=at,
    )


def run_failed(
    run_id: str,
    run_mode: str,
    origin_month: str,
    error_code: str,
    at: datetime | None = None,
) -> dict[str, Any]:
    return new_event(
        TYPE_RUN_FAILED,
        f"run/{run_id}",
        {
            "run_id": run_id,
            "run_mode": run_mode,
            "origin_month": origin_month,
            "error_code": error_code,
        },
        at=at,
    )
