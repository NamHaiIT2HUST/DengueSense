import pytest

from app.genai_rag.corpus import SourceUnit
from app.genai_rag.evaluate import Hit, Query, score_queries, validate_queries


def query(**kwargs):
    return Query(
        query_id="q1",
        group_id="g1",
        query="test",
        query_language="vi",
        split="dev",
        answerable=True,
        relevant_unit_ids=["u1", "u2"],
        reason="test",
        annotation_review="checked",
        **kwargs
    )


def test_oracle_counts_unique_units():
    q = query()
    units = [
        SourceUnit(
            unit_id=unit_id,
            document_id="d",
            section_path="s",
            pdf_pages=[1],
            printed_pages=None,
            text="x",
            review_status="checked",
            eligibility="benchmark_only",
        )
        for unit_id in ("x", "u1", "u2")
    ]
    rankings = {
        "q1": [
            Hit(
                chunk_id="x",
                unit_ids=["x"],
                score=1,
                citations=[],
                source_spans={"x": [(0, 1)]},
            ),
            Hit(
                chunk_id="a",
                unit_ids=["u1"],
                score=1,
                citations=[],
                source_spans={"u1": [(0, 1)]},
            ),
            Hit(
                chunk_id="b",
                unit_ids=["u1"],
                score=1,
                citations=[],
                source_spans={"u1": [(0, 1)]},
            ),
        ]
    }
    result = score_queries([q], rankings, units)
    assert result["metric_version"] == "source-span-coverage-v1"
    assert result["recall_at_5"] == 0.5
    assert result["mrr"] == 0.5
    assert result["noise_at_5"] == pytest.approx(1 / 3)


def test_missing_ranking_is_an_error():
    with pytest.raises(ValueError, match="MISSING_RANKING"):
        score_queries([query()], {}, [])


def test_invalid_units_and_leaking_groups():
    from app.genai_rag.corpus import SourceUnit

    unit = SourceUnit(
        unit_id="u1",
        document_id="d",
        section_path="s",
        pdf_pages=[1],
        printed_pages=None,
        text="x",
        review_status="checked",
        eligibility="benchmark_only",
    )
    with pytest.raises(ValueError, match="UNKNOWN_UNIT"):
        validate_queries([query()], [unit])
    q = query().model_copy(update={"relevant_unit_ids": ["u1"]})
    other = q.model_copy(update={"query_id": "q2", "split": "eval"})
    with pytest.raises(ValueError, match="SPLIT_LEAKAGE"):
        validate_queries([q, other], [unit])


@pytest.mark.parametrize(
    ("spans", "expected_recall", "expected_mrr"),
    [
        ([(0, 5)], 0.0, 0.0),
        ([(0, 5), (5, 10)], 1.0, 0.5),
        ([(0, 6), (0, 6)], 0.0, 0.0),
        ([(0, 4), (5, 10)], 0.0, 0.0),
        ([(0, 6), (4, 10)], 1.0, 0.5),
    ],
)
def test_partial_hits_require_complete_nonduplicated_source_coverage(
    spans, expected_recall, expected_mrr
):
    from app.genai_rag.corpus import SourceUnit

    unit = SourceUnit(
        unit_id="u1",
        document_id="d",
        section_path="s",
        pdf_pages=[1],
        printed_pages=None,
        text="abcdefghij",
        review_status="checked",
        eligibility="benchmark_only",
    )
    q = query().model_copy(update={"relevant_unit_ids": ["u1"]})
    hits = [
        Hit(
            chunk_id=str(i),
            unit_ids=["u1"],
            score=1,
            citations=[],
            source_spans={"u1": [(start, end)]},
        )
        for i, (start, end) in enumerate(spans)
    ]
    result = score_queries([q], {"q1": hits}, units=[unit])
    assert result["recall_at_5"] == expected_recall
    assert result["mrr"] == expected_mrr


def test_source_spans_cannot_exceed_unit_or_be_omitted():
    unit = SourceUnit(
        unit_id="u1",
        document_id="d",
        section_path="s",
        pdf_pages=[1],
        printed_pages=None,
        text="abc",
        review_status="checked",
        eligibility="benchmark_only",
    )
    q = query().model_copy(update={"relevant_unit_ids": ["u1"]})
    for spans in ({}, {"u1": [(0, 4)]}, {"u1": [(1, 1)]}):
        hit = Hit(
            chunk_id="x", unit_ids=["u1"], score=1, citations=[], source_spans=spans
        )
        with pytest.raises(ValueError, match="INVALID_SOURCE_SPANS"):
            score_queries([q], {"q1": [hit]}, units=[unit])
