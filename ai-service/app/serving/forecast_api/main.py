"""Điểm vào service `forecast`.

Chạy:  uvicorn app.serving.forecast_api.main:create_app_from_env --factory --host 0.0.0.0 --port 8001

`create_app` dựng khung hạ tầng (request-id, log JSON, problem+json, /healthz, /readyz); khi được truyền `service` + `verifier`
thì gắn thêm API nội bộ `/internal/v1/*` (fail-closed bằng token dịch vụ) và luồng nền chạy job. Logic ML nằm ở
`app.forecast`, KHÔNG viết lại ở đây (ADR-0007).
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Mapping, Sequence
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI

from app.serving.common.health import ReadyCheck, health_router
from app.serving.common.logging import configure_logging
from app.serving.common.middleware import ObservabilityMiddleware
from app.serving.common.problem import install_error_handlers
from app.serving.common.settings import ServingSettings, load_settings
from app.serving.forecast_api.auth import (
    ServiceVerifier,
    make_dependencies,
    parse_public_key,
)
from app.serving.forecast_api.catalog import Catalog
from app.serving.forecast_api.config import ForecastConfig, load_config
from app.serving.forecast_api.panel import ServiceTokenSource, SurveillancePanelProvider
from app.serving.forecast_api.routes import build_router
from app.serving.forecast_api.runner import JobRunner
from app.serving.forecast_api.service import ForecastService
from app.serving.forecast_api.store import MemoryRunStore, PostgresRunStore, RunStore

SERVICE = "forecast"
ENV_PREFIX = "FORECAST"


def create_app(
    settings: ServingSettings,
    readiness: Sequence[ReadyCheck] = (),
    *,
    service: ForecastService | None = None,
    verifier: ServiceVerifier | None = None,
    runner: JobRunner | None = None,
) -> FastAPI:
    """Dựng ứng dụng. `readiness` là các kiểm tra phụ thuộc cho /readyz."""
    if (service is None) != (verifier is None):
        raise ValueError(
            "service và verifier phải đi cùng nhau (không mở API mà thiếu xác thực)"
        )
    logger = configure_logging(SERVICE, settings.version, settings.log_level)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        if runner:
            runner.start()
        try:
            yield
        finally:
            if runner:
                runner.stop()

    app = FastAPI(
        title="DengueSense forecast (internal)",
        version=settings.version,
        docs_url=None,  # không tải Swagger UI từ CDN; hợp đồng nằm ở contracts/
        redoc_url=None,
        openapi_url=None,  # không lộ lược đồ tự sinh (route không xác thực = lỗ hổng fail-open)
        lifespan=lifespan,
    )
    install_error_handlers(app)
    app.include_router(health_router(readiness))
    if service is not None and verifier is not None:
        require_service, actor = make_dependencies(verifier)
        app.include_router(build_router(service, require_service, actor))
    app.add_middleware(
        ObservabilityMiddleware, logger=logger, max_body_bytes=settings.max_body_bytes
    )
    return app


def build_store(cfg: ForecastConfig) -> RunStore:
    if cfg.store == "memory":
        return MemoryRunStore()
    from psycopg_pool import ConnectionPool

    assert cfg.db_url  # load_config đã bắt buộc
    pool = ConnectionPool(
        cfg.db_url, min_size=1, max_size=8, open=True, kwargs={"autocommit": True}
    )
    return PostgresRunStore(pool)


def create_app_from_env(env: Mapping[str, str] | None = None) -> FastAPI:
    """Factory cho uvicorn: đọc cấu hình từ môi trường, fail-fast nếu sai."""
    settings = load_settings(SERVICE, ENV_PREFIX, env)
    cfg = load_config(env)
    verifier = ServiceVerifier(
        {cfg.jwt_key_id: parse_public_key(cfg.jwt_public_key)}, cfg.jwt_issuer, SERVICE
    )

    client = httpx.Client(timeout=httpx.Timeout(30.0, connect=3.0))
    tokens = ServiceTokenSource(cfg.identity_url, SERVICE, cfg.client_secret, client)
    panels = SurveillancePanelProvider(cfg.surveillance_url, tokens, client)
    store = build_store(cfg)
    runner = JobRunner(store, panels, poll_seconds=cfg.runner_poll_seconds)
    service = ForecastService(store, panels, Catalog.load(), notify=runner.notify)

    async def ready_store() -> None:
        await asyncio.to_thread(
            store.ping
        )  # kết nối DB là thao tác chặn — không chạy trên vòng lặp sự kiện

    return create_app(
        settings, [ready_store], service=service, verifier=verifier, runner=runner
    )
