import hashlib
import json
from pathlib import Path

import pytest
import yaml

from app.genai_rag.corpus import load_units
from app.genai_rag.evaluate import Query, score_queries, validate_queries
from app.genai_rag.retrieve import load_retriever_from_disk


@pytest.fixture
def benchmark_paths(tmp_path: Path) -> tuple[Path, Path, Path]:
    """Exercise the frozen text dataset without requiring private PDF files in CI."""
    source_dir = (
        Path(__file__).resolve().parents[2] / "experiments" / "exp_018_rag_retrieval"
    )
    (tmp_path / ".git").mkdir()
    target = tmp_path / "ai-service" / "experiments" / "exp_018_rag_retrieval"
    target.mkdir(parents=True)
    manifest = yaml.safe_load(
        (source_dir / "corpus-manifest.yaml").read_text(encoding="utf-8")
    )
    hashes = {}
    for doc in manifest["documents"]:
        pdf_path = tmp_path / doc["path"]
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        content = doc["document_id"].encode("utf-8")
        pdf_path.write_bytes(content)
        doc["sha256"] = hashlib.sha256(content).hexdigest()
        hashes[doc["document_id"]] = doc["sha256"]
    manifest_path = target / "corpus-manifest.yaml"
    manifest_path.write_text(yaml.safe_dump(manifest), encoding="utf-8")
    units = json.loads((source_dir / "reviewed-units.json").read_text(encoding="utf-8"))
    for unit in units:
        unit["pdf_sha256"] = hashes[unit["document_id"]]
    units_path = target / "reviewed-units.json"
    units_path.write_text(json.dumps(units, ensure_ascii=False), encoding="utf-8")
    queries_path = target / "queries.jsonl"
    queries_path.write_bytes((source_dir / "queries.jsonl").read_bytes())
    return manifest_path, units_path, queries_path


def test_retrieve_benchmark_dataset(benchmark_paths: tuple[Path, Path, Path]):
    manifest_path, units_path, queries_path = benchmark_paths

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
    assert eval_scores["mrr"] == pytest.approx(0.7833333333)


def test_out_of_scope_negatives_rejected(benchmark_paths: tuple[Path, Path, Path]):
    manifest_path, units_path, queries_path = benchmark_paths

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


def test_citation_precision_is_verbatim(benchmark_paths: tuple[Path, Path, Path]):
    manifest_path, units_path, queries_path = benchmark_paths

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
