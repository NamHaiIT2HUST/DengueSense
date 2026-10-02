"""Lỗi `application/problem+json` (RFC 9457) — cùng hình dạng và mã với `backend/pkg/httpx`.

Mã lỗi (`code`) PHẢI có trong `contracts/errors.md` (test kiểm). Lỗi không lường trước chỉ để lại chi tiết
trong log; thân phản hồi không bao giờ chứa stack trace, câu SQL, đường dẫn nội bộ hay giá trị đầu vào.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.serving.common.logging import request_id_var

PROBLEM_CONTENT_TYPE = "application/problem+json"
TYPE_BASE = "https://denguesense.vn/errors/"


@dataclass(frozen=True)
class FieldError:
    field: str
    message: str


class ApiError(Exception):
    """Lỗi nghiệp vụ có mã ổn định; handler `raise ApiError(...)`, adapter chuyển thành problem+json.

    Cố ý là lớp thường (không phải dataclass frozen): ngoại lệ frozen làm hỏng việc gán `__traceback__`.
    """

    def __init__(
        self,
        status: int,
        code: str,
        title: str,
        detail: str = "",
        fields: tuple[FieldError, ...] = (),
    ) -> None:
        super().__init__(f"{code}: {title}")
        self.status = status
        self.code = code
        self.title = title
        self.detail = detail
        self.fields = fields


def validation_error(detail: str, *fields: FieldError) -> ApiError:
    return ApiError(
        400, "common.validation_error", "Đầu vào không hợp lệ", detail, fields
    )


def not_found(detail: str = "") -> ApiError:
    return ApiError(404, "common.not_found", "Không tìm thấy", detail)


def method_not_allowed() -> ApiError:
    return ApiError(405, "common.method_not_allowed", "Phương thức không được hỗ trợ")


def internal_error() -> ApiError:
    return ApiError(500, "common.internal_error", "Có lỗi xảy ra")


def dependency_unavailable() -> ApiError:
    return ApiError(
        503, "common.dependency_unavailable", "Dịch vụ phụ thuộc không khả dụng"
    )


def problem_body(error: ApiError, instance: str) -> dict[str, Any]:
    suffix = error.code.split(".", 1)[-1].replace("_", "-")
    body: dict[str, Any] = {
        "type": TYPE_BASE + suffix,
        "title": error.title,
        "status": error.status,
        "code": error.code,
        "request_id": request_id_var.get() or "",
    }
    if error.detail:
        body["detail"] = error.detail
    if instance:
        body["instance"] = instance
    if error.fields:
        body["errors"] = [
            {"field": f.field, "message": f.message} for f in error.fields
        ]
    return body


def problem_response(error: ApiError, instance: str) -> JSONResponse:
    return JSONResponse(
        problem_body(error, instance),
        status_code=error.status,
        media_type=PROBLEM_CONTENT_TYPE,
    )


def _field_path(loc: tuple[Any, ...]) -> str:
    # loc = ("body", "origin_month") → "origin_month"; bỏ tiền tố nguồn (body/query/path/header).
    parts = [str(p) for p in loc]
    if parts and parts[0] in {"body", "query", "path", "header", "cookie"}:
        parts = parts[1:]
    return ".".join(parts) or "(root)"


def install_error_handlers(app: FastAPI) -> None:
    """Mọi đường lỗi của FastAPI/Starlette đều ra problem+json."""

    async def on_validation(request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, RequestValidationError)
        # KHÔNG dùng exc.errors()[i]["input"] / ["msg"] trực tiếp: có thể lặp lại giá trị người dùng gửi.
        fields = tuple(
            FieldError(_field_path(tuple(e["loc"])), _safe_message(str(e["type"])))
            for e in exc.errors()
        )
        return problem_response(
            validation_error("đầu vào không hợp lệ", *fields), request.url.path
        )

    async def on_http(request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, StarletteHTTPException)
        if exc.status_code == 404:
            err = not_found("đường dẫn không tồn tại")
        elif exc.status_code == 405:
            err = method_not_allowed()
        elif exc.status_code < 500:
            err = ApiError(
                exc.status_code, "common.validation_error", "Yêu cầu không hợp lệ"
            )
        else:
            err = internal_error()
        return problem_response(err, request.url.path)

    async def on_api_error(request: Request, exc: Exception) -> JSONResponse:
        assert isinstance(exc, ApiError)
        return problem_response(exc, request.url.path)

    app.add_exception_handler(RequestValidationError, on_validation)
    app.add_exception_handler(StarletteHTTPException, on_http)
    app.add_exception_handler(ApiError, on_api_error)


def _safe_message(error_type: str) -> str:
    """Thông điệp theo LOẠI lỗi pydantic (không chứa giá trị đầu vào)."""
    if error_type == "missing":
        return "trường bắt buộc"
    if error_type.endswith(("_type", "_parsing")):
        return "sai kiểu dữ liệu"
    if error_type.startswith("literal") or error_type == "enum":
        return "giá trị không thuộc tập cho phép"
    if error_type == "extra_forbidden":
        return "trường không được phép"
    return "giá trị không hợp lệ"
