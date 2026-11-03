from pathlib import Path

import numpy as np
import pytest

from app.genai_rag.offline.chunking import Chunk
from experiments.exp_018_rag_retrieval.eval_matrix import (
    entry_digest,
    rank_methods,
    verify_checkpoint_digests,
    verify_checkpoint_entry,
    verify_hashes,
)
from experiments.exp_018_rag_retrieval.run import writer_lock


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


def test_resume_rejects_modified_checkpoint_metrics():
    from app.genai_rag.offline.corpus import SourceUnit
    from app.genai_rag.offline.evaluate import Hit, Query, score_queries

    unit = SourceUnit(
        unit_id="u",
        document_id="d",
        section_path="s",
        pdf_pages=[1],
        printed_pages=None,
        text="muỗi",
        review_status="checked",
        eligibility="benchmark_only",
    )
    query = Query(
        query_id="q",
        group_id="g",
        query="muỗi",
        query_language="vi",
        split="eval",
        answerable=True,
        relevant_unit_ids=["u"],
        reason="test",
        annotation_review="checked",
    )
    hit = Hit(
        chunk_id="a",
        unit_ids=["u"],
        score=1,
        citations=[],
        source_spans={"u": [(0, 4)]},
    )
    rankings = {"q": [hit]}
    entry = {
        "rankings": {"q": [hit.model_dump()]},
        "metrics": score_queries([query], rankings, [unit]),
        "negative_hit_counts": {},
        "combined_retrieval_seconds": {"q": 0.01},
    }
    verify_checkpoint_entry(entry, [query], [unit], rankings)
    entry["metrics"]["recall_at_5"] = 0.123
    with pytest.raises(ValueError, match="CHECKPOINT_INVALID"):
        verify_checkpoint_entry(entry, [query], [unit], rankings)
    entry["metrics"] = score_queries([query], rankings, [unit])
    entry["rankings"]["q"][0]["source_spans"] = {"u": [(0, 2)]}
    with pytest.raises(ValueError, match="CHECKPOINT_INVALID"):
        verify_checkpoint_entry(entry, [query], [unit], rankings)


def test_second_writer_is_rejected(tmp_path):
    with writer_lock(tmp_path), pytest.raises(
        RuntimeError, match="WRITER_LOCKED"
    ), writer_lock(tmp_path):
        pass


def test_checkpoint_digest_rejects_modified_content():
    entry = {"metrics": {"recall_at_5": 1.0}}
    checkpoint = {"configurations": {"c": entry}, "digests": {"c": entry_digest(entry)}}
    verify_checkpoint_digests(checkpoint)
    entry["metrics"]["recall_at_5"] = 0.5
    with pytest.raises(ValueError, match="CHECKPOINT_INVALID"):
        verify_checkpoint_digests(checkpoint)


def test_cli_dry_run_never_launches_encoder(monkeypatch, tmp_path, capsys):
    import sys

    from experiments.exp_018_rag_retrieval import run

    monkeypatch.setattr(run, "load_config", lambda _path, _stage: {})
    monkeypatch.setattr(
        run.subprocess,
        "run",
        lambda *a, **k: pytest.fail("dry-run launched subprocess"),
    )
    monkeypatch.setattr(sys, "base_prefix", "not-the-current-prefix")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run",
            "--config",
            "config.yaml",
            "--out",
            str(tmp_path / "out"),
            "--stage",
            "eval",
            "--dry-run",
        ],
    )
    run.main()
    assert '"query_runs": 300' in capsys.readouterr().out
    assert not (tmp_path / "out").exists()


def test_dev_cli_passes_current_outputs_to_hybrid(monkeypatch, tmp_path):
    import sys

    from experiments.exp_018_rag_retrieval import run

    config = {
        name: tmp_path for name in ("corpus", "cache", "bge_tokenizer", "gte_tokenizer")
    }
    commands = []

    def fake_run(command, check):
        commands.append(command)
        Path(command[command.index("--output") + 1]).write_text("{}")

    monkeypatch.setattr(run, "load_config", lambda _path, _stage: config)
    monkeypatch.setattr(run.subprocess, "run", fake_run)
    monkeypatch.setattr(sys, "base_prefix", "not-the-current-prefix")
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run",
            "--config",
            "config.yaml",
            "--out",
            str(tmp_path / "out"),
            "--stage",
            "dev",
        ],
    )
    run.main()
    hybrid = commands[-1]
    assert (
        Path(hybrid[hybrid.index("--bm25-run") + 1]) == tmp_path / "out/bm25-dev.json"
    )
    assert (
        Path(hybrid[hybrid.index("--gte-run") + 1])
        == tmp_path / "out/dense-gte-dev.json"
    )
    assert (
        Path(hybrid[hybrid.index("--bge-run") + 1])
        == tmp_path / "out/dense-bge-dev.json"
    )


def test_dev_config_does_not_require_eval_selection(monkeypatch, tmp_path):
    import json

    from experiments.exp_018_rag_retrieval import bm25_dev, eval_encoder, run

    monkeypatch.setattr(run, "ROOT", tmp_path)
    monkeypatch.setattr(bm25_dev, "verified_bytes", lambda *_: b"")
    monkeypatch.setattr(
        eval_encoder,
        "check_selection",
        lambda: pytest.fail("selection checked before eval"),
    )
    (tmp_path / "corpus-lock-v0.1.json").write_text(
        json.dumps({"manifest_sha256": "x"})
    )
    config = tmp_path / "config.yaml"
    config.write_text(
        "corpus: x\nbge_tokenizer: x\ngte_tokenizer: x\ncache: " + str(tmp_path) + "\n"
    )
    assert run.load_config(config, "dev")["cache"] == tmp_path


def test_shared_source_change_alters_resume_fingerprint(tmp_path):
    from experiments.exp_018_rag_retrieval.run import hash_paths

    source = tmp_path / "retrieve.py"
    source.write_text("before")
    before = hash_paths([source])
    source.write_text("after")
    assert hash_paths([source]) != before
