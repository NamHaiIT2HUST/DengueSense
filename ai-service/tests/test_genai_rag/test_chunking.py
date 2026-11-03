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
    assert chunks[0].source_spans == {unit.unit_id: [(0, len(text))]}
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


def test_long_hcdc_section_splits_on_principles_and_maps_unicode_to_source():
    from app.genai_rag.corpus import SourceUnit

    intro = "7. KHÔNG cho muỗi đẻ?\nĐiều kiện: không bỏ qua nước sạch.\n"
    text = intro + "".join(
        f"{i:02}. Nguyên tắc {i}: " + "nước " * 45 + "\n" for i in range(1, 8)
    )
    unit = SourceUnit(
        unit_id="hcdc-sxh-snapshot-2025/muc-7",
        document_id="hcdc-sxh-snapshot-2025",
        section_path="Mục 7",
        pdf_pages=[15, 16],
        printed_pages=None,
        text=text,
        review_status="checked",
        eligibility="benchmark_only",
    )
    counters = {"bge": lambda s: len(s.split()), "gte": lambda s: len(s.split())}
    chunks = build_chunks([unit], 256, counters)
    assert len(chunks) > 1
    for chunk in chunks:
        spans = chunk.source_spans[unit.unit_id]
        assert chunk.text == "".join(text[start:end] for start, end in spans)
        assert chunk.text.startswith("7. KHÔNG cho muỗi đẻ?\n")
        assert chunk.token_counts["bge"] <= 256
        assert chunk.citations[0]["pdf_pages"] == [15, 16]
    covered = {
        i
        for chunk in chunks
        for start, end in chunk.source_spans[unit.unit_id]
        for i in range(start, end)
    }
    assert covered == set(range(len(text)))
    assert chunks == build_chunks([unit], 256, counters)
    assert any(intro not in chunk.text for chunk in chunks)

    from app.genai_rag.evaluate import Hit, Query, score_queries

    q = Query(
        query_id="q",
        group_id="g",
        query="nguyên tắc",
        query_language="vi",
        split="dev",
        answerable=True,
        relevant_unit_ids=[unit.unit_id],
        reason="test",
        annotation_review="checked",
    )
    hits = [
        Hit(
            chunk_id=c.chunk_id,
            unit_ids=c.unit_ids,
            score=1,
            citations=c.citations,
            source_spans=c.source_spans,
        )
        for c in chunks
    ]
    assert score_queries([q], {"q": hits}, [unit])["recall_at_5"] == 1.0


def test_hcdc_split_rejects_missing_numbered_principle():
    import pytest

    unit = SourceUnit(
        unit_id="hcdc-sxh-snapshot-2025/muc-7",
        document_id="hcdc-sxh-snapshot-2025",
        section_path="Mục 7",
        pdf_pages=[15, 16],
        printed_pages=None,
        text="Mở đầu\n"
        + "".join(f"{i:02}. " + "nước " * 70 + "\n" for i in range(1, 7)),
        review_status="checked",
        eligibility="benchmark_only",
    )
    with pytest.raises(ValueError, match="UNIT_REQUIRES_REVIEW"):
        build_chunks(
            [unit],
            256,
            {"bge": lambda s: len(s.split()), "gte": lambda s: len(s.split())},
        )


def test_special_tokens_are_reserved_in_encoder_limit():
    import pytest

    unit = SourceUnit(
        unit_id="fixture/unit",
        document_id="fixture",
        section_path="s",
        pdf_pages=[1],
        printed_pages=None,
        text="văn bản",
        review_status="checked",
        eligibility="benchmark_only",
    )
    with pytest.raises(ValueError, match="UNIT_REQUIRES_REVIEW"):
        build_chunks([unit], 256, {"bge": lambda _: 2, "gte": lambda _: 1151})
