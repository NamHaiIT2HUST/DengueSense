"""Encode locked dev inputs and evaluate exact cosine retrieval."""

import hashlib
import json
import os
import tempfile
import time
from pathlib import Path

import numpy as np

from app.genai_rag.offline.chunking import build_chunks
from app.genai_rag.offline.dense import cache_key, load_cached_vector, search_dense
from app.genai_rag.offline.evaluate import Query, score_queries, validate_queries


def run(args, units, dev, counters, model, tokenizer, torch, revision, dimension):
    queries = [Query.model_validate_json(line) for line in dev.decode().splitlines()]
    validate_queries(queries, units)
    if len(queries) != 20 or sum(q.answerable for q in queries) != 15:
        raise ValueError("INVALID_DEV_COUNTS")
    configs = json.loads((Path(__file__).parent / "bm25-baseline.json").read_text())
    if configs["top_k"] != 5:
        raise ValueError("METRIC_REQUIRES_TOP_5")
    cache = args.cache / "vectors" / args.model
    cache.mkdir(parents=True, exist_ok=True)
    runtime = json.dumps(
        {
            "torch": torch.__version__,
            "numpy": np.__version__,
            "transformers": __import__("transformers").__version__,
            "tokenizers": __import__("tokenizers").__version__,
            "pooling": "cls-float32-v1",
            "code": (
                "40ced75c3017eb27626c9d4ea981bde21a2662f4"
                if args.model == "gte"
                else None
            ),
            "processor": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "loader": hashlib.sha256(
                (Path(__file__).parent / "encoder_smoke.py").read_bytes()
            ).hexdigest(),
        },
        sort_keys=True,
    )
    records, times = [], []

    def encode(item_id, text):
        key = cache_key(args.model, revision, revision, text, runtime)
        path = cache / (key + ".npy")
        vector = load_cached_vector(path, dimension)
        cached = vector is not None
        start = time.monotonic()
        encoded = tokenizer(text, return_tensors="pt", truncation=False)
        count = int(encoded["input_ids"].shape[1])
        if count > 1152:
            raise ValueError(f"INPUT_TOO_LONG: {item_id}")
        if vector is None:
            with torch.inference_mode():
                vector = (
                    model(**encoded).last_hidden_state[0, 0, :].float().cpu().numpy()
                )
            if (
                vector.shape != (dimension,)
                or not np.isfinite(vector).all()
                or not np.any(vector)
            ):
                raise ValueError(f"INVALID_VECTOR: {item_id}")
            fd, temp = tempfile.mkstemp(prefix=".vector-", dir=cache)
            with os.fdopen(fd, "wb") as handle:
                np.save(handle, vector, allow_pickle=False)
            os.replace(temp, path)
        duration = time.monotonic() - start
        times.append(duration)
        records.append(
            {"id": item_id, "tokens": count, "cache_hit": cached, "seconds": duration}
        )
        args.partial.write_text(
            json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return vector

    qvectors = {q.query_id: encode(q.query_id, q.query) for q in queries}
    result = {
        "configurations": {},
        "vector_cache": str(cache),
        "runtime_identity": runtime,
    }
    for size in configs["chunk_sizes"]:
        chunks = build_chunks(units, size, counters)
        vectors = np.stack([encode(c.chunk_id, c.text) for c in chunks])
        rankings, retrieval_seconds = {}, {}
        for q in queries:
            start = time.monotonic()
            rankings[q.query_id] = search_dense(
                chunks, vectors, qvectors[q.query_id], top_k=configs["top_k"]
            )
            retrieval_seconds[q.query_id] = time.monotonic() - start
        metrics = score_queries(queries, rankings, units, k=configs["top_k"])
        who = {
            q.query_id: score_queries([q], {q.query_id: rankings[q.query_id]}, units)[
                "recall_at_5"
            ]
            for q in queries
            if q.query_id in {f"dev-{n}" for n in range(10, 16)}
        }
        result["configurations"][str(size)] = {
            "chunk_count": len(chunks),
            "metrics": metrics,
            "who_recall": who,
            "retrieval_seconds": retrieval_seconds,
            "rankings": {
                key: [hit.model_dump() for hit in hits]
                for key, hits in rankings.items()
            },
        }
    result["encoding_records"] = records
    result["encode_total_seconds"] = sum(times)
    return result
