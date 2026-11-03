"""BM25 behavior on small, offline fixtures."""

import pytest

from app.genai_rag.offline.chunking import Chunk
from app.genai_rag.offline.retrieve import search_bm25


def chunk(chunk_id, text):
    return Chunk(
        chunk_id=chunk_id,
        unit_ids=[chunk_id],
        text=text,
        citations=[{"document_id": "nguồn", "pdf_pages": [15, 16]}],
        token_counts={},
        content_hash=chunk_id,
        source_spans={chunk_id: [(0, len(text))]},
    )


def test_no_matching_terms_returns_no_hits():
    assert (
        search_bm25([chunk("a", "Sốt xuất huyết")], "điều dưỡng", k1=1.5, b=0.75) == []
    )


def test_bm25_parameters_change_actual_scores():
    chunks = [chunk("a", "muỗi muỗi muỗi"), chunk("b", "muỗi nước"), chunk("c", "khác")]
    low = search_bm25(chunks, "muỗi", k1=0.3, b=0.2)
    high = search_bm25(chunks, "muỗi", k1=2.0, b=0.9)
    assert {hit.chunk_id: hit.score for hit in low} != {
        hit.chunk_id: hit.score for hit in high
    }


@pytest.mark.parametrize(("k1", "b"), [(0, 0.75), (1.5, -0.1), (1.5, 1.1)])
def test_invalid_bm25_parameters_are_rejected(k1, b):
    with pytest.raises(ValueError, match="INVALID_BM25_CONFIG"):
        search_bm25([chunk("a", "muỗi")], "muỗi", k1=k1, b=b)


def test_equal_scores_are_ordered_by_chunk_id():
    hits = search_bm25([chunk("b", "muỗi"), chunk("a", "muỗi")], "muỗi", k1=1.5, b=0.75)
    assert [hit.chunk_id for hit in hits] == ["a", "b"]
    assert all(hit.score <= 0 for hit in hits)


def test_accents_normalization_and_provenance_survive():
    source = chunk("a", "MUỖI không đẻ")
    hits = search_bm25([source, chunk("b", "khác")], "muỗi", k1=1.5, b=0.75)
    assert [hit.chunk_id for hit in hits] == ["a"]
    assert hits[0].source_spans == source.source_spans
    assert hits[0].citations == source.citations
    assert hits[0].unit_ids == source.unit_ids
    assert search_bm25([source], "muoi", k1=1.5, b=0.75) == []


@pytest.mark.parametrize("query", ["", "   ", "!!!"])
def test_empty_query_is_rejected(query):
    with pytest.raises(ValueError, match="INVALID_QUERY"):
        search_bm25([chunk("a", "muỗi")], query, k1=1.5, b=0.75)


def test_empty_corpus_and_invalid_limit_are_rejected():
    with pytest.raises(ValueError, match="EMPTY_CORPUS"):
        search_bm25([], "muỗi", k1=1.5, b=0.75)
    with pytest.raises(ValueError, match="INVALID_TOP_K"):
        search_bm25([chunk("a", "muỗi")], "muỗi", top_k=0, k1=1.5, b=0.75)


def test_partial_retrieval_does_not_score_complete_unit():
    from app.genai_rag.offline.corpus import SourceUnit
    from app.genai_rag.offline.evaluate import Query, score_queries

    unit = SourceUnit(
        unit_id="u",
        document_id="d",
        section_path="s",
        pdf_pages=[1],
        printed_pages=None,
        text="muỗi nước",
        review_status="checked",
        eligibility="benchmark_only",
    )
    a = chunk("a", "muỗi")
    a = Chunk(
        a.chunk_id, ["u"], a.text, a.citations, {}, a.content_hash, {"u": [(0, 4)]}
    )
    b = chunk("b", "nước")
    b = Chunk(
        b.chunk_id, ["u"], b.text, b.citations, {}, b.content_hash, {"u": [(4, 9)]}
    )
    q = Query(
        query_id="q",
        group_id="g",
        query="muỗi",
        query_language="vi",
        split="dev",
        answerable=True,
        relevant_unit_ids=["u"],
        reason="test",
        annotation_review="checked",
    )
    hits = search_bm25([a, b], q.query, k1=1.5, b=0.75)
    assert len(hits) == 1
    assert score_queries([q], {"q": hits}, [unit])["recall_at_5"] == 0
