"""Run the locked dev-only BM25 baseline without network access."""

import argparse
import hashlib
import json
import platform
from importlib.metadata import version
from pathlib import Path

from tokenizers import Tokenizer

from app.genai_rag.offline.chunking import build_chunks
from app.genai_rag.offline.corpus import SourceUnit
from app.genai_rag.offline.evaluate import Query, score_queries, validate_queries
from app.genai_rag.offline.retrieve import search_bm25

EXPERIMENT = Path(__file__).resolve().parent
LOCK_HASH = "0dc3e1fd04a15adc9766211fc7e0edf59c9e349783e5018e9b576bd2972b32ff"
TOKENIZER_HASHES = {
    "bge": "21106b6d7dab2952c1d496fb21d5dc9db75c28ed361a05f5020bbba27810dd08",
    "gte": "f59925fcb90c92b894cb93e51bb9b4a6105c5c249fe54ce1c704420ac39b81af",
}


def verified_bytes(path: Path, expected: str) -> bytes:
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"HASH_MISMATCH: {path}")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", required=True, type=Path)
    parser.add_argument("--bge-tokenizer", required=True, type=Path)
    parser.add_argument("--gte-tokenizer", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    config = json.loads((EXPERIMENT / "bm25-baseline.json").read_text(encoding="utf-8"))
    if config["top_k"] != 5:
        raise ValueError("METRIC_REQUIRES_TOP_5")
    lock = json.loads(verified_bytes(EXPERIMENT / "queries-lock-v0.1.json", LOCK_HASH))
    units = [
        SourceUnit.model_validate(u)
        for u in json.loads(verified_bytes(args.corpus, lock["corpus_sha256"]))
    ]
    dev = lock["splits"]["dev"]
    queries = [
        Query.model_validate_json(line)
        for line in verified_bytes(EXPERIMENT / dev["file"], dev["sha256"])
        .decode("utf-8")
        .splitlines()
    ]
    validate_queries(queries, units)
    if (
        len(queries) != dev["count"]
        or sum(q.answerable for q in queries) != dev["answerable"]
    ):
        raise ValueError("INVALID_DEV_COUNTS")
    tokenizers = {}
    for name, path in [("bge", args.bge_tokenizer), ("gte", args.gte_tokenizer)]:
        verified_bytes(path, TOKENIZER_HASHES[name])
        tokenizers[name] = Tokenizer.from_file(str(path))
        tokenizers[name].no_truncation()
    counters = {
        name: (
            lambda text, tokenizer=tokenizer: len(
                tokenizer.encode(text, add_special_tokens=False).ids
            )
        )
        for name, tokenizer in tokenizers.items()
    }
    result = {
        "split": "dev",
        "corpus_sha256": lock["corpus_sha256"],
        "queries_sha256": dev["sha256"],
        "tokenizer_sha256": TOKENIZER_HASHES,
        "metric_version": "source-span-coverage-v1",
        "bm25": {
            "package": "rank-bm25",
            "version": version("rank-bm25"),
            "k1": config["k1"],
            "b": config["b"],
            "top_k": config["top_k"],
            "normalization": "NFC + casefold + Unicode alphanumeric",
        },
        "environment": {
            "python": platform.python_version(),
            "numpy": version("numpy"),
            "tokenizers": version("tokenizers"),
        },
        "configurations": {},
    }
    for target in config["chunk_sizes"]:
        entry = {"errors": [], "rankings": {}}
        result["configurations"][str(target)] = entry
        try:
            chunks = build_chunks(units, target, counters)
            for chunk in chunks:
                if any(
                    len(t.encode(chunk.text, add_special_tokens=True).ids) > 1152
                    for t in tokenizers.values()
                ):
                    raise ValueError(f"ENCODER_LIMIT: {chunk.chunk_id}")
            entry["chunk_count"] = len(chunks)
            rankings = {}
            for query in queries:
                try:
                    rankings[query.query_id] = search_bm25(
                        chunks,
                        query.query,
                        top_k=config["top_k"],
                        k1=config["k1"],
                        b=config["b"],
                    )
                    entry["rankings"][query.query_id] = [
                        hit.model_dump() for hit in rankings[query.query_id]
                    ]
                except (ValueError, RuntimeError) as exc:
                    entry["errors"].append(
                        {
                            "query_id": query.query_id,
                            "error": f"{type(exc).__name__}: {exc}",
                        }
                    )
            entry["metrics"] = (
                score_queries(queries, rankings, units, k=config["top_k"])
                if not entry["errors"]
                else None
            )
        except (ValueError, RuntimeError) as exc:
            entry["errors"].append({"error": f"{type(exc).__name__}: {exc}"})
            entry["metrics"] = None
    with args.output.open("x", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    if any(entry["errors"] for entry in result["configurations"].values()):
        raise SystemExit("Baseline incomplete; see errors in output")


if __name__ == "__main__":
    main()
