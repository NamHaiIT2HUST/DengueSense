"""Encode eval queries under the locked dev settings and resource watchdog."""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from experiments.exp_018_rag_retrieval.encoder_smoke import (
    CODE_REVISION,
    CORPUS_SHA,
    MODELS,
    memory_state,
    stop_reason,
)
from experiments.exp_018_rag_retrieval.eval_matrix import verify_hashes

ROOT = Path(__file__).resolve().parent
EVAL_SHA = "3c351cd7c0313e9f7ecad365891e32578a003f8ff7fabd11b5c59f683a1c6d5c"


def check_selection():
    selection = json.loads((ROOT / "selection-dev-v0.1.json").read_text())
    paths = {
        name: ROOT / filename
        for name, filename in {
            "corpus_lock": "corpus-lock-v0.1.json",
            "query_lock": "queries-lock-v0.1.json",
            "bm25_config": "bm25-baseline.json",
            "hybrid_config": "hybrid-baseline.json",
            "bm25_dev": "bm25-dev-v0.1.json",
            "gte_dev": "dense-gte-dev-resume-v0.1.json",
            "bge_dev": "dense-bge-dev-v0.1.json",
            "hybrid_dev": "hybrid-dev-v0.1.json",
            "encoder_runner": "encoder_smoke.py",
            "dense_runner": "dense_dev.py",
            "hybrid_runner": "hybrid_dev.py",
        }.items()
    }
    paths.update(
        {
            "chunking_code": Path("app/genai_rag/offline/chunking.py"),
            "dense_code": Path("app/genai_rag/offline/dense.py"),
            "bm25_retriever_code": Path("app/genai_rag/offline/retrieve.py"),
            "evaluator_code": Path("app/genai_rag/offline/evaluate.py"),
        }
    )
    verify_hashes(selection["source_sha256"], paths)
    return selection


def worker(args):
    import resource

    import tokenizers
    import torch
    import transformers
    from tokenizers import Tokenizer
    from transformers import AutoModel, AutoTokenizer

    from app.genai_rag.offline.corpus import SourceUnit
    from experiments.exp_018_rag_retrieval.bm25_dev import (
        TOKENIZER_HASHES,
        verified_bytes,
    )
    from experiments.exp_018_rag_retrieval.dense_dev import run

    if sys.prefix == sys.base_prefix or any(
        not Path(m.__file__).resolve().is_relative_to(Path(sys.prefix).resolve())
        for m in (torch, tokenizers, transformers)
    ):
        raise RuntimeError("VENV_REQUIRED")
    check_selection()
    corpus = verified_bytes(args.corpus, CORPUS_SHA)
    eval_data = verified_bytes(ROOT / "queries-eval.jsonl", EVAL_SHA)
    if any(
        json.loads(line)["split"] != "eval" for line in eval_data.decode().splitlines()
    ):
        raise ValueError("INVALID_EVAL_SPLIT")
    units = [SourceUnit.model_validate(u) for u in json.loads(corpus)]
    toks = {}
    for name, path in (("bge", args.bge_tokenizer), ("gte", args.gte_tokenizer)):
        verified_bytes(path, TOKENIZER_HASHES[name])
        toks[name] = Tokenizer.from_file(str(path))
        toks[name].no_truncation()
    if args.model == "gte":
        code_dir = (
            args.cache / "models--Alibaba-NLP--new-impl" / "snapshots" / CODE_REVISION
        )
        verify_hashes(
            {
                "configuration.py": "3411088045ffb8a9a0aa9936eae275896b39983a2ee5b08f091b44e6289e4fe4",
                "modeling.py": "374670b416fcc82f081c9cd28b5fd61c2bd91bbe18eb4798fcc48a81f9c250a0",
            },
            {name: code_dir / name for name in ("configuration.py", "modeling.py")},
        )
    counters = {
        name: (lambda text, t=tok: len(t.encode(text, add_special_tokens=False).ids))
        for name, tok in toks.items()
    }
    torch.set_num_threads(4)
    torch.set_num_interop_threads(1)
    model_id, revision, dimension = MODELS[args.model]
    start = time.monotonic()
    options = {
        "revision": revision,
        "cache_dir": str(args.cache),
        "local_files_only": True,
    }
    tokenizer = AutoTokenizer.from_pretrained(model_id, **options)
    model_options = dict(options, torch_dtype=torch.float32)
    if args.model == "gte":
        model_options.update(
            trust_remote_code=True,
            code_revision=CODE_REVISION,
            attn_implementation="eager",
        )
    model = AutoModel.from_pretrained(model_id, **model_options).to("cpu").eval()
    result = run(
        args, units, eval_data, counters, model, tokenizer, torch, revision, dimension
    )
    result.update(
        {
            "load_and_run_seconds": time.monotonic() - start,
            "peak_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            "eval_sha256": EVAL_SHA,
            "corpus_sha256": CORPUS_SHA,
            "model_revision": revision,
        }
    )
    print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", choices=MODELS, required=True)
    for name in (
        "corpus",
        "bge-tokenizer",
        "gte-tokenizer",
        "cache",
        "output",
        "partial",
    ):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--worker", action="store_true")
    args = parser.parse_args()
    if args.worker:
        worker(args)
        return
    if sys.prefix == sys.base_prefix:
        raise RuntimeError("VENV_REQUIRED")
    check_selection()
    if args.output.exists() or args.partial.exists():
        raise FileExistsError("OUTPUT_ALREADY_EXISTS")
    level, swap = memory_state()
    if level != 1:
        raise RuntimeError("INITIAL_MEMORY_PRESSURE")
    lock = args.cache / ("dense-" + args.model + ".lock")
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
        "experiments.exp_018_rag_retrieval.eval_encoder",
        *sys.argv[1:],
        "--worker",
    ]
    with tempfile.TemporaryFile(mode="w+") as out, tempfile.TemporaryFile(
        mode="w+"
    ) as err:
        proc = subprocess.Popen(command, stdout=out, stderr=err, text=True, env=env)
        levels, swaps, peak = [level], [swap], 0
        reason = None
        while proc.poll() is None:
            try:
                rss_text = subprocess.check_output(
                    ["ps", "-o", "rss=", "-p", str(proc.pid)], text=True
                ).strip()
                rss = int(rss_text) * 1024 if rss_text else 0
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
        out.seek(0)
        err.seek(0)
        stdout, stderr = out.read(), err.read()
    result = {
        "stage": "eval",
        "model": args.model,
        "status": "failed",
        "reason": reason,
        "exit_code": proc.returncode,
        "peak_rss_observed_bytes": peak,
        "memory_levels": levels,
        "swap_used_mb": swaps,
    }
    if not reason and proc.returncode == 0:
        result.update(json.loads(stdout.strip().splitlines()[-1]))
        result["status"] = (
            "passed" if result["peak_rss_bytes"] <= 8 * 1024**3 else "failed"
        )
    else:
        result["error"] = stderr[-8000:]
        if args.partial.exists():
            result["records"] = json.loads(args.partial.read_text())
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write("\n")
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
