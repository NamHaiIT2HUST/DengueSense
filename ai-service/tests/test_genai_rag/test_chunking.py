"""Offline chunking tests with synthetic units and token counters."""

from app.genai_rag.chunking import build_chunks
from app.genai_rag.corpus import SourceUnit


def test_hcdc_question_spanning_two_pages_keeps_complete_text_and_citation():
    text = (
        "7. KHÔNG cho muỗi đẻ bằng cách nào?\n"
        "Trang đầu: xử lý vật chứa nước theo bảy nguyên tắc.\n"
        "01. Che kín, không để khe hở.\n"
        "Trang sau: 07. Thay đổi hình thức trữ nước."
    )
    unit = SourceUnit(
        unit_id="fixture-hcdc/muc-7",
        document_id="fixture-hcdc",
        section_path="Mục 7",
        pdf_pages=[15, 16],
        printed_pages="13–14",
        text=text,
        review_status="checked",
        eligibility="benchmark_only",
    )
    counters = {
        "bge": lambda value: len(value.split()),
        "gte": lambda value: len(value.split()),
    }

    chunks = build_chunks([unit], target_tokens=256, token_counters=counters)

    assert len(chunks) == 1
    assert text in chunks[0].text
    assert chunks[0].unit_ids == [unit.unit_id]
    assert chunks[0].citations == [
        {
            "document_id": "fixture-hcdc",
            "section_path": "Mục 7",
            "pdf_pages": [15, 16],
            "printed_pages": "13–14",
            "eligibility": "benchmark_only",
        }
    ]


def test_oversize_unit_is_rejected_instead_of_truncated():
    import pytest

    unit = SourceUnit(
        unit_id="fixture/large",
        document_id="fixture",
        section_path="Mục 7",
        pdf_pages=[1, 2],
        printed_pages=None,
        text="không " * 300,
        review_status="checked",
        eligibility="benchmark_only",
    )
    with pytest.raises(ValueError, match="UNIT_REQUIRES_REVIEW.*fixture/large"):
        build_chunks(
            [unit],
            target_tokens=256,
            token_counters={
                "bge": lambda s: len(s.split()),
                "gte": lambda s: len(s.split()),
            },
        )


def test_ids_are_repeatable_and_change_with_content_or_target():
    unit = SourceUnit(
        unit_id="fixture/unit",
        document_id="fixture",
        section_path="Mục 7",
        pdf_pages=[1, 2],
        printed_pages=None,
        text="Không bỏ điều kiện.",
        review_status="checked",
        eligibility="benchmark_only",
    )
    counters = {"bge": lambda s: len(s.split()), "gte": lambda s: len(s.split())}
    original = build_chunks([unit], 256, counters)[0]
    assert original.chunk_id == build_chunks([unit], 256, counters)[0].chunk_id
    assert original.chunk_id != build_chunks([unit], 512, counters)[0].chunk_id
    assert (
        original.chunk_id
        != build_chunks(
            [unit.model_copy(update={"text": "Không bỏ điều kiện mới."})], 256, counters
        )[0].chunk_id
    )
