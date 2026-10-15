import argparse
import json
import sys
from importlib.metadata import version
from pathlib import Path
from typing import Annotated, Literal

import yaml
from pydantic import Field

from app.optimize.cp_sat import solve_staffing
from app.optimize.reporting import digest, distribution
from app.optimize.scenarios import (
    GENERATOR_VERSION,
    ScenarioProfile,
    generate_scenarios,
)
from app.optimize.staffing import Record


class RunConfig(Record):
    solver: Literal["cp_sat"]
    seed: Annotated[int, Field(strict=True, ge=0, le=2**31 - 1)]
    count: Annotated[int, Field(strict=True, ge=1)]
    time_limit_s: Annotated[float, Field(strict=True, gt=0, allow_inf_nan=False)]
    profile: ScenarioProfile


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if "--benchmark" in argv:
        from app.optimize.benchmark import main as benchmark_main

        return benchmark_main(argv)
    parser = argparse.ArgumentParser(
        description="M1 simulated staffing CP-SAT; no operational dispatch"
    )
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        config_data = yaml.safe_load(args.config.read_text())
        config = RunConfig.model_validate(config_data)
        profile = config.profile.model_dump()
        fixture = Path(profile["base_fixture"])
        if not fixture.is_absolute():
            profile["base_fixture"] = str((args.config.parent / fixture).resolve())
        scenarios = generate_scenarios(profile, config.seed, config.count)
        args.out.mkdir(parents=True, exist_ok=True)
        entries = []
        for scenario in scenarios:
            result = solve_staffing(scenario, config.time_limit_s, config.seed)
            entries.append(
                {
                    "input_hash": digest(scenario.model_dump()),
                    "scenario": scenario.model_dump(),
                    "result": result.model_dump(),
                    "protected_supply": {
                        g.group_id: {
                            "committed_people": g.committed_people,
                            "reserve_people": g.reserve_people,
                            "available_people": g.available_people,
                        }
                        for g in scenario.groups
                    },
                }
            )
        valid = sum(
            e["result"]["status"] in ("OPTIMAL", "FEASIBLE")
            and e["result"]["evaluation"]["feasible"]
            for e in entries
        )
        statuses = {
            status: sum(e["result"]["status"] == status for e in entries)
            for status in [
                "OPTIMAL",
                "FEASIBLE",
                "INFEASIBLE",
                "UNKNOWN",
                "MODEL_INVALID",
                "ERROR",
            ]
        }
        report = {
            "schema_version": "1",
            "data_version": GENERATOR_VERSION,
            "generator_version": GENERATOR_VERSION,
            "simulated": True,
            "policy_verified": False,
            "config": config_data,
            "config_hash": digest(config_data),
            "solver_versions": {
                "ortools": version("ortools"),
                "python": sys.version.split()[0],
                "pydantic": version("pydantic"),
            },
            "runs": entries,
            "metrics": {
                "status_counts": statuses,
                "feasibility_rate": valid / len(entries),
                "runtime_s": distribution(
                    [e["result"]["runtime_s"] for e in entries], len(entries)
                ),
                "first_feasible_s": distribution(
                    [e["result"]["time_to_first_feasible_s"] for e in entries],
                    len(entries),
                ),
            },
        }
        output = args.out / "report.json"
        temporary = output.with_suffix(".json.tmp")
        temporary.write_text(
            json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        )
        temporary.replace(output)
        print(f"{len(entries)} scenario(s); report: {output}")
        return 1 if statuses["ERROR"] or statuses["MODEL_INVALID"] else 0
    except (ValueError, OSError, yaml.YAMLError) as exc:
        print(f"Invalid input or output: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
