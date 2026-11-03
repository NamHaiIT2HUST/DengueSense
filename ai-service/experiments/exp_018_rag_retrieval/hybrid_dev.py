"""Evaluate BM25 + cached dense RRF on locked dev, without loading encoders."""

import argparse
import hashlib
import json
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
from experiments.exp_018_rag_retrieval.bm25_dev import TOKENIZER_HASHES, verified_bytes
from experiments.exp_018_rag_retrieval.encoder_smoke import CORPUS_SHA, DEV_SHA, MODELS

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", type=Path, required=True)
    parser.add_argument("--bge-tokenizer", type=Path, required=True)
    parser.add_argument("--gte-tokenizer", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    bm = json.loads((ROOT / "bm25-baseline.json").read_text())
    rrf = json.loads((ROOT / "hybrid-baseline.json").read_text())
    if rrf["top_k"] != 5 or rrf["pool_k"] < rrf["top_k"]:
        raise ValueError("INVALID_HYBRID_CONFIG")
    units = [
        SourceUnit.model_validate(u)
        for u in json.loads(verified_bytes(args.corpus, CORPUS_SHA))
    ]
    queries = [
        Query.model_validate_json(line)
        for line in verified_bytes(ROOT / "queries-dev.jsonl", DEV_SHA)
        .decode()
        .splitlines()
    ]
    validate_queries(queries, units)
    toks = {}
    for name, path in (("bge", args.bge_tokenizer), ("gte", args.gte_tokenizer)):
        verified_bytes(path, TOKENIZER_HASHES[name])
        toks[name] = Tokenizer.from_file(str(path))
        toks[name].no_truncation()
    counters = {
        name: (lambda text, t=tok: len(t.encode(text, add_special_tokens=False).ids))
        for name, tok in toks.items()
    }
    prior_bm = json.loads((ROOT / "bm25-dev-v0.1.json").read_text())
    results = {
        "stage": "dev",
        "corpus_sha256": CORPUS_SHA,
        "queries_sha256": DEV_SHA,
        "rrf": rrf,
        "configurations": {},
    }
    for model, file in (
        ("gte", "dense-gte-dev-resume-v0.1.json"),
        ("bge", "dense-bge-dev-v0.1.json"),
    ):
        previous = json.loads((ROOT / file).read_text())
        if (
            previous["status"] != "passed"
            or previous["model_revision"] != MODELS[model][1]
            or previous["corpus_sha256"] != CORPUS_SHA
            or previous["dev_sha256"] != DEV_SHA
        ):
            raise ValueError("DENSE_RESULT_MISMATCH")
        runtime = previous["runtime_identity"]
        expected = json.loads(runtime)
        for key, path in (
            ("processor", ROOT / "dense_dev.py"),
            ("loader", ROOT / "encoder_smoke.py"),
        ):
            if hashlib.sha256(path.read_bytes()).hexdigest() != expected[key]:
                raise ValueError(f"CACHE_FINGERPRINT_MISMATCH: {key}")
        revision, dimension = MODELS[model][1:]
        cache = args.cache / "vectors" / model

        def vector(
            text,
            model=model,
            revision=revision,
            runtime=runtime,
            cache=cache,
            dimension=dimension,
        ):
            key = cache_key(model, revision, revision, text, runtime)
            found = load_cached_vector(cache / (key + ".npy"), dimension)
            if found is None:
                raise ValueError(f"MISSING_VECTOR_CACHE: {key}")
            return found

        qvectors = {q.query_id: vector(q.query) for q in queries}
        results["configurations"][model] = {}
        for size in bm["chunk_sizes"]:
            chunks = build_chunks(units, size, counters)
            vectors = np.stack([vector(c.text) for c in chunks])
            rankings, timings = {}, {}
            for q in queries:
                start = time.monotonic()
                lexical = search_bm25(
                    chunks, q.query, top_k=rrf["pool_k"], k1=bm["k1"], b=bm["b"]
                )
                dense = search_dense(
                    chunks, vectors, qvectors[q.query_id], top_k=rrf["pool_k"]
                )
                if lexical[:5] != [
                    Hit.model_validate(h)
                    for h in prior_bm["configurations"][str(size)]["rankings"][
                        q.query_id
                    ]
                ]:
                    raise ValueError(f"BM25_RANKING_MISMATCH: {size} {q.query_id}")
                if dense[:5] != [
                    Hit.model_validate(h)
                    for h in previous["configurations"][str(size)]["rankings"][
                        q.query_id
                    ]
                ]:
                    raise ValueError(
                        f"DENSE_RANKING_MISMATCH: {model} {size} {q.query_id}"
                    )
                rankings[q.query_id] = fuse_rrf(
                    [lexical, dense], top_k=rrf["top_k"], k=rrf["rrf_k"]
                )
                timings[q.query_id] = time.monotonic() - start
            results["configurations"][model][str(size)] = {
                "metrics": score_queries(queries, rankings, units),
                "retrieval_seconds": timings,
                "rankings": {
                    qid: [hit.model_dump() for hit in hits]
                    for qid, hits in rankings.items()
                },
            }
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(results, output, ensure_ascii=False, indent=2)
        output.write("\n")


if __name__ == "__main__":
    main()
