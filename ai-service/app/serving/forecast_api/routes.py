"""Adapter HTTP của `forecast` — hiện thực `contracts/openapi/forecast-internal.yaml`. Chỉ dịch HTTP ↔ use case.

Mọi route (trừ /healthz, /readyz ở `health_router`) đòi token DỊCH VỤ hợp lệ (fail-closed): dependency gắn ở cấp router nên
chạy TRƯỚC khi FastAPI kiểm tham số (thiếu token → 401, không phải 400).
"""

# Không dùng `from __future__ import annotations`: FastAPI cần đánh giá `Annotated[..., Depends(actor_dep)]` với biến cục bộ.

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse

from app.serving.common.problem import ApiError, FieldError, validation_error
from app.serving.forecast_api.auth import Actor
from app.serving.forecast_api.service import ForecastService

# Tên trường hợp lệ của CreateForecastRunRequest (additionalProperties: false).
_CREATE_FIELDS = {"mode", "origin_month", "model_version", "data_version"}
MAX_LIMIT = 100
DEFAULT_LIMIT = 50


def build_router(
    service: ForecastService,
    require_service: Any,
    actor_dep: Any,
) -> APIRouter:
    router = APIRouter(prefix="/internal/v1", dependencies=[Depends(require_service)])

    @router.get("/forecast-runs")
    def list_runs(
        mode: str | None = None,
        status: str | None = None,
        limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
        cursor: str | None = None,
    ) -> dict[str, Any]:
        return service.list_runs(mode, status, limit, cursor)

    @router.post("/forecast-runs", status_code=202)
    async def create_run(
        request: Request,
        actor: Annotated[Actor | None, Depends(actor_dep)],
        idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    ) -> JSONResponse:
        if not idempotency_key:
            raise ApiError(
                400, "common.idempotency_key_required", "Thiếu Idempotency-Key"
            )
        try:
            body = await request.json()
        except ValueError:
            raise validation_error("thân request không phải JSON hợp lệ") from None
        if not isinstance(body, dict):
            raise validation_error("thân request phải là một đối tượng JSON")
        unknown = sorted(set(body) - _CREATE_FIELDS)
        if unknown:
            raise validation_error(
                "đầu vào không hợp lệ",
                *(FieldError(k, "trường không được hỗ trợ") for k in unknown)
            )
        job, location = service.create_run(
            actor, idempotency_key, body
        )  # sync + có thể tải panel: chạy trong threadpool
        return JSONResponse(job, status_code=202, headers={"Location": location})

    @router.get("/forecast-runs/{run_id}")
    def get_run(run_id: str) -> dict[str, Any]:
        return service.get_run(run_id).api()

    @router.get("/forecast-runs/{run_id}/forecasts")
    def run_forecasts(run_id: str, horizon: int) -> dict[str, Any]:
        return service.run_forecasts(run_id, horizon)

    @router.get("/forecast-runs/{run_id}/provinces/{province_id}/forecasts")
    def province_forecasts(run_id: str, province_id: str) -> dict[str, Any]:
        return service.province_forecasts(run_id, province_id)

    @router.get("/forecast-runs/{run_id}/provinces/{province_id}/explanation")
    def explanation(run_id: str, province_id: str, horizon: int) -> dict[str, Any]:
        return service.explanation(run_id, province_id, horizon)

    @router.get("/model-card")
    def model_card() -> dict[str, Any]:
        return service.model_card()

    @router.get("/model-card/limitations")
    def limitations() -> dict[str, Any]:
        return service.limitations()

    @router.get("/model-versions")
    def model_versions() -> dict[str, Any]:
        return service.model_versions()

    @router.get("/jobs/{job_id}")
    def get_job(job_id: str) -> dict[str, Any]:
        return service.get_job(job_id)

    return router
