"""Use case của `forecast`: điều phối kho, nguồn panel, danh mục mô hình. Không biết HTTP (docs/09 §14.3)."""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from app.serving.common.problem import ApiError, FieldError, not_found, validation_error
from app.serving.forecast_api import engine, policy
from app.serving.forecast_api.auth import Actor, forbidden
from app.serving.forecast_api.catalog import Catalog
from app.serving.forecast_api.panel import PanelProvider
from app.serving.forecast_api.store import (
    IdempotencyConflict,
    RunRecord,
    RunStore,
    job_view,
)

HORIZONS = (1, 2, 3, 6)
CREATE_ROLES = ("analyst", "officer", "approver", "data_manager", "admin")
_VERSION = re.compile(r"^[a-z0-9-]+@[0-9]+\.[0-9]+\.[0-9]+$")
_DATA_VERSION = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+$")
_PROVINCE = re.compile(r"^[a-z][a-z0-9_]*$")
MODES = ("backtest", "live_experimental")
LIMITATIONS_REF = "/api/v1/model-card/limitations"


def run_not_found() -> ApiError:
    return ApiError(404, "forecast.run_not_found", "Không tìm thấy lượt dự báo")


def run_not_ready() -> ApiError:
    return ApiError(409, "forecast.run_not_ready", "Lượt dự báo chưa chạy xong")


class ForecastService:
    def __init__(
        self,
        store: RunStore,
        panels: PanelProvider,
        catalog: Catalog,
        notify: Callable[[], None] = lambda: None,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self.store = store
        self.panels = panels
        self.catalog = catalog
        self._notify = notify
        self._clock = clock

    # ---- ghi ----

    def create_run(
        self, actor: Actor | None, idempotency_key: str, body: dict[str, Any]
    ) -> tuple[dict[str, Any], str]:
        """Nhận yêu cầu tạo lượt (chạy nền). Trả (Job, đường dẫn Location)."""
        if actor is None or not actor.has(*CREATE_ROLES):
            raise forbidden("cần vai trò analyst trở lên")
        try:
            uuid.UUID(idempotency_key)
        except ValueError:
            raise validation_error(
                "đầu vào không hợp lệ", FieldError("Idempotency-Key", "phải là UUID")
            ) from None

        mode, origin = body.get("mode"), body.get("origin_month")
        if mode not in MODES:
            raise validation_error(
                "đầu vào không hợp lệ",
                FieldError("mode", "phải là backtest hoặc live_experimental"),
            )
        if not isinstance(origin, str) or not policy.is_year_month(origin):
            raise validation_error(
                "đầu vào không hợp lệ",
                FieldError("origin_month", "phải có dạng YYYY-MM"),
            )
        mv, dv = body.get("model_version"), body.get("data_version")
        if mv is not None and (not isinstance(mv, str) or not _VERSION.match(mv)):
            raise validation_error(
                "đầu vào không hợp lệ", FieldError("model_version", "sai định dạng")
            )
        if dv is not None and (not isinstance(dv, str) or not _DATA_VERSION.match(dv)):
            raise validation_error(
                "đầu vào không hợp lệ",
                FieldError("data_version", "phải có dạng vX.Y.Z"),
            )

        entry = self.catalog.current if mv is None else self.catalog.get(mv)
        if entry is None:
            raise not_found("không có phiên bản mô hình này")
        if entry.status != "approved":
            raise ApiError(
                409,
                "forecast.model_not_approved",
                "Phiên bản mô hình chưa được duyệt để chạy",
            )
        if mode == "live_experimental":
            # Chưa có đường dữ liệu đầu vào cho tháng hiện tại (thiếu số đo thật) — không giả vờ chạy được.
            raise ApiError(
                409,
                "forecast.model_not_approved",
                "Chế độ live_experimental chưa được bật",
                "chưa có mô hình được duyệt cho dữ liệu sau 2010",
            )
        if origin > engine.MAX_BACKTEST_ORIGIN:
            raise ApiError(
                400,
                "forecast.origin_out_of_range",
                "Tháng neo không hợp lệ cho chế độ này",
                f"backtest chỉ nhận tháng neo ≤ {engine.MAX_BACKTEST_ORIGIN}",
            )

        data_version = self.panels.resolve(dv)
        try:  # kiểm tháng neo có dữ liệu thật đủ cho mọi tầm NGAY LÚC NHẬN, không đợi job thất bại
            engine.validate_backtest_origin(self.panels.context(data_version), origin)
        except engine.EngineError as exc:
            status = (
                400
                if exc.code
                in ("forecast.origin_out_of_range", "common.validation_error")
                else 500
            )
            raise ApiError(
                status, exc.code, "Tháng neo không hợp lệ cho dữ liệu này", str(exc)
            ) from None

        request_hash = hashlib.sha256(
            json.dumps(body, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()
        try:
            outcome = self.store.submit(
                mode=mode,
                origin_month=origin,
                model_version=entry.model_version,
                data_version=data_version,
                actor_id=actor.id,
                org_id=actor.org_id,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                now=self._clock(),
            )
        except IdempotencyConflict:
            raise ApiError(
                409,
                "common.idempotency_key_reused",
                "Idempotency-Key đã dùng cho yêu cầu khác",
            ) from None
        if outcome.run.status in ("queued", "interrupted"):
            self._notify()
        return (
            job_view(outcome.job, outcome.run),
            f"/internal/v1/jobs/{outcome.job.job_id}",
        )

    # ---- đọc ----

    def get_job(self, job_id: str) -> dict[str, Any]:
        found = self.store.get_job(job_id)
        if not found:
            raise not_found("không tìm thấy job")
        return job_view(*found)

    def get_run(self, run_id: str) -> RunRecord:
        run = self.store.get_run(run_id)
        if run is None:
            raise run_not_found()
        return run

    def list_runs(
        self, mode: str | None, status: str | None, limit: int, cursor: str | None
    ) -> dict[str, Any]:
        if mode is not None and mode not in MODES:
            raise validation_error(
                "đầu vào không hợp lệ", FieldError("mode", "giá trị không hợp lệ")
            )
        if status is not None and status not in (
            "queued",
            "running",
            "completed",
            "failed",
            "interrupted",
            "cancelled",
        ):
            raise validation_error(
                "đầu vào không hợp lệ", FieldError("status", "giá trị không hợp lệ")
            )
        runs, nxt = self.store.list_runs(mode, status, limit, cursor)
        return {"items": [r.api() for r in runs], "next_cursor": nxt}

    def _completed(self, run_id: str) -> RunRecord:
        run = self.get_run(run_id)
        if run.status != "completed":
            raise run_not_ready()
        return run

    @staticmethod
    def meta(run: RunRecord, extras: dict[str, Any] | None) -> dict[str, Any]:
        meta: dict[str, Any] = {
            "run_id": run.run_id,
            "run_mode": run.run_mode,
            "model_version": run.model_version,
            "data_version": run.data_version,
            "origin_month": run.origin_month,
            "generated_at": run.api()["completed_at"],
            "limitations_ref": LIMITATIONS_REF,
        }
        if extras and extras.get("as_of"):
            meta["as_of"] = extras["as_of"]
        return meta

    def run_forecasts(self, run_id: str, horizon: int) -> dict[str, Any]:
        if horizon not in HORIZONS:
            raise validation_error(
                "đầu vào không hợp lệ", FieldError("horizon", "chỉ nhận 1, 2, 3 hoặc 6")
            )
        run = self._completed(run_id)
        extras = self.store.run_extras(run_id) or {}
        return {
            "meta": self.meta(run, extras),
            "horizon": horizon,
            "legend": {
                "exceed_prob": policy.exceed_prob_legend(),
                "cases_per_100k": extras.get("legend_cases_per_100k", []),
            },
            "items": self.store.forecasts(run_id, horizon=horizon),
        }

    def province_forecasts(self, run_id: str, province_id: str) -> dict[str, Any]:
        self._check_province(province_id)
        run = self._completed(run_id)
        items = self.store.forecasts(run_id, province_id=province_id)
        if not items:
            raise not_found("không có dự báo cho tỉnh này trong lượt")
        return {"meta": self.meta(run, self.store.run_extras(run_id)), "items": items}

    def explanation(
        self, run_id: str, province_id: str, horizon: int
    ) -> dict[str, Any]:
        if horizon not in HORIZONS:
            raise validation_error(
                "đầu vào không hợp lệ", FieldError("horizon", "chỉ nhận 1, 2, 3 hoặc 6")
            )
        self._check_province(province_id)
        run = self._completed(run_id)
        expl = self.store.explanation(run_id, province_id, horizon)
        if expl is None:
            raise not_found("không có giải thích cho tỉnh/tầm này")
        return {
            "meta": self.meta(run, self.store.run_extras(run_id)),
            "province_id": province_id,
            "horizon": horizon,
            "explained_component": engine.EXPLAINED_COMPONENT,
            "base_value": expl["base_value"],
            "factors": expl["factors"],
        }

    @staticmethod
    def _check_province(province_id: str) -> None:
        if not _PROVINCE.match(province_id):
            raise validation_error(
                "đầu vào không hợp lệ", FieldError("province_id", "sai định dạng")
            )

    # ---- mô hình ----

    def model_card(self) -> dict[str, Any]:
        return self.catalog.current.model_card

    def limitations(self) -> dict[str, Any]:
        return {
            "model_version": self.catalog.current.model_version,
            "items": self.catalog.current.limitations,
        }

    def model_versions(self) -> dict[str, Any]:
        return {"items": self.catalog.versions()}
