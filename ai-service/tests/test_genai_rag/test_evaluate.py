import pytest

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
    rankings = {
        "q1": [
            Hit(chunk_id="x", unit_ids=["x"], score=1, citations=[]),
            Hit(chunk_id="a", unit_ids=["u1"], score=1, citations=[]),
            Hit(chunk_id="b", unit_ids=["u1"], score=1, citations=[]),
        ]
    }
    result = score_queries([q], rankings)
    assert result["recall_at_5"] == 0.5
    assert result["mrr"] == 0.5
    assert result["noise_at_5"] == pytest.approx(1 / 3)


def test_missing_ranking_is_an_error():
    with pytest.raises(ValueError, match="MISSING_RANKING"):
        score_queries([query()], {})


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
