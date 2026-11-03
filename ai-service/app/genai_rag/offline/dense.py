"""Exact cosine search for offline source chunks."""

import hashlib
import json
from pathlib import Path

import numpy as np

from app.genai_rag.offline.chunking import Chunk
from app.genai_rag.offline.evaluate import Hit


def cache_key(
    model: str, revision: str, tokenizer: str, text: str, runtime: str
) -> str:
    data = json.dumps(
        [model, revision, tokenizer, text, runtime],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def load_cached_vector(path: Path, dimension: int) -> np.ndarray | None:
    if not path.exists():
        return None
    try:
        vector = np.load(path, allow_pickle=False)
        if (
            vector.shape != (dimension,)
            or vector.dtype != np.float32
            or not np.isfinite(vector).all()
            or not np.any(vector)
        ):
            raise ValueError("INVALID_VECTOR_CACHE")
        return vector
    except (ValueError, OSError, EOFError) as exc:
        raise ValueError(f"INVALID_VECTOR_CACHE: {path}") from exc


def search_dense(
    chunks: list[Chunk], vectors: np.ndarray, query: np.ndarray, top_k: int = 5
) -> list[Hit]:
    vectors = np.asarray(vectors, dtype=np.float64)
    query = np.asarray(query, dtype=np.float64)
    if not chunks or type(top_k) is not int or top_k < 1:
        raise ValueError("INVALID_INPUT")
    if (
        vectors.ndim != 2
        or vectors.shape[0] != len(chunks)
        or query.shape != (vectors.shape[1],)
    ):
        raise ValueError("INVALID_SHAPE")
    if not np.isfinite(vectors).all() or not np.isfinite(query).all():
        raise ValueError("NONFINITE_VECTOR")
    lengths = np.linalg.norm(vectors, axis=1)
    query_length = np.linalg.norm(query)
    if not np.isfinite(lengths).all() or not np.isfinite(query_length):
        raise ValueError("NONFINITE_NORM")
    if np.any(lengths == 0) or query_length == 0:
        raise ValueError("ZERO_VECTOR")
    scores = (vectors / lengths[:, None]) @ (query / query_length)
    order = sorted(range(len(chunks)), key=lambda i: (-scores[i], chunks[i].chunk_id))[
        :top_k
    ]
    return [
        Hit(
            chunk_id=chunks[i].chunk_id,
            unit_ids=chunks[i].unit_ids,
            score=float(scores[i]),
            citations=chunks[i].citations,
            source_spans=chunks[i].source_spans,
        )
        for i in order
    ]


def fuse_rrf(rankings: list[list[Hit]], top_k: int = 5, k: int = 60) -> list[Hit]:
    if type(top_k) is not int or top_k < 1 or type(k) is not int or k < 1:
        raise ValueError("INVALID_RRF_SETTINGS")
    items, scores = {}, {}
    for ranking in rankings:
        seen = set()
        for rank, hit in enumerate(ranking, 1):
            if hit.chunk_id in seen:
                raise ValueError("DUPLICATE_CHUNK")
            seen.add(hit.chunk_id)
            previous = items.get(hit.chunk_id)
            if previous and (
                previous.unit_ids != hit.unit_ids
                or previous.citations != hit.citations
                or previous.source_spans != hit.source_spans
            ):
                raise ValueError("INCONSISTENT_PROVENANCE")
            items[hit.chunk_id] = hit
            scores[hit.chunk_id] = scores.get(hit.chunk_id, 0.0) + 1 / (k + rank)
    ordered = sorted(scores, key=lambda chunk_id: (-scores[chunk_id], chunk_id))
    return [
        items[chunk_id].model_copy(update={"score": scores[chunk_id]})
        for chunk_id in ordered[:top_k]
    ]
