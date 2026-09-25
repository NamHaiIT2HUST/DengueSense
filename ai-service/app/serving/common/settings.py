"""Cấu hình từ biến môi trường theo tiền tố service (12-factor, docs/09 §16.1).

Luật (giống `backend/pkg/configx`): giá trị sai/thiếu → gom lỗi, service fail ngay lúc khởi động;
thông báo lỗi CHỈ nêu tên biến, không bao giờ nêu giá trị (có thể là bí mật).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass

LOG_LEVELS = ("debug", "info", "warn", "warning", "error")
DEFAULT_MAX_BODY_BYTES = 1 << 20  # 1 MB (docs/09 §6.7)


class SettingsError(Exception):
    """Cấu hình không hợp lệ. `str(err)` liệt kê tên biến lỗi, không chứa giá trị."""


@dataclass(frozen=True)
class ServingSettings:
    service: str
    version: str
    log_level: str
    max_body_bytes: int


def load_settings(
    service: str, prefix: str, env: Mapping[str, str] | None = None
) -> ServingSettings:
    """Đọc `<PREFIX>_LOG_LEVEL`, `<PREFIX>_MAX_BODY_BYTES` và `BUILD_VERSION` (git sha, gán lúc build image)."""
    source = os.environ if env is None else env
    errors: list[str] = []

    def raw(name: str) -> str | None:
        value = source.get(name, "").strip()
        return value or None

    level_var = f"{prefix}_LOG_LEVEL"
    level = (raw(level_var) or "info").lower()
    if level not in LOG_LEVELS:
        errors.append(f"biến {level_var} phải thuộc {'|'.join(LOG_LEVELS)}")
        level = "info"

    body_var = f"{prefix}_MAX_BODY_BYTES"
    body = DEFAULT_MAX_BODY_BYTES
    body_raw = raw(body_var)
    if body_raw is not None:
        if body_raw.isdigit() and int(body_raw) > 0:
            body = int(body_raw)
        else:
            errors.append(f"biến {body_var} phải là số nguyên dương")

    if errors:
        raise SettingsError("; ".join(errors))
    return ServingSettings(
        service=service,
        version=raw("BUILD_VERSION") or "dev",
        log_level=level,
        max_body_bytes=body,
    )
