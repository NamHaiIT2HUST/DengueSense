import numpy as np
import pytest

from app.genai_rag.offline.chunking import Chunk
from experiments.exp_018_rag_retrieval.eval_matrix import rank_methods, verify_hashes


def test_eval_matrix_preserves_spans_and_all_three_methods():
    chunks = [
        Chunk("a", ["u"], "muỗi", [{"pdf_pages": [1]}], {}, "a", {"u": [(0, 4)]}),
        Chunk("b", ["v"], "khác", [{"pdf_pages": [2]}], {}, "b", {"v": [(0, 4)]}),
    ]
    result = rank_methods(
        chunks,
        np.eye(2),
        np.array([1, 0]),
        "muỗi",
        {"k1": 1.5, "b": 0.75},
        {"pool_k": 20, "top_k": 5, "rrf_k": 60},
    )
    assert set(result) == {"bm25", "dense", "hybrid"}
    assert all(hits[0].chunk_id == "a" for hits in result.values())
    assert result["hybrid"][0].source_spans == {"u": [(0, 4)]}


def test_eval_rejects_changed_locked_source(tmp_path):
    source = tmp_path / "code"
    source.write_text("changed")
    with pytest.raises(ValueError, match="LOCK_MISMATCH"):
        verify_hashes({"code": "0" * 64}, {"code": source})
