"""Locked eval retrieval matrix using previously encoded vectors."""

import argparse
import hashlib
import json
import os
import tempfile
import time
from pathlib import Path

import numpy as np
from tokenizers import Tokenizer

from app.genai_rag.offline.chunking import build_chunks
from app.genai_rag.offline.corpus import SourceUnit
from app.genai_rag.offline.dense import (
    cache_key,
    fuse_rrf,
    load_cached_vector,
    search_dense,
)
from app.genai_rag.offline.evaluate import Hit, Query, score_queries, validate_queries
from app.genai_rag.offline.retrieve import search_bm25


def verify_hashes(expected, paths):
    if set(expected) != set(paths):
        raise ValueError("LOCK_MISMATCH: sources")
    for key, path in paths.items():
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected[key]:
            raise ValueError(f"LOCK_MISMATCH: {key}")


def rank_methods(chunks, vectors, query_vector, query, bm25, rrf):
    lexical = search_bm25(
        chunks, query, top_k=rrf["pool_k"], k1=bm25["k1"], b=bm25["b"]
    )
    dense = search_dense(chunks, vectors, query_vector, top_k=rrf["pool_k"])
    return {
        "bm25": lexical[: rrf["top_k"]],
        "dense": dense[: rrf["top_k"]],
        "hybrid": fuse_rrf([lexical, dense], top_k=rrf["top_k"], k=rrf["rrf_k"]),
    }


def main():
    from experiments.exp_018_rag_retrieval.bm25_dev import (
        TOKENIZER_HASHES,
        verified_bytes,
    )
    from experiments.exp_018_rag_retrieval.encoder_smoke import CORPUS_SHA, MODELS
    from experiments.exp_018_rag_retrieval.eval_encoder import (
        EVAL_SHA,
        ROOT,
        check_selection,
    )

    parser = argparse.ArgumentParser(description=__doc__)
    for name in (
        "corpus",
        "bge-tokenizer",
        "gte-tokenizer",
        "cache",
        "output",
        "checkpoint",
    ):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    check_selection()
    if args.output.exists():
        raise FileExistsError(args.output)
    units = [
        SourceUnit.model_validate(u)
        for u in json.loads(verified_bytes(args.corpus, CORPUS_SHA))
    ]
    queries = [
        Query.model_validate_json(line)
        for line in verified_bytes(ROOT / "queries-eval.jsonl", EVAL_SHA)
        .decode()
        .splitlines()
    ]
    validate_queries(queries, units)
    if (
        len(queries) != 20
        or sum(q.answerable for q in queries) != 15
        or any(q.split != "eval" for q in queries)
    ):
        raise ValueError("INVALID_EVAL_COUNTS")
    bm = json.loads((ROOT / "bm25-baseline.json").read_text())
    rrf = json.loads((ROOT / "hybrid-baseline.json").read_text())
    toks = {}
    for name, path in (("bge", args.bge_tokenizer), ("gte", args.gte_tokenizer)):
        verified_bytes(path, TOKENIZER_HASHES[name])
        toks[name] = Tokenizer.from_file(str(path))
        toks[name].no_truncation()
    counters = {
        name: (lambda text, t=tok: len(t.encode(text, add_special_tokens=False).ids))
        for name, tok in toks.items()
    }
    sources = {
        name: ROOT / filename
        for name, filename in (
            ("gte", "eval-gte-v0.1.json"),
            ("bge", "eval-bge-v0.1.json"),
        )
    }
    identity = {
        "matrix_runner_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "eval_encoder_sha256": hashlib.sha256(
            (ROOT / "eval_encoder.py").read_bytes()
        ).hexdigest(),
        "selection_sha256": hashlib.sha256(
            (ROOT / "selection-dev-v0.1.json").read_bytes()
        ).hexdigest(),
        "eval_sha256": EVAL_SHA,
        "corpus_sha256": CORPUS_SHA,
        "dense_runs": {
            name: hashlib.sha256(path.read_bytes()).hexdigest()
            for name, path in sources.items()
        },
    }
    checkpoint = {"identity": identity, "configurations": {}}
    if args.checkpoint.exists():
        checkpoint = json.loads(args.checkpoint.read_text())
        if checkpoint.get("identity") != identity:
            raise ValueError("CHECKPOINT_MISMATCH")

    def save():
        fd, temp = tempfile.mkstemp(prefix=".eval-", dir=args.checkpoint.parent)
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump(checkpoint, file, ensure_ascii=False, indent=2)
        os.replace(temp, args.checkpoint)

    for model, path in sources.items():
        previous = json.loads(path.read_text())
        revision, dim = MODELS[model][1:]
        if (
            previous.get("status") != "passed"
            or previous.get("model_revision") != revision
            or previous.get("eval_sha256") != EVAL_SHA
        ):
            raise ValueError("DENSE_EVAL_MISMATCH")
        runtime = previous["runtime_identity"]
        cache = args.cache / "vectors" / model

        def vector(
            text, model=model, revision=revision, runtime=runtime, cache=cache, dim=dim
        ):
            key = cache_key(model, revision, revision, text, runtime)
            found = load_cached_vector(cache / (key + ".npy"), dim)
            if found is None:
                raise ValueError(f"MISSING_VECTOR_CACHE: {key}")
            return found

        qvectors = {q.query_id: vector(q.query) for q in queries}
        for size in bm["chunk_sizes"]:
            keys = [f"dense-{model}-{size}", f"hybrid-{model}-{size}"]
            if model == "gte":
                keys.append(f"bm25-{size}")
            if all(key in checkpoint["configurations"] for key in keys):
                continue
            chunks = build_chunks(units, size, counters)
            vectors = np.stack([vector(c.text) for c in chunks])
            rankings = {key: {} for key in keys}
            timings = {}
            for q in queries:
                start = time.monotonic()
                methods = rank_methods(
                    chunks, vectors, qvectors[q.query_id], q.query, bm, rrf
                )
                timings[q.query_id] = time.monotonic() - start
                if methods["dense"] != [
                    Hit.model_validate(h)
                    for h in previous["configurations"][str(size)]["rankings"][
                        q.query_id
                    ]
                ]:
                    raise ValueError(
                        f"DENSE_RANKING_MISMATCH: {model} {size} {q.query_id}"
                    )
                for key in keys:
                    kind = key.split("-", 1)[0]
                    rankings[key][q.query_id] = methods[kind]
            for key in keys:
                rows = rankings[key]
                checkpoint["configurations"][key] = {
                    "metrics": score_queries(queries, rows, units),
                    "rankings": {
                        qid: [h.model_dump() for h in hits]
                        for qid, hits in rows.items()
                    },
                    "negative_hit_counts": {
                        q.query_id: len(rows[q.query_id])
                        for q in queries
                        if not q.answerable
                    },
                    "combined_retrieval_seconds": timings,
                }
            save()
    if len(checkpoint["configurations"]) != 15:
        raise ValueError("INCOMPLETE_MATRIX")
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(checkpoint, output, ensure_ascii=False, indent=2)
        output.write("\n")


if __name__ == "__main__":
    main()
