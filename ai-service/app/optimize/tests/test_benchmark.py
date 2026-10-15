import json
from pathlib import Path

import pytest

from app.optimize import benchmark
from app.optimize.evaluate import evaluate_allocation
from app.optimize.staffing import (
    Allocation,
    PhaseSummary,
    SeedSearchSummary,
    SolveResult,
)


@pytest.fixture
def config(milp_settings):
    return benchmark.BenchmarkConfig(
        report_schema_version=2,
        data_seed=20261014,
        order_seed=20261015,
        count_per_size=1,
        replicas=[1],
        methods=["cp_sat", "scip", "sa", "tabu"],
        solver_seeds=[42],
        time_budgets_s=[1.0],
        seed_search_fraction=0.2,
        profile={
            "base_fixture": str(
                Path(__file__).resolve().parents[3]
                / "tests/test_optimize/fixtures/priority_trap.json"
            ),
            "replicas": 1,
            "demand_percent_choices": [100],
            "budget_percent_choices": [100],
            "available_percent_choices": [100],
            "source_refs": ["D08"],
            "assumption_ids": ["stress-v1"],
        },
        milp=milp_settings,
        heuristic={
            "health_fraction": 0.7,
            "initial_temperature_fraction": 0.1,
            "min_temperature": 1.0,
            "cooling_rate": 0.995,
            "candidate_batch_size": 64,
            "tabu_tenure": 7,
            "diversify_after": 50,
        },
    )


def fake_result(seed=42, status="UNKNOWN"):
    return SolveResult(
        solver_name="cp_sat",
        status=status,
        phases=[PhaseSummary(objective_name="weighted_unmet_hours")],
        runtime_s=0.1,
        time_limit_s=1.0,
        deadline_exceeded=False,
        time_to_first_feasible_s=None,
        first_feasible_observation="none",
        seed=seed,
    )


def test_matrix_budget_and_duplicate_validation(config):
    full = config.model_copy(
        update={
            "replicas": [1, 5, 20],
            "solver_seeds": list(range(42, 52)),
            "time_budgets_s": [1.0, 10.0, 30.0],
        }
    )
    assert benchmark.matrix_summary(full)["run_count"] == 360
    assert benchmark.matrix_summary(full)["total_budget_s"] == 4920
    data = config.model_dump()
    data["methods"] = ["sa", "sa"]
    with pytest.raises(ValueError):
        benchmark.BenchmarkConfig.model_validate(data)


def test_checkpoint_interrupt_resume_only_pending(config, tmp_path, monkeypatch):
    calls = []
    original = benchmark._run_method

    def interrupted(*args):
        calls.append(args[1])
        if len(calls) == 3:
            raise KeyboardInterrupt
        return {
            "result": fake_result().model_dump(),
            "initial_score": None,
            "final_score": None,
        }

    monkeypatch.setattr(benchmark, "_run_method", interrupted)
    with pytest.raises(KeyboardInterrupt):
        benchmark.execute(config, tmp_path, resume=False)
    assert len(list((tmp_path / "runs").glob("*.json"))) == 2
    assert not (tmp_path / ".runner.lock").exists()
    calls.clear()
    monkeypatch.setattr(
        benchmark,
        "_run_method",
        lambda *args: calls.append(args[1])
        or {
            "result": fake_result().model_dump(),
            "initial_score": None,
            "final_score": None,
        },
    )
    assert benchmark.execute(config, tmp_path, resume=True) == 0
    assert len(calls) == 2
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["completed"] == 4 and report["pending"] == 0
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert len({r["scenario_hash"] for r in manifest["runs"]}) == 1
    assert manifest["expected_count"] == 4
    monkeypatch.setattr(benchmark, "_run_method", original)


def test_error_is_checkpointed_and_not_retried(config, tmp_path, monkeypatch):
    monkeypatch.setattr(
        benchmark,
        "_run_method",
        lambda *args: {"result": fake_result(status="ERROR").model_dump()},
    )
    assert benchmark.execute(config, tmp_path, resume=False) == 1
    monkeypatch.setattr(
        benchmark,
        "_run_method",
        lambda *args: pytest.fail("completed error must not retry"),
    )
    assert benchmark.execute(config, tmp_path, resume=True) == 1


def test_corrupted_record_and_changed_identity_fail(config, tmp_path, monkeypatch):
    monkeypatch.setattr(
        benchmark, "_run_method", lambda *args: {"result": fake_result().model_dump()}
    )
    benchmark.execute(config, tmp_path, resume=False)
    with pytest.raises(ValueError, match="IDENTITY"):
        benchmark.execute(
            config.model_copy(update={"order_seed": 0}), tmp_path, resume=True
        )
    path = next((tmp_path / "runs").glob("*.json"))
    data = json.loads(path.read_text())
    data["checksum"] = "bad"
    path.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="CHECKSUM"):
        benchmark.execute(config, tmp_path, resume=True)


def test_existing_lock_preserved(config, tmp_path):
    lock = tmp_path / ".runner.lock"
    lock.write_text("existing owner")
    with pytest.raises(ValueError, match="LOCK"):
        benchmark.execute(config, tmp_path, resume=False)
    assert lock.read_text() == "existing owner"


def test_dry_run_does_not_solve(config, tmp_path, monkeypatch):
    import yaml

    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(config.model_dump()))
    monkeypatch.setattr(
        benchmark,
        "execute",
        lambda *args, **kwargs: pytest.fail("dry-run must not execute"),
    )
    assert (
        benchmark.main(
            [
                "--benchmark",
                "--dry-run",
                "--config",
                str(path),
                "--out",
                str(tmp_path / "output"),
            ]
        )
        == 0
    )
    assert not (tmp_path / "output").exists()


def test_expired_after_seed_keeps_valid_seed(config, case, monkeypatch):
    scenario = case("cost_tie")
    rows = [Allocation(group_id="G1", need_id="N1", people=1)]
    seeded = fake_result(status="FEASIBLE")
    seeded.allocations = rows
    seeded.evaluation = evaluate_allocation(scenario, rows)
    seeded.solver_metadata = {"first_feasible_at_s": 0.03}
    seeded.time_to_first_feasible_s = 0.03
    seeded.first_feasible_observation = "callback"
    seeded.seed_search = SeedSearchSummary(
        source="cp_sat_feasibility",
        status="FEASIBLE",
        runtime_s=0.2,
        time_to_first_feasible_s=0.03,
        first_feasible_observation="callback",
    )
    clock = iter([0.0, 0.01, 0.3, 0.4])
    caps = []
    monkeypatch.setattr(benchmark, "monotonic", lambda: next(clock))
    monkeypatch.setattr(
        benchmark.cp_sat,
        "find_feasible_seed",
        lambda s, cap, seed: caps.append(cap) or seeded,
    )
    monkeypatch.setattr(
        benchmark.heuristics,
        "improve_sa",
        lambda *args, **kwargs: pytest.fail("no remaining budget"),
    )
    payload = benchmark._run_method(scenario, "sa", 0.2, 42, config)
    assert caps == [pytest.approx(0.04)]
    assert payload["result"]["status"] == "FEASIBLE" and payload["search_steps"] == 0
    assert payload["initial_score"] == payload["final_score"]
    assert payload["cost_improvement"] == 0 and payload["result"]["deadline_exceeded"]
    assert payload["result"]["time_to_first_feasible_s"] == 0.03


def test_cost_improvement_report(config, case, monkeypatch):
    scenario = case("cost_tie")
    rows = [Allocation(group_id="G1", need_id="N1", people=1)]
    seeded = fake_result(status="FEASIBLE")
    seeded.allocations = rows
    seeded.evaluation = evaluate_allocation(scenario, rows)
    monkeypatch.setattr(benchmark.cp_sat, "find_feasible_seed", lambda *args: seeded)
    original = benchmark.heuristics.improve_sa
    monkeypatch.setattr(
        benchmark.heuristics,
        "improve_sa",
        lambda s, initial, time, seed, settings: original(
            s, initial, None, seed, settings=settings, max_steps=200
        ),
    )
    p = benchmark._run_method(scenario, "sa", 1.0, 42, config)
    assert p["health_improvement"] == 0 and p["cost_improvement"] == 10
    assert p["initial_allocations_hash"] and p["search_steps"] <= 200


@pytest.mark.parametrize("method", ["sa", "tabu"])
def test_search_error_keeps_validated_seed(config, case, monkeypatch, method):
    scenario = case("cost_tie")
    seeded = fake_result(status="FEASIBLE")
    seeded.allocations = [Allocation(group_id="G1", need_id="N1", people=1)]
    seeded.evaluation = evaluate_allocation(scenario, seeded.allocations)
    seeded.first_feasible_observation = "callback"
    seeded.solver_metadata = {"first_feasible_at_s": 0.03}
    seeded.seed_search = SeedSearchSummary(
        source="cp_sat_feasibility",
        status="FEASIBLE",
        runtime_s=0.1,
        time_to_first_feasible_s=0.03,
        first_feasible_observation="callback",
    )
    clock = iter([0.0, 0.01, 0.1, 0.2])
    monkeypatch.setattr(benchmark, "monotonic", lambda: next(clock))
    monkeypatch.setattr(benchmark.cp_sat, "find_feasible_seed", lambda *args: seeded)

    def fail(*args, **kwargs):
        raise RuntimeError("search failed")

    monkeypatch.setattr(benchmark.heuristics, "improve_" + method, fail)
    payload = benchmark._run_method(scenario, method, 1.0, 42, config)
    result = payload["result"]
    assert result["status"] == "ERROR" and not result["proven_optimal"]
    assert result["allocations"] == [a.model_dump() for a in seeded.allocations]
    assert result["evaluation"]["feasible"]
    assert result["seed_search"] == seeded.seed_search.model_dump()
    assert result["first_feasible_observation"] == "callback"
    assert result["time_to_first_feasible_s"] == 0.03


def test_resume_ignores_tmp_and_does_not_regenerate(config, tmp_path, monkeypatch):
    monkeypatch.setattr(
        benchmark, "_run_method", lambda *args: {"result": fake_result().model_dump()}
    )
    benchmark.execute(config, tmp_path, resume=False)
    one = next((tmp_path / "runs").glob("*.json"))
    one.unlink()
    one.with_suffix(".json.tmp").write_text("partial")
    calls = []
    monkeypatch.setattr(
        benchmark, "_dataset", lambda *args: pytest.fail("resume must read frozen data")
    )
    monkeypatch.setattr(
        benchmark,
        "_run_method",
        lambda *args: calls.append(args[1]) or {"result": fake_result().model_dump()},
    )
    assert benchmark.execute(config, tmp_path, resume=True) == 0 and len(calls) == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("solver_seeds", [True]),
        ("time_budgets_s", [float("nan")]),
        ("replicas", [0]),
        ("seed_search_fraction", 1.0),
        ("methods", []),
    ],
)
def test_invalid_matrix(config, field, value):
    data = config.model_dump()
    data[field] = value
    with pytest.raises(ValueError):
        benchmark.BenchmarkConfig.model_validate(data)
