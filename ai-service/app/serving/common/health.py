"""Health check: /healthz (sống) và /readyz (sẵn sàng) — docs/09 §12.3.

`/healthz` KHÔNG kiểm phụ thuộc (dùng để quyết định restart). `/readyz` kiểm phụ thuộc (DB, NATS…) với thời hạn
2 giây; lỗi → 503 problem+json không lộ chi tiết phụ thuộc.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Sequence

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.serving.common.problem import dependency_unavailable, problem_response

ReadyCheck = Callable[[], Awaitable[None]]
READY_TIMEOUT_SECONDS = 2.0


def health_router(checks: Sequence[ReadyCheck] = ()) -> APIRouter:
    router = APIRouter(tags=["health"])

    @router.get("/healthz", include_in_schema=False)
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @router.get("/readyz", include_in_schema=False, response_model=None)
    async def readyz() -> JSONResponse | dict[str, str]:
        try:
            async with asyncio.timeout(READY_TIMEOUT_SECONDS):
                for check in checks:
                    await check()
        # Mọi lỗi phụ thuộc (kể cả timeout) → 503 chung, không lộ chi tiết.
        except Exception:  # noqa: BLE001
            return problem_response(dependency_unavailable(), "/readyz")
        return {"status": "ready"}

    return router
