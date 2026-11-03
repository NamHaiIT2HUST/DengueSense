"""Validation and unit-level retrieval metrics."""

from typing import Literal

from pydantic import BaseModel

from app.genai_rag.corpus import SourceUnit


class Query(BaseModel):
    query_id: str
    group_id: str
    query: str
    query_language: str
    split: Literal["dev", "eval"]
    answerable: bool
    relevant_unit_ids: list[str]
    reason: str
    annotation_review: str


class Hit(BaseModel):
    chunk_id: str
    unit_ids: list[str]
    score: float
    citations: list
    source_spans: dict[str, list[tuple[int, int]]]


def validate_queries(queries: list[Query], units: list[SourceUnit]) -> None:
    known = {u.unit_id for u in units}
    groups = {}
    ids = set()
    for q in queries:
        if not q.query.strip() or q.query_id in ids:
            raise ValueError("INVALID_QUERY")
        ids.add(q.query_id)
        if q.group_id in groups and groups[q.group_id] != q.split:
            raise ValueError("SPLIT_LEAKAGE")
        groups[q.group_id] = q.split
        if bool(q.relevant_unit_ids) != q.answerable:
            raise ValueError("INVALID_RELEVANCE")
        if not set(q.relevant_unit_ids) <= known:
            raise ValueError("UNKNOWN_UNIT")


def score_queries(
    queries: list[Query],
    rankings: dict[str, list[Hit]],
    units: list[SourceUnit],
    k: int = 5,
) -> dict:
    if k < 1:
        raise ValueError("INVALID_K")
    lengths = {unit.unit_id: len(unit.text) for unit in units}
    if len(lengths) != len(units) or any(length == 0 for length in lengths.values()):
        raise ValueError("INVALID_UNITS")
    recalls, reciprocals, noise = [], [], []
    for q in queries:
        if q.query_id not in rankings:
            raise ValueError("MISSING_RANKING")
        if not q.answerable:
            continue
        relevant = set(q.relevant_unit_ids)
        if not relevant:
            raise ValueError("INVALID_RELEVANCE")
        if not relevant <= lengths.keys():
            raise ValueError("UNKNOWN_UNIT")
        hits = rankings[q.query_id][:k]
        coverage = {unit_id: [] for unit_id in relevant}
        found = set()
        rank = None
        for i, hit in enumerate(hits, 1):
            if set(hit.unit_ids) != set(hit.source_spans):
                raise ValueError("INVALID_SOURCE_SPANS")
            for unit_id, spans in hit.source_spans.items():
                if unit_id not in lengths or not spans:
                    raise ValueError("INVALID_SOURCE_SPANS")
                for start, end in spans:
                    if not 0 <= start < end <= lengths[unit_id]:
                        raise ValueError("INVALID_SOURCE_SPANS")
                if unit_id not in relevant:
                    continue
                coverage[unit_id].extend(spans)
                end_covered = 0
                for start, end in sorted(coverage[unit_id]):
                    if start > end_covered:
                        break
                    end_covered = max(end_covered, end)
                if end_covered == lengths[unit_id]:
                    found.add(unit_id)
                    if rank is None:
                        rank = i
        recalls.append(len(found & relevant) / len(relevant))
        reciprocals.append(1 / rank if rank else 0.0)
        noise.append(
            sum(not bool(set(h.unit_ids) & relevant) for h in hits) / len(hits)
            if hits
            else 0.0
        )
    n = len(recalls)
    return {
        "metric_version": "source-span-coverage-v1",
        "answerable_count": n,
        "recall_at_5": sum(recalls) / n if n else None,
        "mrr": sum(reciprocals) / n if n else None,
        "noise_at_5": sum(noise) / n if n else None,
    }
