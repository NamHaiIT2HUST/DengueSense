"""Điểm vào service `forecast`.

Chạy:  uvicorn app.serving.forecast_api.main:create_app_from_env --factory --host 0.0.0.0 --port 8001

Đợt 0: chỉ có khung hạ tầng (request-id, log JSON, problem+json, /healthz, /readyz). Endpoint nội bộ
(`/internal/v1/forecast-runs`…) được thêm ở Đợt 1 sau khi có hợp đồng `contracts/openapi/forecast-internal.yaml`
(docs/09 §17.1: hợp đồng trước, code sau). Logic ML nằm ở `app.forecast`, KHÔNG viết lại ở đây (ADR-0007).
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from fastapi import FastAPI

from app.serving.common.health import ReadyCheck, health_router
from app.serving.common.logging import configure_logging
from app.serving.common.middleware import ObservabilityMiddleware
from app.serving.common.problem import install_error_handlers
from app.serving.common.settings import ServingSettings, load_settings

SERVICE = "forecast"
ENV_PREFIX = "FORECAST"


def create_app(
    settings: ServingSettings, readiness: Sequence[ReadyCheck] = ()
) -> FastAPI:
    """Dựng ứng dụng. `readiness` là các kiểm tra phụ thuộc cho /readyz (Đợt 1: DB, NATS)."""
    logger = configure_logging(SERVICE, settings.version, settings.log_level)
    app = FastAPI(
        title="DengueSense forecast (internal)",
        version=settings.version,
        docs_url=None,  # không tải Swagger UI từ CDN; hợp đồng nằm ở contracts/
        redoc_url=None,
    )
    install_error_handlers(app)
    app.include_router(health_router(readiness))
    app.add_middleware(
        ObservabilityMiddleware, logger=logger, max_body_bytes=settings.max_body_bytes
    )
    return app


def create_app_from_env(env: Mapping[str, str] | None = None) -> FastAPI:
    """Factory cho uvicorn: đọc cấu hình từ môi trường, fail-fast nếu sai."""
    return create_app(load_settings(SERVICE, ENV_PREFIX, env))
