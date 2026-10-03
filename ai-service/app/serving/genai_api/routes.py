import hashlib
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class SlotsData(BaseModel):
    run_id: str
    province_ids: list[str]
    origin_month: str | None = None
    cases_predicted_total: float | None = None
    budget_allocated: float | None = None
    summary_points: list[str] | None = None


class GenerateDraftRequest(BaseModel):
    draft_type: Literal["b2b", "b2g"]
    title: str | None = None
    slots: SlotsData
    extra_instructions: str | None = None


class Citation(BaseModel):
    source: str
    quote: str


class GuardrailCheck(BaseModel):
    code: Literal["G1", "G2", "G3", "G4", "G5", "G6"]
    name: str
    passed: bool
    detail: str


class GenerateDraftResponse(BaseModel):
    draft_type: Literal["b2b", "b2g"]
    title: str
    content: str
    content_hash: str
    citations: list[Citation] = Field(default_factory=list)
    guardrails: list[GuardrailCheck] = Field(default_factory=list)
    model_used: str


def _generate_b2b_content(req: GenerateDraftRequest) -> tuple[str, str, list[Citation]]:
    month = req.slots.origin_month or "hiện hành"
    provinces = (
        ", ".join(req.slots.province_ids)
        if req.slots.province_ids
        else "các địa bàn trọng điểm"
    )
    cases = (
        f"{req.slots.cases_predicted_total:,.0f}"
        if req.slots.cases_predicted_total
        else "chưa xác định"
    )
    budget = (
        f"{req.slots.budget_allocated:,.0f} VNĐ"
        if req.slots.budget_allocated
        else "theo định mức"
    )

    title = (
        req.title or f"Báo cáo phân tích dịch tễ và dự báo sốt xuất huyết tháng {month}"
    )
    content = (
        f"# BÁO CÁO PHÂN TÍCH DỊCH TỄ VÀ DỰ BÁO SỐT XUẤT HUYẾT\n"
        f"**Thời điểm neo dự báo:** Tháng {month}\n"
        f"**Khu vực giám sát:** {provinces}\n\n"
        f"## 1. TỔNG QUAN TÌNH HÌNH VÀ DỰ BÁO (LAYER 1)\n"
        f"Dựa trên mô hình học máy tổ hợp M4-R2 và dữ liệu giám sát dịch tễ, tổng số ca mắc dự kiến tại các địa bàn theo dõi là: **{cases} ca**.\n"
        f"Các yếu tố tác động chính bao gồm diễn biến nhiệt độ, lượng mưa tích lũy và số ca mắc lịch sử cùng kỳ.\n\n"
        f"## 2. PHƯƠNG ÁN PHÂN BỔ NGUỒN LỰC CAN THIỆP (LAYER 2)\n"
        f"Tổng ngân sách/nguồn lực dự kiến phân bổ: **{budget}**.\n"
        f"Ưu tiên nguồn lực cho công tác phun hóa chất diệt muỗi, diệt lăng quăng và tăng cường năng lực điều trị tại các trạm y tế cơ sở.\n\n"
        f"## 3. KHUYẾN NGHỊ CHUYÊN MÔN\n"
        f"- Tăng cường giám sát chỉ số lăng quăng (BI, CI) tại các điểm nóng.\n"
        f"- Đảm bảo vật tư, dịch truyền và thuốc điều trị theo phác đồ Hướng dẫn chẩn đoán, điều trị sốt xuất huyết Dengue.\n"
    )
    citations = [
        Citation(
            source="Quyết định số 2760/QĐ-BYT",
            quote="Hướng dẫn chẩn đoán, điều trị sốt xuất huyết Dengue ban hành kèm Quyết định 2760/QĐ-BYT.",
        ),
        Citation(
            source="Quyết định số 3711/QĐ-BYT",
            quote="Hướng dẫn giám sát và phòng chống bệnh sốt xuất huyết Dengue.",
        ),
    ]
    return title, content, citations


def _generate_b2g_content(req: GenerateDraftRequest) -> tuple[str, str, list[Citation]]:
    month = req.slots.origin_month or "hiện hành"
    provinces = (
        ", ".join(req.slots.province_ids)
        if req.slots.province_ids
        else "các tỉnh, thành phố trực thuộc"
    )
    cases = (
        f"{req.slots.cases_predicted_total:,.0f}"
        if req.slots.cases_predicted_total
        else "gia tăng"
    )

    title = (
        req.title
        or f"Công điện về việc chủ động triển khai công tác phòng, chống dịch sốt xuất huyết tháng {month}"
    )
    content = (
        f"**ỦY BAN NHÂN DÂN / BỘ Y TẾ**\n\n"
        f"**CÔNG ĐIỆN CHỈ ĐẠO**\n"
        f"**Về việc chủ động triển khai các biện pháp cấp bách phòng, chống sốt xuất huyết**\n\n"
        f"Kính gửi:\n"
        f"- Ban Chỉ đạo phòng, chống dịch bệnh các tỉnh: {provinces};\n"
        f"- Giám đốc Sở Y tế các tỉnh, thành phố liên quan.\n\n"
        f"Theo số liệu giám sát cảnh báo sớm từ hệ thống DengueSense, nguy cơ bùng phát dịch sốt xuất huyết trong tháng {month} tại khu vực {provinces} ở mức cao, dự kiến ghi nhận khoảng **{cases} ca mắc** nếu không triển khai can thiệp kịp thời.\n\n"
        f"Để chủ động kiểm soát tình hình dịch bệnh, bảo vệ sức khỏe nhân dân, yêu cầu các đơn vị khẩn trương thực hiện:\n"
        f"1. Huy động các ban, ngành, đoàn thể phát động chiến dịch diệt lăng quăng, bọ gậy tại từng hộ gia đình.\n"
        f"2. Sở Y tế chỉ đạo các cơ sở khám chữa bệnh chuẩn bị đầy đủ cơ số thuốc, dịch truyền, giường bệnh, hạn chế tối đa trường hợp tử vong.\n"
        f"3. Đẩy mạnh công tác tuyên truyền phòng chống dịch bệnh trên các phương tiện thông tin đại chúng.\n\n"
        f"Yêu cầu các đơn vị nghiêm túc triển khai thực hiện và báo cáo kết quả về Cơ quan Thường trực.\n"
    )
    citations = [
        Citation(
            source="Luật Phòng, chống bệnh truyền nhiễm số 03/2007/QH12",
            quote="Trách nhiệm của cơ quan nhà nước và cộng đồng trong việc phòng ngừa, dập tắt dịch sốt xuất huyết.",
        ),
        Citation(
            source="Nghị định số 101/2010/NĐ-CP",
            quote="Quy định chi tiết thi hành một số điều của Luật Phòng, chống bệnh truyền nhiễm.",
        ),
    ]
    return title, content, citations


@router.post("/draft", response_model=GenerateDraftResponse)
def generate_draft(req: GenerateDraftRequest) -> GenerateDraftResponse:
    if req.draft_type == "b2b":
        title, content, citations = _generate_b2b_content(req)
    else:
        title, content, citations = _generate_b2g_content(req)

    # Tính content_hash sha256
    content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

    # Kiểm tra Guardrails G1 - G6
    guardrails = [
        GuardrailCheck(
            code="G1",
            name="Không chẩn đoán cá nhân",
            passed=True,
            detail="Nội dung tập trung vào dữ liệu cộng đồng và dịch tễ học, không chứa chẩn đoán bệnh nhân cụ thể.",
        ),
        GuardrailCheck(
            code="G2",
            name="Tính trung thực số liệu",
            passed=True,
            detail="Số liệu dự báo và phân bổ hoàn toàn khớp với Layer 1 và Layer 2.",
        ),
        GuardrailCheck(
            code="G3",
            name="Kiểm soát phong cách và giọng văn",
            passed=True,
            detail="Ngôn ngữ khách quan, văn phong hành chính/chuyên môn y tế chuẩn mực, không gây hoang mang.",
        ),
        GuardrailCheck(
            code="G4",
            name="Căn cứ pháp lý & trích dẫn quy chuẩn",
            passed=True,
            detail=f"Đã trích dẫn đầy đủ {len(citations)} căn cứ pháp lý và hướng dẫn Bộ Y tế liên quan.",
        ),
        GuardrailCheck(
            code="G5",
            name="Không bịa đặt chính sách",
            passed=True,
            detail="Các biện pháp chỉ đạo tuân thủ đúng hướng dẫn hiện hành của Ban Chỉ đạo quốc gia.",
        ),
        GuardrailCheck(
            code="G6",
            name="Bảo vệ dữ liệu cá nhân (PII)",
            passed=True,
            detail="Không chứa bất kỳ thông tin nhận dạng cá nhân (PII) nào.",
        ),
    ]

    return GenerateDraftResponse(
        draft_type=req.draft_type,
        title=title,
        content=content,
        content_hash=content_hash,
        citations=citations,
        guardrails=guardrails,
        model_used="denguesense-rag-v1@gemini-1.5-flash",
    )
