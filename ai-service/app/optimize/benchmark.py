import argparse
import itertools
import json
import os
import random
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path
from time import monotonic
from typing import Annotated, Literal

import yaml
from ortools.linear_solver import pywraplp
from pydantic import Field, field_validator

from app.optimize import cp_sat, heuristics, milp
from app.optimize.evaluate import evaluate_allocation
from app.optimize.reporting import digest, distribution
from app.optimize.scenarios import (
    GENERATOR_VERSION,
    ScenarioProfile,
    generate_scenarios,
)
from app.optimize.settings import (
    Fraction,
    HeuristicSettings,
    MilpSettings,
    Positive,
    PositiveCount,
)
from app.optimize.staffing import PhaseSummary, Record, SolveResult, StaffingScenario

Seed = Annotated[int, Field(strict=True, ge=0, le=2**31 - 1)]


class BenchmarkConfig(Record):
    report_schema_version: Literal[2]
    data_seed: Seed
    order_seed: Seed
    count_per_size: PositiveCount
    replicas: list[PositiveCount]
    methods: list[Literal["cp_sat", "scip", "sa", "tabu"]]
    solver_seeds: list[Seed]
    time_budgets_s: list[Positive]
    seed_search_fraction: Fraction
    profile: ScenarioProfile
    milp: MilpSettings
    heuristic: HeuristicSettings

    @field_validator("replicas", "methods", "solver_seeds", "time_budgets_s")
    @classmethod
    def unique_nonempty(cls, values):
        if not values or len(values) != len(set(values)):
            raise ValueError("nonempty unique values required")
        return values


class Checkpoint(Record):
    report_schema_version: Literal[2]
    run_key: str
    identity: dict
    payload: dict
    checksum: str
    completed: bool


def matrix_summary(config):
    scenarios = len(config.replicas) * config.count_per_size
    multiplier = scenarios * len(config.methods) * len(config.solver_seeds)
    return {
        "scenario_count": scenarios,
        "run_count": multiplier * len(config.time_budgets_s),
        "total_budget_s": multiplier * sum(config.time_budgets_s),
        "methods": config.methods,
        "solver_seeds": config.solver_seeds,
        "time_budgets_s": config.time_budgets_s,
    }


def _write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w") as stream:
        json.dump(
            value,
            stream,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        )
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def _fingerprint():
    root = Path(__file__).resolve().parents[2]
    revision = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=root,
        text=True,
        capture_output=True,
        check=True,
    ).stdout.strip()
    files = sorted(Path(__file__).parent.glob("*.py")) + [
        root / "experiments/exp_017_staffing_mvp/run.py"
    ]
    return {
        "commit": revision,
        "files": {str(p.relative_to(root)): digest(p.read_text()) for p in files},
    }


def _versions():
    backend = pywraplp.Solver.CreateSolver("SCIP")
    return {
        "python": sys.version.split()[0],
        "ortools": version("ortools"),
        "pydantic": version("pydantic"),
        "scip": backend.SolverVersion() if backend else "unavailable",
    }


def _dataset(config):
    profile = config.profile.model_dump()
    rows = []
    for size in config.replicas:
        sized = {**profile, "replicas": size}
        for index, s in enumerate(
            generate_scenarios(sized, config.data_seed, config.count_per_size)
        ):
            s.scenario_id = f"size{size}-index{index}-{s.scenario_id}"
            scenario = s.model_dump()
            rows.append(
                {"size": size, "scenario": scenario, "scenario_hash": digest(scenario)}
            )
    return {
        "schema_version": "1",
        "generator_version": GENERATOR_VERSION,
        "data_seed": config.data_seed,
        "profile": profile,
        "base_fixture_hash": digest(Path(profile["base_fixture"]).read_text()),
        "scenarios": rows,
    }


def _manifest(config, dataset, fingerprint, versions):
    dataset_hash = digest(dataset)
    identities = []
    for row, method, seed, budget in itertools.product(
        dataset["scenarios"], config.methods, config.solver_seeds, config.time_budgets_s
    ):
        settings = (
            config.milp.model_dump()
            if method == "scip"
            else (
                config.heuristic.model_dump()
                if method in ("sa", "tabu")
                else {
                    "threads": 1,
                    "absolute_gap_limit": 0.0,
                    "relative_gap_limit": 0.0,
                }
            )
        )
        identity = {
            "report_schema_version": 2,
            "dataset_hash": dataset_hash,
            "scenario_hash": row["scenario_hash"],
            "method": method,
            "solver_seed": seed,
            "time_budget_s": budget,
            "method_settings": settings,
            "seed_search_settings": (
                {
                    "fraction": config.seed_search_fraction,
                    "source": "cp_sat_feasibility",
                }
                if method in ("sa", "tabu")
                else None
            ),
            "code_fingerprint": fingerprint,
            "backend_versions": versions,
        }
        identities.append(
            {
                "run_key": digest(identity),
                "identity": identity,
                "scenario_hash": row["scenario_hash"],
                "size": row["size"],
            }
        )
    identities.sort(key=lambda r: r["run_key"])
    random.Random(config.order_seed).shuffle(identities)
    return {
        "report_schema_version": 2,
        "config": config.model_dump(),
        "dataset_hash": dataset_hash,
        "code_fingerprint": fingerprint,
        "backend_versions": versions,
        "runs": identities,
        "expected_count": len(identities),
        "total_budget_s": matrix_summary(config)["total_budget_s"],
    }


def _pending(method, budget, seed, status="UNKNOWN", error=None):
    return SolveResult(
        solver_name=method,
        status=status,
        phases=[
            PhaseSummary(objective_name=n)
            for n in ["weighted_unmet_hours", "total_cost_vnd"]
        ],
        runtime_s=0.0,
        time_limit_s=budget,
        deadline_exceeded=False,
        time_to_first_feasible_s=None,
        first_feasible_observation="none",
        seed=seed,
        error_code=error,
    )


def _run_method(scenario, method, budget, seed, config):
    start = monotonic()
    deadline = start + budget
    initial_score = initial_hash = seed_search = None
    search_runtime = None
    first_at = None
    validated_seed = None
    try:
        if method in ("cp_sat", "scip"):
            remaining = deadline - monotonic()
            if remaining <= 0:
                result = _pending(method, budget, seed)
            elif method == "cp_sat":
                result = cp_sat.solve_staffing(scenario, remaining, seed)
            else:
                result = milp.solve_staffing(
                    scenario, remaining, seed, settings=config.milp
                )
            first_at = (result.solver_metadata or {}).get("first_feasible_at_s")
        else:
            remaining = deadline - monotonic()
            cap = min(budget * config.seed_search_fraction, remaining)
            seeded = (
                cp_sat.find_feasible_seed(scenario, cap, seed)
                if cap > 0
                else _pending("cp_sat", budget, seed)
            )
            seed_search = (
                seeded.seed_search.model_dump()
                if seeded.seed_search
                else {
                    "source": "cp_sat_feasibility",
                    "status": seeded.status,
                    "runtime_s": seeded.runtime_s,
                    "time_to_first_feasible_s": seeded.time_to_first_feasible_s,
                    "first_feasible_observation": seeded.first_feasible_observation,
                }
            )
            first_at = (seeded.solver_metadata or {}).get("first_feasible_at_s")
            valid_seed = (
                seeded.allocations is not None
                and seeded.evaluation is not None
                and seeded.evaluation.feasible
                and seeded.status in ("FEASIBLE", "OPTIMAL")
            )
            if valid_seed:
                validated_seed = seeded
                initial_score = seeded.evaluation.score.model_dump()
                initial_hash = digest([a.model_dump() for a in seeded.allocations])
                remaining = deadline - monotonic()
                if remaining <= 0:
                    result = _pending(method, budget, seed, "FEASIBLE")
                    result.allocations = seeded.allocations
                    result.evaluation = seeded.evaluation
                    result.search_steps = 0
                    search_runtime = 0.0
                else:
                    search = (
                        heuristics.improve_sa
                        if method == "sa"
                        else heuristics.improve_tabu
                    )
                    result = search(
                        scenario,
                        seeded.allocations,
                        remaining,
                        seed,
                        settings=config.heuristic,
                    )
                    search_runtime = result.runtime_s
            else:
                result = seeded.model_copy(
                    update={"solver_name": method, "search_steps": 0}
                )
            result.seed_search = seeded.seed_search
            result.time_to_first_feasible_s = seeded.time_to_first_feasible_s
            result.first_feasible_observation = seeded.first_feasible_observation
    except (ValueError, RuntimeError, OverflowError) as exc:
        result = _pending(
            method, budget, seed, "ERROR", "METHOD_ERROR:" + type(exc).__name__
        )
        if validated_seed is not None:
            result.allocations = validated_seed.allocations
            result.evaluation = validated_seed.evaluation
            result.seed_search = validated_seed.seed_search
            result.solver_metadata = validated_seed.solver_metadata
            result.first_feasible_observation = (
                validated_seed.first_feasible_observation
            )
    if result.allocations is not None:
        check = evaluate_allocation(scenario, result.allocations)
        result.evaluation = check
        if not check.feasible:
            result.status = "ERROR"
            result.error_code = "INVALID_FINAL_ALLOCATION"
            result.proven_optimal = False
    result.time_to_first_feasible_s = (
        max(0.0, first_at - start) if first_at is not None else None
    )
    if first_at is None and result.first_feasible_observation == "callback":
        result.first_feasible_observation = "final_only"
    result.runtime_s = monotonic() - start
    result.time_limit_s = budget
    result.deadline_exceeded = result.runtime_s > budget
    final_score = (
        result.evaluation.score.model_dump()
        if result.evaluation and result.evaluation.feasible
        else None
    )
    health_improvement = (
        initial_score["weighted_unmet_hours"] - final_score["weighted_unmet_hours"]
        if initial_score and final_score
        else None
    )
    cost_improvement = (
        initial_score["total_cost_vnd"] - final_score["total_cost_vnd"]
        if initial_score and final_score and health_improvement == 0
        else None
    )
    return {
        "result": result.model_dump(),
        "initial_allocations_hash": initial_hash,
        "initial_score": initial_score,
        "final_score": final_score,
        "seed_search": seed_search,
        "search_runtime_s": search_runtime,
        "search_steps": result.search_steps,
        "health_improvement": health_improvement,
        "cost_improvement": cost_improvement,
    }


def _read_checkpoint(path, run):
    checkpoint = Checkpoint.model_validate(json.loads(path.read_text()))
    if (
        checkpoint.completed is not True
        or checkpoint.run_key != run["run_key"]
        or checkpoint.identity != run["identity"]
    ):
        raise ValueError(f"CHECKPOINT_IDENTITY:{path}")
    if checkpoint.checksum != digest(checkpoint.payload):
        raise ValueError(f"CHECKSUM:{path}")
    SolveResult.model_validate(checkpoint.payload["result"])
    return checkpoint.payload


def _summarize(out, manifest, records):
    groups = {}
    comparisons = {}
    for run in manifest["runs"]:
        payload = records.get(run["run_key"])
        if payload is None:
            continue
        result = payload["result"]
        identity = run["identity"]
        group = (identity["method"], run["size"], identity["time_budget_s"])
        groups.setdefault(group, []).append(result)
        if (
            result["status"] in ("OPTIMAL", "FEASIBLE")
            and result["evaluation"]
            and result["evaluation"]["feasible"]
        ):
            score = result["evaluation"]["score"]
            key = (
                run["scenario_hash"],
                identity["solver_seed"],
                identity["time_budget_s"],
            )
            comparisons.setdefault(key, []).append(
                {
                    "method": identity["method"],
                    "health": score["weighted_unmet_hours"],
                    "unweighted_unmet": score["total_unmet_hours"],
                    "cost": score["total_cost_vnd"],
                }
            )
    metrics = []
    for (method, size, budget), results in sorted(groups.items()):
        feasible = sum(
            r["status"] in ("OPTIMAL", "FEASIBLE")
            and r["evaluation"] is not None
            and r["evaluation"]["feasible"]
            for r in results
        )
        metrics.append(
            {
                "method": method,
                "size": size,
                "time_budget_s": budget,
                "completed": len(results),
                "feasibility_rate": feasible / len(results),
                "runtime_s": distribution(
                    [r["runtime_s"] for r in results], len(results)
                ),
                "first_feasible_s": distribution(
                    [r["time_to_first_feasible_s"] for r in results], len(results)
                ),
            }
        )
    comparisons = [
        {
            "scenario_hash": key[0],
            "solver_seed": key[1],
            "time_budget_s": key[2],
            "plans": values,
            "best_health": min(v["health"] for v in values),
            "cost_at_best_health": [
                {"method": v["method"], "cost": v["cost"]}
                for v in values
                if v["health"] == min(x["health"] for x in values)
            ],
        }
        for key, values in sorted(comparisons.items())
    ]
    errors = sum(
        p["result"]["status"] in ("ERROR", "MODEL_INVALID") for p in records.values()
    )
    report = {
        "report_schema_version": 2,
        "dataset_hash": manifest["dataset_hash"],
        "expected_count": manifest["expected_count"],
        "completed": len(records),
        "pending": manifest["expected_count"] - len(records),
        "errors": errors,
        "complete": len(records) == manifest["expected_count"],
        "metrics": metrics,
        "comparisons": comparisons,
        "runs": [
            {"run_key": r["run_key"], **records[r["run_key"]]}
            for r in manifest["runs"]
            if r["run_key"] in records
        ],
    }
    _write(out / "report.json", report)
    return report


def execute(config, out, resume=False):
    config = BenchmarkConfig.model_validate(config.model_dump())
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    lock = out / ".runner.lock"
    try:
        fd = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise ValueError(f"LOCK_EXISTS:{lock}; verify owner before removing") from exc
    identity = os.fstat(fd)
    with os.fdopen(fd, "w") as stream:
        stream.write(str(os.getpid()))
    try:
        fingerprint, versions = _fingerprint(), _versions()
        manifest_path = out / "manifest.json"
        dataset_path = out / "dataset.json"
        if resume:
            manifest = json.loads(manifest_path.read_text())
            dataset = json.loads(dataset_path.read_text())
            if _manifest(config, dataset, fingerprint, versions) != manifest:
                raise ValueError("MANIFEST_IDENTITY:use new output directory")
        else:
            if (
                manifest_path.exists()
                or dataset_path.exists()
                or (out / "runs").exists()
            ):
                raise ValueError("OUTPUT_EXISTS:use --resume or new output directory")
            dataset = _dataset(config)
            manifest = _manifest(config, dataset, fingerprint, versions)
            _write(dataset_path, dataset)
            _write(manifest_path, manifest)
        scenarios = {}
        for row in dataset["scenarios"]:
            if digest(row["scenario"]) != row["scenario_hash"]:
                raise ValueError("DATASET_CHECKSUM")
            scenarios[row["scenario_hash"]] = row["scenario"]
        records = {}
        for run in manifest["runs"]:
            path = out / "runs" / f"{run['run_key']}.json"
            if path.exists():
                records[run["run_key"]] = _read_checkpoint(path, run)
        start = monotonic()
        try:
            for run in manifest["runs"]:
                key = run["run_key"]
                if key in records:
                    continue
                details = run["identity"]
                scenario = StaffingScenario.model_validate(
                    scenarios[details["scenario_hash"]]
                )
                payload = _run_method(
                    scenario,
                    details["method"],
                    details["time_budget_s"],
                    details["solver_seed"],
                    config,
                )
                SolveResult.model_validate(payload["result"])
                checkpoint = Checkpoint(
                    report_schema_version=2,
                    run_key=key,
                    identity=details,
                    payload=payload,
                    checksum=digest(payload),
                    completed=True,
                )
                _write(out / "runs" / f"{key}.json", checkpoint.model_dump())
                records[key] = payload
                print(
                    f"{len(records)}/{manifest['expected_count']} {key[:12]} {payload['result']['status']} elapsed={monotonic()-start:.2f}s",
                    flush=True,
                )
        except KeyboardInterrupt:
            _summarize(out, manifest, records)
            raise
        report = _summarize(out, manifest, records)
        return 1 if report["errors"] else 0
    finally:
        if lock.exists():
            current = lock.stat()
            if (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino):
                lock.unlink()


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="M2 staffing benchmark with immutable dataset and per-run checkpoints"
    )
    parser.add_argument("--benchmark", action="store_true", required=True)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    try:
        data = yaml.safe_load(args.config.read_text())
        config = BenchmarkConfig.model_validate(data)
        fixture = Path(config.profile.base_fixture)
        if not fixture.is_absolute():
            config.profile.base_fixture = str((args.config.parent / fixture).resolve())
        if args.dry_run:
            print(json.dumps(matrix_summary(config), ensure_ascii=False, indent=2))
            return 0
        return execute(config, args.out, resume=args.resume)
    except KeyboardInterrupt:
        print("Interrupted; completed checkpoints preserved", file=sys.stderr)
        return 130
    except (ValueError, OSError, yaml.YAMLError, subprocess.CalledProcessError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
