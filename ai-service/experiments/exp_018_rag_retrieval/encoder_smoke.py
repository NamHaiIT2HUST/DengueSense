"""Run one pinned encoder offline under a macOS resource watchdog."""

import argparse
import json
import os
import re
import resource
import subprocess
import sys
import tempfile
import time
from pathlib import Path

MODELS = {
    "gte": (
        "Alibaba-NLP/gte-multilingual-base",
        "9bbca17d9273fd0d03d5725c7a4b0f6b45142062",
        768,
    ),
    "bge": ("BAAI/bge-m3", "5617a9f61b028005a4858fdac845db406aefb181", 1024),
}
CODE_REVISION = "40ced75c3017eb27626c9d4ea981bde21a2662f4"
CORPUS_SHA = "3a7cdd649f1f449b6c58923bc8c84899477ce08050442620bdd4c6198888a48a"
DEV_SHA = "15f93d2949cb8659097c14b0c1f38c8819ce53cd756be8f6197fe476fd5f0759"


def stop_reason(rss: int, levels: list[int], swaps: list[float]) -> str | None:
    if rss > 8 * 1024**3:
        return "RSS_LIMIT"
    if len(levels) >= 3 and all(level > 1 for level in levels[-3:]):
        return "MEMORY_PRESSURE"
    if len(swaps) >= 4 and all(a < b for a, b in zip(swaps[-4:-1], swaps[-3:])):
        return "SWAP_RISING"
    return None


def memory_state() -> tuple[int, float]:
    level = int(
        subprocess.check_output(
            ["sysctl", "-n", "kern.memorystatus_vm_pressure_level"], text=True
        ).strip()
    )
    output = subprocess.check_output(["sysctl", "-n", "vm.swapusage"], text=True)
    match = re.search(r"used\s*=\s*([\d.]+)([MG])", output)
    if not match or level not in (1, 2, 4):
        raise RuntimeError("MEMORY_MONITOR_UNAVAILABLE")
    return level, float(match[1]) * (1024 if match[2] == "G" else 1)


def worker(args: argparse.Namespace) -> None:
    import hashlib

    import numpy as np
    import tokenizers
    import torch
    import transformers
    from tokenizers import Tokenizer
    from transformers import AutoModel, AutoTokenizer

    from app.genai_rag.offline.chunking import build_chunks
    from app.genai_rag.offline.corpus import SourceUnit
    from experiments.exp_018_rag_retrieval.bm25_dev import TOKENIZER_HASHES

    if sys.prefix == sys.base_prefix or any(
        not Path(m.__file__).resolve().is_relative_to(Path(sys.prefix).resolve())
        for m in (torch, tokenizers, transformers)
    ):
        raise RuntimeError("VENV_REQUIRED")
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    corpus = args.corpus.read_bytes()
    experiment = Path(__file__).resolve().parent
    dev = (experiment / "queries-dev.jsonl").read_bytes()
    if (
        hashlib.sha256(corpus).hexdigest() != CORPUS_SHA
        or hashlib.sha256(dev).hexdigest() != DEV_SHA
    ):
        raise ValueError("LOCK_HASH_MISMATCH")
    units = [SourceUnit.model_validate(u) for u in json.loads(corpus)]
    toks = {
        name: Tokenizer.from_file(str(path))
        for name, path in (("bge", args.bge_tokenizer), ("gte", args.gte_tokenizer))
    }
    for name, path in (("bge", args.bge_tokenizer), ("gte", args.gte_tokenizer)):
        if hashlib.sha256(path.read_bytes()).hexdigest() != TOKENIZER_HASHES[name]:
            raise ValueError(f"TOKENIZER_HASH_MISMATCH: {name}")
    if args.model == "gte":
        code_dir = (
            args.cache / "models--Alibaba-NLP--new-impl" / "snapshots" / CODE_REVISION
        )
        for name, expected in {
            "configuration.py": "3411088045ffb8a9a0aa9936eae275896b39983a2ee5b08f091b44e6289e4fe4",
            "modeling.py": "374670b416fcc82f081c9cd28b5fd61c2bd91bbe18eb4798fcc48a81f9c250a0",
        }.items():
            if hashlib.sha256((code_dir / name).read_bytes()).hexdigest() != expected:
                raise ValueError(f"CODE_HASH_MISMATCH: {name}")
    for tokenizer in toks.values():
        tokenizer.no_truncation()
    counters = {
        name: (
            lambda text, t=tokenizer: len(t.encode(text, add_special_tokens=False).ids)
        )
        for name, tokenizer in toks.items()
    }
    chunks = build_chunks(units, 1024, counters)
    chunks.sort(key=lambda c: (-max(c.token_counts.values()), c.chunk_id))
    samples = [(c.chunk_id, c.text) for c in chunks[:20]]
    samples += [
        (q["query_id"], q["query"])
        for q in [json.loads(line) for line in dev.decode().splitlines()][:5]
    ]
    model_id, revision, dimension = MODELS[args.model]
    start = time.monotonic()
    common = {
        "revision": revision,
        "cache_dir": str(args.cache),
        "local_files_only": True,
    }
    tokenizer = AutoTokenizer.from_pretrained(model_id, **common)
    options = dict(common, torch_dtype=torch.float32)
    if args.model == "gte":
        options.update(
            trust_remote_code=True,
            code_revision=CODE_REVISION,
            attn_implementation="eager",
        )
    model = AutoModel.from_pretrained(model_id, **options).to("cpu").eval()
    if args.stage == "dev":
        from experiments.exp_018_rag_retrieval.dense_dev import run

        result = run(
            args, units, dev, counters, model, tokenizer, torch, revision, dimension
        )
        result["load_and_run_seconds"] = time.monotonic() - start
        result["peak_rss_bytes"] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        result["versions"] = {
            "python": sys.version.split()[0],
            "torch": torch.__version__,
            "transformers": transformers.__version__,
            "tokenizers": tokenizers.__version__,
        }
        print(json.dumps(result))
        return
    records = []
    for sample_id, text in samples:
        encoded = tokenizer(text, return_tensors="pt", truncation=False)
        count = int(encoded["input_ids"].shape[1])
        if count > 1152:
            raise ValueError(f"INPUT_TOO_LONG: {sample_id} {count}")
        before = time.monotonic()
        with torch.inference_mode():
            vector = model(**encoded).last_hidden_state[:, 0, :].float().cpu().numpy()
        if (
            vector.shape != (1, dimension)
            or not np.isfinite(vector).all()
            or not np.any(vector)
        ):
            raise ValueError(f"INVALID_VECTOR: {sample_id}")
        records.append(
            {
                "id": sample_id,
                "tokens": count,
                "dimension": dimension,
                "finite": True,
                "seconds": time.monotonic() - before,
            }
        )
        args.partial.write_text(
            json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    print(
        json.dumps(
            {
                "versions": {
                    "python": sys.version.split()[0],
                    "torch": torch.__version__,
                    "transformers": transformers.__version__,
                    "tokenizers": tokenizers.__version__,
                },
                "venv": sys.prefix,
                "load_and_run_seconds": time.monotonic() - start,
                "peak_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                "records": records,
            }
        )
    )


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model", choices=MODELS, required=True)
    p.add_argument("--stage", choices=("smoke", "dev"), default="smoke")
    p.add_argument("--corpus", type=Path, required=True)
    p.add_argument("--bge-tokenizer", type=Path, required=True)
    p.add_argument("--gte-tokenizer", type=Path, required=True)
    p.add_argument("--cache", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--partial", type=Path, required=True)
    p.add_argument("--worker", action="store_true")
    args = p.parse_args()
    if args.worker:
        worker(args)
        return
    if sys.prefix == sys.base_prefix:
        raise RuntimeError("VENV_REQUIRED")
    if args.output.exists() or args.partial.exists():
        raise FileExistsError("OUTPUT_ALREADY_EXISTS")
    level, swap = memory_state()
    if level != 1:
        raise RuntimeError("INITIAL_MEMORY_PRESSURE")
    lock = (
        args.cache / ("dense-" + args.model + ".lock") if args.stage == "dev" else None
    )
    if lock:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
    env = dict(
        os.environ,
        HF_HUB_OFFLINE="1",
        TRANSFORMERS_OFFLINE="1",
        HF_HUB_CACHE=str(args.cache),
        HF_MODULES_CACHE=str(args.cache / "modules"),
        TOKENIZERS_PARALLELISM="false",
    )
    command = [
        sys.executable,
        "-m",
        "experiments.exp_018_rag_retrieval.encoder_smoke",
        *sys.argv[1:],
        "--worker",
    ]
    with tempfile.TemporaryFile(mode="w+") as stdout_log, tempfile.TemporaryFile(
        mode="w+"
    ) as stderr_log:
        proc = subprocess.Popen(
            command, stdout=stdout_log, stderr=stderr_log, text=True, env=env
        )
        levels, swaps, peak = [level], [swap], 0
        reason = None
        while proc.poll() is None:
            try:
                rss_output = subprocess.check_output(
                    ["ps", "-o", "rss=", "-p", str(proc.pid)], text=True
                ).strip()
                rss = int(rss_output) * 1024 if rss_output else 0
                peak = max(peak, rss)
                level, swap = memory_state()
                levels.append(level)
                swaps.append(swap)
                reason = stop_reason(rss, levels, swaps)
            except (OSError, ValueError, subprocess.SubprocessError, RuntimeError):
                reason = "MEMORY_MONITOR_UNAVAILABLE"
            if reason:
                proc.terminate()
                break
            time.sleep(1)
        proc.wait()
        stdout_log.seek(0)
        stderr_log.seek(0)
        stdout, stderr = stdout_log.read(), stderr_log.read()
    result = {
        "stage": args.stage,
        "model": args.model,
        "model_revision": MODELS[args.model][1],
        "tokenizer_revision": MODELS[args.model][1],
        "code_revision": CODE_REVISION if args.model == "gte" else None,
        "device": "cpu",
        "dtype": "float32",
        "batch": 1,
        "threads": [4, 1],
        "corpus_sha256": CORPUS_SHA,
        "dev_sha256": DEV_SHA,
        "peak_rss_observed_bytes": peak,
        "memory_levels": levels,
        "swap_used_mb": swaps,
        "status": "failed",
        "reason": reason,
        "exit_code": proc.returncode,
    }
    if not reason and proc.returncode == 0:
        result.update(json.loads(stdout.strip().splitlines()[-1]))
        if result["peak_rss_bytes"] > 8 * 1024**3:
            result["reason"] = "RSS_LIMIT"
        else:
            result["status"] = "passed"
    else:
        result["error"] = stderr[-8000:]
        if args.partial.exists():
            result["records"] = json.loads(args.partial.read_text(encoding="utf-8"))
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write("\n")
    if lock:
        lock.unlink()
    print(
        json.dumps(
            {"status": result["status"], "reason": reason, "output": str(args.output)}
        )
    )
    if result["status"] != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
