import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

from app.optimize.staffing import PhaseSummary, SolveResult
from experiments.exp_017_staffing_mvp import run


def config_file(tmp_path, name="priority_trap"):
    fixture = Path(__file__).parent / "fixtures" / f"{name}.json"
    config = {
        "solver": "cp_sat",
        "seed": 42,
        "count": 1,
        "time_limit_s": 2.0,
        "profile": {
            "base_fixture": str(fixture.resolve()),
            "replicas": 1,
            "demand_percent_choices": [100],
            "budget_percent_choices": [100],
            "available_percent_choices": [100],
            "source_refs": ["D08"],
            "assumption_ids": ["stress-v1"],
        },
    }
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(config))
    return path


def test_report_replay_and_metrics(tmp_path):
    cfg = config_file(tmp_path)
    out = tmp_path / "out"
    assert run.main(["--config", str(cfg), "--out", str(out)]) == 0
    report = json.loads((out / "report.json").read_text())
    assert report["simulated"] and not report["policy_verified"]
    assert (
        len(report["config_hash"]) == 64
        and report["generator_version"] == "fixture-perturbation-v1"
    )
    entry = report["runs"][0]
    assert len(entry["input_hash"]) == 64 and entry["scenario"]["assumption_ids"]
    result = entry["result"]
    assert result["status"] == "OPTIMAL" and result["proven_optimal"]
    assert result["evaluation"]["score"]["weighted_unmet_hours"] == 8
    assert result["evaluation"]["score"]["total_cost_vnd"] == 40
    assert result["seed_search"] is None and len(result["phases"]) == 2
    assert result["phases"][1]["first_feasible_observation"] == "validated_initial"
    assert "estimated_cases_prevented" not in json.dumps(report)
    for field in [
        "runtime_s",
        "time_to_first_feasible_s",
        "deadline_exceeded",
        "first_feasible_observation",
        "error_code",
    ]:
        assert field in result
    assert report["metrics"]["feasibility_rate"] == 1.0


def test_infeasible_report(tmp_path):
    cfg = config_file(tmp_path, "infeasible_floor")
    out = tmp_path / "out"
    assert run.main(["--config", str(cfg), "--out", str(out)]) == 0
    result = json.loads((out / "report.json").read_text())["runs"][0]["result"]
    assert result["status"] == "INFEASIBLE" and result["allocations"] is None


@pytest.mark.parametrize(
    "field,value",
    [
        ("solver", "scip"),
        ("time_limit_s", 0),
        ("count", True),
        ("seed", -1),
        ("extra", 1),
    ],
)
def test_invalid_config_exit(tmp_path, field, value):
    cfg = config_file(tmp_path)
    data = yaml.safe_load(cfg.read_text())
    data[field] = value
    cfg.write_text(yaml.safe_dump(data))
    assert run.main(["--config", str(cfg), "--out", str(tmp_path / "out")]) != 0


@pytest.mark.parametrize(
    "status,code,expected",
    [
        ("ERROR", "PHASE2_INFEASIBLE_AFTER_VALID_INCUMBENT", 1),
        ("MODEL_INVALID", "MODEL_VALIDATION_FAILED", 1),
        ("UNKNOWN", None, 0),
    ],
)
def test_error_and_unknown_exit_with_report(
    tmp_path, monkeypatch, status, code, expected
):
    cfg = config_file(tmp_path)
    out = tmp_path / "out"
    result = SolveResult(
        solver_name="cp_sat",
        status=status,
        phases=[PhaseSummary(objective_name="weighted_unmet_hours")],
        runtime_s=0.1,
        time_limit_s=1.0,
        deadline_exceeded=False,
        time_to_first_feasible_s=None,
        first_feasible_observation="none",
        seed=42,
        error_code=code,
    )
    monkeypatch.setattr(run, "solve_staffing", lambda *args: result)
    assert run.main(["--config", str(cfg), "--out", str(out)]) == expected
    report = json.loads((out / "report.json").read_text())
    assert report["runs"][0]["result"]["error_code"] == code
    assert report["metrics"]["first_feasible_s"]["observed"] == 0
    assert report["metrics"]["first_feasible_s"]["missing"] == 1
    assert report["metrics"]["first_feasible_s"]["p50"] is None


def test_module_cli(tmp_path):
    cfg = config_file(tmp_path)
    out = tmp_path / "out"
    cwd = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "experiments.exp_017_staffing_mvp.run",
            "--config",
            str(cfg),
            "--out",
            str(out),
        ],
        cwd=cwd,
        env={**os.environ, "PYTHONPATH": "."},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert (out / "report.json").is_file()
