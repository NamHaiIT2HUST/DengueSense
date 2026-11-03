"""Entry point and writer lock for offline retrieval experiments."""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent


@contextmanager
def writer_lock(directory: Path, name: str = ".retrieval-writer.lock"):
    path = directory / name
    try:
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise RuntimeError(
            f"WRITER_LOCKED: {path}; inspect the owner before removing a stale lock"
        ) from exc
    try:
        with os.fdopen(fd, "w") as handle:
            handle.write(str(os.getpid()))
        yield
    finally:
        path.unlink()


def load_config(path: Path):
    from experiments.exp_018_rag_retrieval.bm25_dev import (
        TOKENIZER_HASHES,
        verified_bytes,
    )
    from experiments.exp_018_rag_retrieval.encoder_smoke import CORPUS_SHA
    from experiments.exp_018_rag_retrieval.eval_encoder import check_selection

    config = yaml.safe_load(path.read_text(encoding="utf-8"))
    required = {"corpus", "bge_tokenizer", "gte_tokenizer", "cache"}
    if (
        not isinstance(config, dict)
        or set(config) != required
        or any(not isinstance(v, str) or not v for v in config.values())
    ):
        raise ValueError("INVALID_RUN_CONFIG")
    values = {
        key: Path(os.path.expandvars(value)).expanduser()
        for key, value in config.items()
    }
    if any("$" in str(value) for value in values.values()):
        raise ValueError("UNSET_CONFIG_ENVIRONMENT")
    check_selection()
    corpus_lock = json.loads((ROOT / "corpus-lock-v0.1.json").read_text())
    verified_bytes(ROOT / "corpus-manifest.yaml", corpus_lock["manifest_sha256"])
    verified_bytes(values["corpus"], CORPUS_SHA)
    for name in ("bge", "gte"):
        verified_bytes(values[name + "_tokenizer"], TOKENIZER_HASHES[name])
    if not values["cache"].is_dir():
        raise ValueError("CACHE_NOT_FOUND")
    return values


def describe(stage: str):
    if stage == "smoke":
        return {
            "stage": stage,
            "models": 2,
            "max_chunks_per_model": 20,
            "dev_queries_per_model": 5,
        }
    return {
        "stage": stage,
        "configurations": 15,
        "queries": 20,
        "query_runs": 300,
        "document_embedding_sets": 6,
        "query_embedding_sets": 2,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--stage", choices=("smoke", "dev", "eval"), required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--encode-eval", action="store_true")
    args = parser.parse_args()
    if args.encode_eval and args.stage != "eval":
        raise ValueError("ENCODE_EVAL_REQUIRES_EVAL_STAGE")
    if sys.prefix == sys.base_prefix:
        raise RuntimeError("VENV_REQUIRED")
    config = load_config(args.config)
    if args.dry_run:
        print(json.dumps(describe(args.stage), ensure_ascii=False))
        return
    args.out.mkdir(parents=True, exist_ok=True)
    identity = hashlib.sha256(
        json.dumps(
            {
                "config": {k: str(v.resolve()) for k, v in config.items()},
                "stage": args.stage,
                "encode_eval": args.encode_eval,
                "runner_sha256": hashlib.sha256(
                    Path(__file__).read_bytes()
                ).hexdigest(),
                "selection": hashlib.sha256(
                    (ROOT / "selection-dev-v0.1.json").read_bytes()
                ).hexdigest(),
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()
    common = [
        "--corpus",
        str(config["corpus"]),
        "--bge-tokenizer",
        str(config["bge_tokenizer"]),
        "--gte-tokenizer",
        str(config["gte_tokenizer"]),
    ]

    def invoke(module, output, extra):
        job_identity = hashlib.sha256(
            (
                identity
                + hashlib.sha256(
                    (ROOT / (module.rsplit(".", 1)[-1] + ".py")).read_bytes()
                ).hexdigest()
            ).encode()
        ).hexdigest()
        marker = output.with_suffix(output.suffix + ".sha256.json")
        if args.resume and output.exists() and not marker.exists():
            previous = json.loads(output.read_text())
            if previous.get("status") != "failed":
                raise ValueError(f"UNVERIFIED_EXISTING_OUTPUT: {output}")
            output.rename(output.with_name(output.name + f".failed-{time.time_ns()}"))
        if output.exists() or marker.exists():
            if not args.resume or not output.exists() or not marker.exists():
                raise FileExistsError(f"UNVERIFIED_EXISTING_OUTPUT: {output}")
            recorded = json.loads(marker.read_text())
            if recorded != {
                "identity": job_identity,
                "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            }:
                raise ValueError(f"OUTPUT_MISMATCH: {output}")
            return
        try:
            subprocess.run(
                [
                    sys.executable,
                    "-m",
                    module,
                    *common,
                    *extra,
                    "--output",
                    str(output),
                ],
                check=True,
            )
        except subprocess.CalledProcessError as exc:
            failure = output.with_name(output.name + f".error-{time.time_ns()}.json")
            with failure.open("x", encoding="utf-8") as handle:
                json.dump(
                    {
                        "status": "failed",
                        "stage": args.stage,
                        "module": module,
                        "exit_code": exc.returncode,
                    },
                    handle,
                )
            raise
        marker.write_text(
            json.dumps(
                {
                    "identity": job_identity,
                    "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
                }
            )
            + "\n"
        )

    with writer_lock(args.out):
        if args.stage == "smoke":
            for model in ("gte", "bge"):
                invoke(
                    "experiments.exp_018_rag_retrieval.encoder_smoke",
                    args.out / f"smoke-{model}.json",
                    [
                        "--model",
                        model,
                        "--cache",
                        str(config["cache"]),
                        "--partial",
                        str(args.out / f"smoke-{model}.partial-{time.time_ns()}.json"),
                    ],
                )
        elif args.stage == "dev":
            invoke(
                "experiments.exp_018_rag_retrieval.bm25_dev",
                args.out / "bm25-dev.json",
                [],
            )
            for model in ("gte", "bge"):
                invoke(
                    "experiments.exp_018_rag_retrieval.encoder_smoke",
                    args.out / f"dense-{model}-dev.json",
                    [
                        "--stage",
                        "dev",
                        "--model",
                        model,
                        "--cache",
                        str(config["cache"]),
                        "--partial",
                        str(
                            args.out
                            / f"dense-{model}-dev.partial-{time.time_ns()}.json"
                        ),
                    ],
                )
            invoke(
                "experiments.exp_018_rag_retrieval.hybrid_dev",
                args.out / "hybrid-dev.json",
                ["--cache", str(config["cache"])],
            )
        else:
            if args.encode_eval:
                sources = {}
                for model in ("gte", "bge"):
                    sources[model] = args.out / f"eval-{model}.json"
                    invoke(
                        "experiments.exp_018_rag_retrieval.eval_encoder",
                        sources[model],
                        [
                            "--model",
                            model,
                            "--cache",
                            str(config["cache"]),
                            "--partial",
                            str(
                                args.out / f"eval-{model}.partial-{time.time_ns()}.json"
                            ),
                        ],
                    )
            else:
                existing = ROOT / "eval-matrix-verified-v0.1.json"
                historical = json.loads(existing.read_text())["identity"]["dense_runs"]
                sources = {
                    name: ROOT / f"eval-{name}-v0.1.json" for name in ("gte", "bge")
                }
                for name, path in sources.items():
                    if (
                        hashlib.sha256(path.read_bytes()).hexdigest()
                        != historical[name]
                    ):
                        raise ValueError(f"DENSE_EVAL_HASH_MISMATCH: {name}")
            checkpoint = args.out / "eval-checkpoint.json"
            if checkpoint.exists() and not args.resume:
                raise FileExistsError(f"CHECKPOINT_EXISTS: {checkpoint}; use --resume")
            invoke(
                "experiments.exp_018_rag_retrieval.eval_matrix",
                args.out / "eval-matrix.json",
                [
                    "--cache",
                    str(config["cache"]),
                    "--checkpoint",
                    str(checkpoint),
                    "--gte-run",
                    str(sources["gte"]),
                    "--bge-run",
                    str(sources["bge"]),
                ],
            )


if __name__ == "__main__":
    main()
