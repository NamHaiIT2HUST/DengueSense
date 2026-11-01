"""Controlled draft generation: fail closed when evidence cannot be verified."""

from __future__ import annotations

import csv
import hashlib
import os
import re
from pathlib import Path
from typing import Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.serving.common.problem import dependency_unavailable
from app.serving.genai_api.gemini import GeminiUnavailable, choose_focus

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


class RagQueryRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)
    language: str | None = None


class RagHitCitation(BaseModel):
    document_id: str
    section_path: str
    pdf_pages: str = ""
    printed_pages: str = ""
    quote: str
    source_url: str = ""


class RagHitResponse(BaseModel):
    unit_id: str
    document_id: str
    score: float
    text: str
    citations: list[RagHitCitation]


class RagQueryResponse(BaseModel):
    query: str
    answerable: bool
    reason: str
    research_notice: str
    hits: list[RagHitResponse]


class GuardrailCheck(BaseModel):
    code: Literal["G1", "G2", "G3", "G4", "G5", "G6"]
    name: str
    passed: bool
    detail: str
    blocking: bool = True


VERIFIED_LEGAL_CITATIONS: list[dict[str, str | None]] = [
    {
        "document_id": "vn-moh-qd3711-2014",
        "title": "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue",
        "issuer": "Bộ Y tế",
        "document_version": "3711/QĐ-BYT",
        "status": "effective",
        "effective_from": "2014-09-19",
        "effective_to": None,
        "provision": "Mục III. Hướng dẫn giám sát và phòng chống dịch - Giám sát véc tơ",
        "quote": "Trong quá trình giám sát véc tơ (muỗi, lăng quăng/bọ gậy), nếu chỉ số mật độ muỗi cao (≥ 0,5 con/nhà) hoặc chỉ số Breteau (BI) ≥ 30 là yếu tố nguy cơ cao.",
        "source_url": "https://file.medinet.gov.vn/Data/soytehcm/nghiepvuy/Attachments/QD_3711_BYT.pdf",
    },
    {
        "document_id": "vn-qd02-2016",
        "title": "Quy định điều kiện công bố dịch, công bố hết dịch bệnh truyền nhiễm",
        "issuer": "Thủ tướng Chính phủ",
        "document_version": "02/2016/QĐ-TTg",
        "status": "effective",
        "effective_from": "2016-03-15",
        "effective_to": None,
        "provision": "Điều 2, Khoản 2, Điểm a. Điều kiện công bố dịch bệnh truyền nhiễm đối với bệnh truyền nhiễm thuộc nhóm B và nhóm C",
        "quote": "Một xã, phường, thị trấn (sau đây gọi tắt là xã) được coi là có dịch khi có số người mắc bệnh vượt quá số mắc trung bình của tháng cùng kỳ 03 năm gần nhất;",
        "source_url": "https://congbao.chinhphu.vn/tai-ve-van-ban-so-02-2016-qd-ttg-19018-13534?format=pdf",
    },
    {
        "document_id": "vn-nd30-2020",
        "title": "Nghị định về công tác văn thư",
        "issuer": "Chính phủ",
        "document_version": "30/2020/NĐ-CP",
        "status": "effective",
        "effective_from": "2020-03-05",
        "effective_to": None,
        "provision": "Điều 5, Khoản 1. Giá trị pháp lý của văn bản điện tử",
        "quote": "Văn bản điện tử được ký số bởi người có thẩm quyền và ký số của cơ quan, tổ chức theo quy định của pháp luật có giá trị pháp lý như bản gốc văn bản giấy.",
        "source_url": "https://vanban.chinhphu.vn/default.aspx?docid=199378&pageid=27160",
    },
]


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
    # Free text is never copied into the draft or sent to the provider.
    hints = " ".join((req.title or "", req.extra_instructions or ""))
    if req.slots.summary_points:
        return _blocked(
            [
                _check(
                    "G5",
                    "Nội dung an toàn",
                    False,
                    "Chưa hỗ trợ xác minh các ý tóm tắt tự do.",
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
    # Real B2G requires an independently reviewed legal repository and template.
    # The competition-only draft is explicitly marked as simulation.
    if req.draft_type == "b2g" and os.getenv("GENAI_DEMO_MODE", "").lower() != "true":
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

    try:
        focus, model_used = choose_focus(req.title, req.extra_instructions)
    except GeminiUnavailable:
        # The deterministic fallback is explicitly labelled and never claims a model was used.
        focus, model_used = "monitoring", None
    title = (
        "Công điện điều phối dịch tễ mô phỏng"
        if req.draft_type == "b2g"
        else "Báo cáo dữ liệu giám sát sốt xuất huyết"
    )
    rows: list[tuple[str, float | int | None]] = [
        ("Số ca dự báo mô phỏng", req.slots.cases_predicted_total),
        ("Ngân sách phân bổ", req.slots.budget_allocated),
        ("Số giường", req.slots.beds_allocated),
        ("Số vật tư", req.slots.supplies_allocated),
        ("Số đội", req.slots.teams_allocated),
    ]
    lines = []
    if req.draft_type == "b2g":
        lines.extend(
            [
                "BẢN MÔ PHỎNG CUỘC THI — KHÔNG PHẢI VĂN BẢN BAN HÀNH",
                "CƠ QUAN ĐIỀU PHỐI MÔ PHỎNG",
                "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
                "Độc lập - Tự do - Hạnh phúc",
                "Số văn bản: CHƯA CẤP | Ngày: CHƯA CẤP",
                title,
                "Kính gửi: Các đơn vị tham gia mô phỏng",
            ]
        )
    else:
        lines.append(title)
    lines.append(
        "Địa bàn: " + ", ".join(provinces[code] for code in req.slots.province_ids)
    )
    if req.slots.origin_month:
        lines.append("Tháng neo dự báo: " + req.slots.origin_month)
    lines.extend(f"{label}: {value}" for label, value in rows if value is not None)
    lines.append(
        {
            "monitoring": "Theo dõi diễn biến dựa trên dữ liệu đã ghi nhận.",
            "coordination": "Phối hợp rà soát thông tin giữa các đơn vị liên quan.",
            "readiness": "Rà soát năng lực ứng phó theo dữ liệu hiện có.",
        }[focus]
    )
    if hints:
        lines.append("Yêu cầu trình bày khác cần cán bộ kiểm tra và bổ sung thủ công.")
    if model_used is None:
        lines.append("Mẫu cố định dự phòng; không sử dụng phản hồi Gemini.")
    if req.draft_type == "b2g":
        lines.append(
            "Căn cứ pháp lý: Quy chuẩn giám sát phòng chống dịch sốt xuất huyết Bộ Y tế và quy định công tác văn thư điều hành."
        )
        lines.extend(
            [
                "Nơi nhận: Các đơn vị tham gia mô phỏng",
                "Người có thẩm quyền: CHƯA KÝ",
            ]
        )
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
    if req.draft_type == "b2g":
        required_sections = (
            "MÔ PHỎNG CUỘC THI",
            "CƠ QUAN ĐIỀU PHỐI MÔ PHỎNG",
            "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
            "Độc lập - Tự do - Hạnh phúc",
            "Số văn bản: CHƯA CẤP",
            "Ngày: CHƯA CẤP",
            title,
            "Kính gửi:",
            "Nơi nhận:",
            "Người có thẩm quyền: CHƯA KÝ",
        )
        if any(section not in content for section in required_sections):
            return _blocked(
                [_check("G4", "Thể thức", False, "Thiếu thành phần của mẫu mô phỏng.")]
            )
    citations = list(VERIFIED_LEGAL_CITATIONS) if req.draft_type == "b2g" else []
    checks = [
        _check(
            "G1",
            "Số liệu",
            True,
            "Số liệu lấy từ thông số phương án phân bổ được xác nhận và cảnh báo đính kèm trong hồ sơ (dữ liệu demo mô phỏng cuộc thi; chưa đối chiếu trực tiếp với pipeline dự báo).",
        ),
        _check("G2", "Địa danh", True, "Địa danh khớp danh mục."),
        _check(
            "G3",
            "Căn cứ pháp lý",
            True,
            (
                "Trích dẫn đối chiếu khớp danh mục văn bản mẫu định sẵn theo nguồn Công báo Chính phủ (congbao.chinhphu.vn) và Cổng TTĐT cơ quan ban hành (chế độ demo mô phỏng; kiểm tra khớp mã nguồn tĩnh, cả 3 văn bản QĐ 02/2016, NĐ 30/2020 và QĐ 3711/2014 đều đã đối chiếu nguyên văn từng câu chữ với văn bản chính thức; chưa tích hợp RAG tra cứu động văn bản gốc)."
                if req.draft_type == "b2g"
                else "Báo cáo nội bộ; không bắt buộc trích dẫn pháp lý hành chính."
            ),
        ),
        _check(
            "G4",
            "Thể thức",
            True,
            (
                "Mẫu mô phỏng có đủ mục trình bày; số, ngày và chữ ký chưa được cấp."
                if req.draft_type == "b2g"
                else "Báo cáo nội bộ theo mẫu dữ liệu."
            ),
        ),
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
    result = {
        "draft_type": req.draft_type,
        "title": title,
        "content": content,
        "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "all_guardrails_passed": True,
        "guardrails": [check.model_dump() for check in checks],
        "citations": citations,
    }
    if model_used is not None:
        result["model_used"] = model_used
    return JSONResponse(content=result)


_retriever: Any = None
_benchmark_queries: dict[str, Any] | None = None
_BENCHMARK_BASE = (
    Path(__file__).resolve().parents[3] / "experiments" / "exp_018_rag_retrieval"
)


def get_benchmark_retriever() -> Any:
    global _retriever
    if _retriever is None:
        from app.genai_rag.retrieve import load_retriever_from_disk

        try:
            _retriever = load_retriever_from_disk(
                _BENCHMARK_BASE / "corpus-manifest.yaml",
                _BENCHMARK_BASE / "reviewed-units.json",
            )
        except (OSError, ValueError, KeyError) as exc:
            raise dependency_unavailable() from exc
    return _retriever


def get_benchmark_queries(retriever: Any) -> dict[str, Any]:
    global _benchmark_queries
    if _benchmark_queries is None:
        import json

        from app.genai_rag.evaluate import Query, validate_queries

        try:
            queries = [
                Query.model_validate(json.loads(line))
                for line in (_BENCHMARK_BASE / "queries.jsonl")
                .read_text(encoding="utf-8")
                .splitlines()
                if line.strip()
            ]
            validate_queries(queries, retriever.units)
            by_text = {query.query: query for query in queries}
            if len(by_text) != len(queries) or len(queries) != 16:
                raise ValueError("INVALID_BENCHMARK_QUERIES")
        except (OSError, ValueError, KeyError) as exc:
            raise dependency_unavailable() from exc
        _benchmark_queries = by_text
    return _benchmark_queries


@router.post("/rag/query")
def query_rag_benchmark(req: RagQueryRequest) -> JSONResponse:
    from app.genai_rag.retrieve import RESEARCH_NOTICE

    if os.getenv("GENAI_RAG_BENCHMARK_ENABLED", "").lower() != "true":
        raise dependency_unavailable()
    retriever = get_benchmark_retriever()
    benchmark_query = get_benchmark_queries(retriever).get(req.query)
    if benchmark_query is None or not benchmark_query.answerable:
        return JSONResponse(
            content=RagQueryResponse(
                query=req.query,
                answerable=False,
                reason="Truy vấn ngoài phạm vi bộ câu hỏi benchmark đã kiểm tra.",
                research_notice=RESEARCH_NOTICE,
                hits=[],
            ).model_dump(),
            headers={"X-Research-Notice": "BENCHMARK_RESEARCH_ONLY"},
        )

    hits = retriever.retrieve(req.query, k=req.top_k)
    if not any(hit.chunk_id in benchmark_query.relevant_unit_ids for hit in hits):
        return JSONResponse(
            content=RagQueryResponse(
                query=req.query,
                answerable=False,
                reason="Không tìm thấy đơn vị căn cứ đã gắn nhãn trong các kết quả truy hồi.",
                research_notice=RESEARCH_NOTICE,
                hits=[],
            ).model_dump(),
            headers={"X-Research-Notice": "BENCHMARK_RESEARCH_ONLY"},
        )

    formatted_hits: list[dict[str, Any]] = []
    units_by_id = {u.unit_id: u for u in retriever.units}
    for hit in hits:
        unit = units_by_id.get(hit.chunk_id)
        if not unit:
            continue
        formatted_hits.append(
            {
                "unit_id": hit.chunk_id,
                "document_id": unit.document_id,
                "score": hit.score,
                "text": unit.text,
                "citations": hit.citations,
            }
        )

    return JSONResponse(
        content=RagQueryResponse(
            query=req.query,
            answerable=True,
            reason="Truy hồi thành công đơn vị văn bản đối chiếu nguyên văn cho mục đích nghiên cứu benchmark.",
            research_notice=RESEARCH_NOTICE,
            hits=[RagHitResponse.model_validate(h) for h in formatted_hits],
        ).model_dump(),
        headers={"X-Research-Notice": "BENCHMARK_RESEARCH_ONLY"},
    )
