"""Cấu hình RIÊNG của service `forecast` (ngoài phần chung ở `app.serving.common.settings`).

Luật (giống `backend/pkg/configx`): thiếu/sai → gom lỗi theo TÊN biến, không bao giờ nêu giá trị (có thể là bí mật).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass

from app.serving.common.settings import SettingsError

PREFIX = "FORECAST"


@dataclass(frozen=True)
class ForecastConfig:
    store: str  # "postgres" | "memory" (memory CHỈ để chạy thử cục bộ — mất dữ liệu khi khởi động lại)
    db_url: str | None
    jwt_public_key: str
    jwt_key_id: str
    jwt_issuer: str
    surveillance_url: str
    identity_url: str
    client_secret: str
    runner_poll_seconds: float


def load_config(env: Mapping[str, str] | None = None) -> ForecastConfig:
    source = os.environ if env is None else env
    errors: list[str] = []

    def get(
        name: str, default: str | None = None, *, required: bool = False
    ) -> str | None:
        value = source.get(f"{PREFIX}_{name}", "").strip()
        if value:
            return value
        if required:
            errors.append(f"thiếu biến {PREFIX}_{name}")
        return default

    store = (get("STORE", "postgres") or "postgres").lower()
    if store not in ("postgres", "memory"):
        errors.append(f"biến {PREFIX}_STORE phải là postgres hoặc memory")
    db_url = get("DB_URL", required=store == "postgres")

    poll = 5.0
    poll_raw = get("RUNNER_POLL_SECONDS")
    if poll_raw is not None:
        try:
            poll = float(poll_raw)
            if poll <= 0:
                raise ValueError
        except ValueError:
            errors.append(f"biến {PREFIX}_RUNNER_POLL_SECONDS phải là số dương")

    cfg = ForecastConfig(
        store=store,
        db_url=db_url,
        jwt_public_key=get("JWT_PUBLIC_KEY", required=True) or "",
        jwt_key_id=get("JWT_KEY_ID", "k1") or "k1",
        jwt_issuer=get("JWT_ISSUER", "denguesense-identity") or "denguesense-identity",
        surveillance_url=get("SURVEILLANCE_URL", "http://surveillance:8082") or "",
        identity_url=get("IDENTITY_URL", "http://identity:8081") or "",
        client_secret=get("SERVICE_CLIENT_SECRET", required=True) or "",
        runner_poll_seconds=poll,
    )
    if errors:
        raise SettingsError("; ".join(errors))
    return cfg
