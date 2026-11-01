import json
from pathlib import Path

from app.genai_rag.corpus import load_units
from app.genai_rag.evaluate import Query, score_queries, validate_queries
from app.genai_rag.retrieve import load_retriever_from_disk


def test_retrieve_benchmark_dataset():
    base_dir = (
        Path(__file__).resolve().parents[2] / "experiments" / "exp_018_rag_retrieval"
    )
    manifest_path = base_dir / "corpus-manifest.yaml"
    units_path = base_dir / "reviewed-units.json"
    queries_path = base_dir / "queries.jsonl"

    units = load_units(manifest_path, units_path)
    assert len(units) == 16

    queries = [
        Query.model_validate(json.loads(line))
        for line in queries_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert len(queries) == 16
    validate_queries(queries, units)

    retriever = load_retriever_from_disk(manifest_path, units_path)

    dev_queries = [q for q in queries if q.split == "dev"]
    eval_queries = [q for q in queries if q.split == "eval"]

    dev_rankings = {q.query_id: retriever.retrieve(q.query, k=5) for q in dev_queries}
    eval_rankings = {q.query_id: retriever.retrieve(q.query, k=5) for q in eval_queries}

    dev_scores = score_queries(dev_queries, dev_rankings)
    eval_scores = score_queries(eval_queries, eval_rankings)

    assert dev_scores["answerable_count"] == 6
    assert dev_scores["recall_at_5"] == 1.0
    assert dev_scores["mrr"] == 1.0

    assert eval_scores["answerable_count"] == 6
    assert eval_scores["recall_at_5"] == 1.0
    assert eval_scores["mrr"] is not None and eval_scores["mrr"] >= 0.8


def test_out_of_scope_negatives_rejected():
    base_dir = (
        Path(__file__).resolve().parents[2] / "experiments" / "exp_018_rag_retrieval"
    )
    manifest_path = base_dir / "corpus-manifest.yaml"
    units_path = base_dir / "reviewed-units.json"
    queries_path = base_dir / "queries.jsonl"

    retriever = load_retriever_from_disk(manifest_path, units_path)
    queries = [
        Query.model_validate(json.loads(line))
        for line in queries_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    negative_queries = [q for q in queries if not q.answerable]
    assert len(negative_queries) == 4

    for q in negative_queries:
        hits = retriever.retrieve(q.query, k=5)
        assert hits == [], f"Query {q.query_id} should return no hits"


def test_citation_precision_is_verbatim():
    base_dir = (
        Path(__file__).resolve().parents[2] / "experiments" / "exp_018_rag_retrieval"
    )
    manifest_path = base_dir / "corpus-manifest.yaml"
    units_path = base_dir / "reviewed-units.json"
    queries_path = base_dir / "queries.jsonl"

    units = load_units(manifest_path, units_path)
    units_by_id = {u.unit_id: u for u in units}
    retriever = load_retriever_from_disk(manifest_path, units_path)

    queries = [
        Query.model_validate(json.loads(line))
        for line in queries_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    total_citations = 0
    verbatim_citations = 0

    for q in queries:
        if not q.answerable:
            continue
        hits = retriever.retrieve(q.query, k=5)
        for hit in hits:
            for cit in hit.citations:
                total_citations += 1
                unit = units_by_id[hit.chunk_id]
                quote = cit["quote"]
                assert quote, "Quote must not be empty"
                assert (
                    quote in unit.text
                ), f"Quote '{quote}' must be verbatim substring of unit text"
                verbatim_citations += 1

    assert total_citations > 0
    assert total_citations == verbatim_citations
