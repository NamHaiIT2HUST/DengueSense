import numpy as np
import pytest

from app.genai_rag.offline.chunking import Chunk
from app.genai_rag.offline.dense import cache_key, load_cached_vector, search_dense


def sample(chunk_id):
    return Chunk(
        chunk_id,
        [chunk_id],
        "nguồn",
        [{"pdf_pages": [1]}],
        {},
        chunk_id,
        {chunk_id: [(0, 5)]},
    )


def test_cosine_ties_and_provenance():
    chunks = [sample("b"), sample("a"), sample("c")]
    hits = search_dense(chunks, np.array([[1, 0], [2, 0], [0, 1]]), np.array([1, 0]))
    assert [hit.chunk_id for hit in hits] == ["a", "b", "c"]
    assert [hit.score for hit in hits] == [1, 1, 0]
    assert hits[0].source_spans == chunks[1].source_spans
    assert hits[0].citations == chunks[1].citations


@pytest.mark.parametrize(
    "vectors,query",
    [
        ([[0, 0]], [1, 0]),
        ([[float("nan"), 1]], [1, 0]),
        ([[1, 0]], [0, 0]),
        ([[1, 0]], [float("inf"), 1]),
        ([[1, 0]], [1, 0, 0]),
    ],
)
def test_invalid_vectors_rejected(vectors, query):
    with pytest.raises(ValueError):
        search_dense([sample("a")], np.array(vectors), np.array(query))


def test_cache_identity_and_corruption(tmp_path):
    key = cache_key("model", "revision", "tokenizer", "text", "runtime")
    assert key != cache_key("model", "other", "tokenizer", "text", "runtime")
    assert key != cache_key("model", "revision", "tokenizer", "other", "runtime")
    path = tmp_path / (key + ".npy")
    assert load_cached_vector(path, 2) is None
    path.write_bytes(b"bad")
    with pytest.raises(ValueError, match="INVALID_VECTOR_CACHE"):
        load_cached_vector(path, 2)
