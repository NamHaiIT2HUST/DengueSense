"""Controlled draft generation: fail closed when evidence cannot be verified."""

from __future__ import annotations

import csv
import hashlib
import re
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

router = APIRouter()


class SlotProvenance(BaseModel):
    model_version: str | None = None
    data_version: str | None = None
    plan_id: UUID | None = None
    plan_version: int | None = Field(default=None, ge=1)
    plan_hash: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    source_flags: list[str] | None = None


class SlotsData(BaseModel):
    run_id: UUID
    province_ids: list[str] = Field(min_length=1)
    origin_month: str | None = Field(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    cases_predicted_total: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    budget_allocated: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    beds_allocated: int | None = Field(default=None, ge=0)
    supplies_allocated: int | None = Field(default=None, ge=0)
    teams_allocated: int | None = Field(default=None, ge=0)
    summary_points: list[str] | None = None
    provenance: SlotProvenance | None = None


class GenerateDraftRequest(BaseModel):
    draft_type: Literal["b2b", "b2g"]
    case_id: UUID | None = None
    title: str | None = None
    slots: SlotsData
    extra_instructions: str | None = None


class GuardrailCheck(BaseModel):
    code: Literal["G1", "G2", "G3", "G4", "G5", "G6"]
    name: str
    passed: bool
    detail: str
    blocking: bool = True


def _provinces() -> dict[str, str]:
    path = Path(__file__).with_name("province_metadata.csv")
    with path.open(encoding="utf-8", newline="") as file:
        return {
            row["new_province_code"]: row["new_province_name"]
            for row in csv.DictReader(file)
        }


def _check(
    code: Literal["G1", "G2", "G3", "G4", "G5", "G6"],
    name: str,
    passed: bool,
    detail: str,
    *,
    blocking: bool = True,
) -> GuardrailCheck:
    return GuardrailCheck(
        code=code, name=name, passed=passed, detail=detail, blocking=blocking
    )


def _blocked(checks: list[GuardrailCheck]) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        media_type="application/problem+json",
        content={
            "type": "https://denguesense.vn/errors/guardrail-blocked",
            "title": "Dự thảo không đạt kiểm tra tự động",
            "status": 422,
            "code": "genai.guardrail_blocked",
            "request_id": str(uuid4()),
            "guardrails": [check.model_dump() for check in checks],
        },
    )


@router.post("/draft")
def generate_draft(req: GenerateDraftRequest) -> JSONResponse:
    # Free text is not trusted as data or policy; it cannot enter the template.
    if req.title or req.extra_instructions or req.slots.summary_points:
        return _blocked(
            [
                _check(
                    "G5",
                    "Nội dung an toàn",
                    False,
                    "Chưa hỗ trợ xác minh nội dung tự do.",
                )
            ]
        )
    try:
        provinces = _provinces()
    except (OSError, KeyError, csv.Error):
        return _blocked(
            [_check("G2", "Địa danh", False, "Danh mục địa danh không khả dụng.")]
        )
    if any(code not in provinces for code in req.slots.province_ids):
        return _blocked(
            [_check("G2", "Địa danh", False, "Có địa danh không có trong danh mục.")]
        )
    # B2G requires verified legal citations and a reviewed administrative template.
    # Neither is provisioned yet; never present fabricated legal evidence.
    if req.draft_type == "b2g":
        return _blocked(
            [
                _check(
                    "G3",
                    "Căn cứ pháp lý",
                    False,
                    "Chưa có kho căn cứ pháp lý đã xác minh.",
                )
            ]
        )

    title = "Báo cáo dữ liệu giám sát sốt xuất huyết"
    rows: list[tuple[str, float | int | None]] = [
        ("Số ca dự báo", req.slots.cases_predicted_total),
        ("Ngân sách phân bổ", req.slots.budget_allocated),
        ("Số giường", req.slots.beds_allocated),
        ("Số vật tư", req.slots.supplies_allocated),
        ("Số đội", req.slots.teams_allocated),
    ]
    lines = [
        title,
        "Địa bàn: " + ", ".join(provinces[code] for code in req.slots.province_ids),
    ]
    if req.slots.origin_month:
        lines.append("Tháng dự báo: " + req.slots.origin_month)
    lines.extend(f"{label}: {value}" for label, value in rows if value is not None)
    lines.append("Dự thảo phục vụ cán bộ rà soát; chưa phải lệnh điều phối.")
    content = "\n".join(lines)
    # Numeric literals are emitted exclusively by the fixed template and slots.
    actual = re.findall(r"\d+(?:\.\d+)?", content)
    allowed = re.findall(
        r"\d+(?:\.\d+)?",
        " ".join(str(v) for _, v in rows if v is not None)
        + " "
        + (req.slots.origin_month or ""),
    )
    if any(number not in allowed for number in actual):
        return _blocked(
            [_check("G1", "Số liệu", False, "Nội dung có số liệu ngoài nguồn.")]
        )
    checks = [
        _check("G1", "Số liệu", True, "Số liệu lấy từ slots."),
        _check("G2", "Địa danh", True, "Địa danh khớp danh mục."),
        _check("G3", "Căn cứ pháp lý", True, "Không có trích dẫn pháp lý."),
        _check("G4", "Thể thức", True, "Báo cáo nội bộ theo mẫu dữ liệu."),
        _check(
            "G5",
            "Nội dung an toàn",
            True,
            "Mẫu không chứa chỉ định y khoa hoặc nội dung tự do.",
        ),
        _check(
            "G6",
            "Độ dài",
            80 <= len(content) <= 5000,
            "Cán bộ cần rà soát độ dài.",
            blocking=False,
        ),
    ]
    return JSONResponse(
        content={
            "draft_type": req.draft_type,
            "title": title,
            "content": content,
            "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
            "all_guardrails_passed": True,
            "guardrails": [check.model_dump() for check in checks],
            "citations": [],
        }
    )
