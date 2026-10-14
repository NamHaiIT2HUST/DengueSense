import math
from types import SimpleNamespace

import pytest
from ortools.sat.python import cp_model

from app.optimize import cp_sat
from app.optimize.evaluate import evaluate_allocation


@pytest.mark.parametrize(
    "name,health,cost",
    [
        ("priority_trap", 8, 40),
        ("cost_tie", 0, 10),
        ("zero_cost", 0, 0),
        ("locked_exact", 48, 30),
        ("locked_expensive", 0, 20),
    ],
)
def test_cp_sat_lexicographic(case, name, health, cost):
    result = cp_sat.solve_staffing(case(name), 5.0, 42)
    assert result.status == "OPTIMAL" and result.proven_optimal
    assert result.evaluation.feasible
    assert (
        result.evaluation.score.weighted_unmet_hours,
        result.evaluation.score.total_cost_vnd,
    ) == (health, cost)
    assert len(result.phases) == 2 and all(p.proven_optimal for p in result.phases)
    assert result.runtime_s >= 0


def test_infeasible_and_locks(case):
    assert (
        cp_sat.solve_staffing(case("infeasible_floor"), 5.0, 42).status == "INFEASIBLE"
    )
    s = case("locked_expensive")
    s.budget_vnd = 10
    result = cp_sat.solve_staffing(s, 5.0, 42)
    assert result.status == "INFEASIBLE" and result.allocations is None
    s = case("locked_exact")
    s.locked_allocations[0].people = 0
    result = cp_sat.solve_staffing(s, 5.0, 42)
    assert all(a.need_id != "N1" or a.people == 0 for a in result.allocations)


def test_seed_is_only_feasible(case):
    result = cp_sat.find_feasible_seed(case("priority_trap"), 5.0, 42)
    assert result.status == "FEASIBLE" and not result.proven_optimal
    assert evaluate_allocation(case("priority_trap"), result.allocations).feasible
    assert result.seed_search.source == "cp_sat_feasibility"
    assert not any(p.proven_optimal for p in result.phases)


@pytest.mark.parametrize("limit", [0, -1, math.nan, math.inf, True])
def test_bad_time_limit(case, limit):
    with pytest.raises(ValueError, match="time_limit"):
        cp_sat.solve_staffing(case("priority_trap"), limit, 42)


class Clock:
    now = 0.0

    def __call__(self):
        return self.now


def scripted(monkeypatch, entries):
    clock = Clock()
    monkeypatch.setattr(cp_sat, "monotonic", clock)
    instances = []

    class Solver:
        def __init__(self):
            self.entry = entries[len(instances)]
            self.parameters = SimpleNamespace(
                absolute_gap_limit=0.0, relative_gap_limit=0.0
            )
            instances.append(self)

        def solve(self, model, callback):
            clock.now += self.entry.get("duration", 0.1)
            if self.entry.get("callback"):
                callback.value = self.value
                callback.on_solution_callback()
            if self.entry.get("gap"):
                self.parameters.relative_gap_limit = 0.1
            if self.entry.get("exception"):
                raise RuntimeError("fake backend failure")
            return self.entry["status"]

        def value(self, var):
            return self.entry.get("people", [2, 0])[var.index]

        @property
        def objective_value(self):
            return self.entry.get("objective", 8 if len(instances) == 1 else 40)

        @property
        def best_objective_bound(self):
            return self.entry.get("bound", float(self.objective_value))

        def status_name(self, status):
            return status.name

    monkeypatch.setattr(cp_sat.cp_model, "CpSolver", Solver)
    return clock, instances


@pytest.mark.parametrize(
    "first,second,want,proof",
    [
        (cp_model.OPTIMAL, cp_model.OPTIMAL, "OPTIMAL", True),
        (cp_model.FEASIBLE, cp_model.OPTIMAL, "FEASIBLE", False),
        (cp_model.FEASIBLE, cp_model.FEASIBLE, "FEASIBLE", False),
        (cp_model.OPTIMAL, cp_model.FEASIBLE, "FEASIBLE", False),
        (cp_model.OPTIMAL, cp_model.UNKNOWN, "FEASIBLE", False),
        (cp_model.OPTIMAL, cp_model.INFEASIBLE, "ERROR", False),
        (cp_model.OPTIMAL, cp_model.MODEL_INVALID, "MODEL_INVALID", False),
    ],
)
def test_status_table(case, monkeypatch, first, second, want, proof):
    scripted(
        monkeypatch,
        [{"status": first, "objective": 8}, {"status": second, "objective": 40}],
    )
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert result.status == want and result.proven_optimal == proof
    assert result.allocations is not None and result.evaluation.feasible
    if second == cp_model.INFEASIBLE:
        assert result.error_code == "PHASE2_INFEASIBLE_AFTER_VALID_INCUMBENT"


@pytest.mark.parametrize(
    "status,want",
    [
        (cp_model.UNKNOWN, "UNKNOWN"),
        (cp_model.INFEASIBLE, "INFEASIBLE"),
        (cp_model.MODEL_INVALID, "MODEL_INVALID"),
    ],
)
def test_no_incumbent(case, monkeypatch, status, want):
    _, instances = scripted(monkeypatch, [{"status": status}])
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert result.status == want and result.allocations is None
    assert result.phases[1].status == "NOT_RUN" and len(instances) == 1


def test_timeout_preserves_callback_incumbent(case, monkeypatch):
    _, instances = scripted(
        monkeypatch, [{"status": cp_model.UNKNOWN, "callback": True, "duration": 1.1}]
    )
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert result.status == "FEASIBLE" and result.evaluation.feasible
    assert (
        result.first_feasible_observation == "callback"
        and result.time_to_first_feasible_s == 1.1
    )
    assert result.deadline_exceeded and result.phases[1].status == "NOT_RUN"
    assert result.phases[0].objective_value == 8
    assert result.phases[1].runtime_s == 0 and len(instances) == 1


def test_final_only_and_remaining_budget(case, monkeypatch):
    _, instances = scripted(
        monkeypatch,
        [
            {"status": cp_model.OPTIMAL, "objective": 8, "duration": 0.3},
            {"status": cp_model.UNKNOWN, "duration": 0.2},
        ],
    )
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert (
        result.time_to_first_feasible_s is None
        and result.first_feasible_observation == "final_only"
    )
    assert result.phases[1].first_feasible_observation == "validated_initial"
    assert result.phases[1].time_to_first_feasible_s == 0
    assert instances[1].parameters.max_time_in_seconds == pytest.approx(0.7)
    assert result.runtime_s == pytest.approx(0.5)


@pytest.mark.parametrize(
    "entry,code",
    [
        ({"status": cp_model.OPTIMAL, "objective": 41}, "OBJECTIVE_MISMATCH"),
        (
            {"status": cp_model.OPTIMAL, "objective": 40, "bound": 42.0},
            "BOUND_INCONSISTENT",
        ),
        (
            {"status": cp_model.FEASIBLE, "people": [1, 1], "objective": 30},
            "HEALTH_CHANGED",
        ),
        ({"status": cp_model.FEASIBLE, "people": [3, 0]}, "INVALID_ALLOCATION"),
        ({"status": cp_model.UNKNOWN, "exception": True}, "BACKEND_ERROR"),
    ],
)
def test_phase2_errors_preserve_last_valid(case, monkeypatch, entry, code):
    scripted(monkeypatch, [{"status": cp_model.OPTIMAL, "objective": 8}, entry])
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert result.status == "ERROR" and result.error_code == code
    assert result.evaluation.score.total_cost_vnd == 40 and not result.proven_optimal
    assert result.phases[1].objective_value == 40


def test_nonzero_gap_does_not_create_proof(case, monkeypatch):
    scripted(
        monkeypatch,
        [
            {"status": cp_model.OPTIMAL, "objective": 8, "gap": True},
            {"status": cp_model.OPTIMAL, "objective": 40},
        ],
    )
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert result.status == "FEASIBLE" and not result.proven_optimal
    assert result.phases[0].proof_basis == "none"


def test_callback_infeasible_is_error(case, monkeypatch):
    scripted(monkeypatch, [{"status": cp_model.INFEASIBLE, "callback": True}])
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert result.status == "ERROR" and result.allocations is not None


def test_bad_scenario_does_not_call_solver(case, monkeypatch):
    s = case("priority_trap")
    s.groups[0].total_people = 0
    _, instances = scripted(monkeypatch, [])
    with pytest.raises(ValueError, match="PROTECTION"):
        cp_sat.solve_staffing(s, 1.0, 42)
    assert not instances


def test_objective_error_does_not_replace_incumbent(case, monkeypatch):
    scripted(
        monkeypatch,
        [
            {"status": cp_model.OPTIMAL, "people": [1, 0], "objective": 0},
            {"status": cp_model.OPTIMAL, "people": [0, 1], "objective": 11},
        ],
    )
    result = cp_sat.solve_staffing(case("cost_tie"), 1.0, 42)
    assert result.status == "ERROR" and result.error_code == "OBJECTIVE_MISMATCH"
    assert result.evaluation.score.total_cost_vnd == 20


def test_model_validation_before_backend(case, monkeypatch):
    monkeypatch.setattr(
        cp_sat.cp_model.CpModel, "validate", lambda self: "invalid model for test"
    )
    _, instances = scripted(monkeypatch, [])
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert (
        result.status == "MODEL_INVALID"
        and result.error_code == "MODEL_VALIDATION_FAILED"
    )
    assert result.allocations is None and not instances


def test_phase1_backend_error(case, monkeypatch):
    scripted(monkeypatch, [{"status": cp_model.UNKNOWN, "exception": True}])
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert result.status == "ERROR" and result.error_code == "BACKEND_ERROR"
    assert result.phases[1].status == "NOT_RUN"


def test_phase2_deadline_not_run(case, monkeypatch):
    _, instances = scripted(
        monkeypatch, [{"status": cp_model.OPTIMAL, "duration": 1.0}]
    )
    result = cp_sat.solve_staffing(case("priority_trap"), 1.0, 42)
    assert result.status == "FEASIBLE" and not result.proven_optimal
    assert result.phases[1].status == "NOT_RUN" and len(instances) == 1


def test_seed_callback_timing_and_infeasible(case, monkeypatch):
    scripted(
        monkeypatch, [{"status": cp_model.OPTIMAL, "callback": True, "duration": 0.2}]
    )
    result = cp_sat.find_feasible_seed(case("priority_trap"), 1.0, 42)
    assert result.seed_search.runtime_s == 0.2
    assert result.seed_search.time_to_first_feasible_s == 0.2
    assert result.seed_search.first_feasible_observation == "callback"
    assert result.status == "FEASIBLE" and not result.proven_optimal


def test_actual_multiskill_pool_not_duplicated(case):
    s = case("priority_trap")
    s.groups[0].skills.append("clinical")
    s.needs[1].role_id = "clinical"
    result = cp_sat.solve_staffing(s, 5.0, 42)
    assert result.proven_optimal
    assert sum(a.people for a in result.allocations if a.group_id == "G1") <= 2


def test_zero_demand(case):
    s = case("zero_cost")
    s.needs[0].demand_hours = 0
    result = cp_sat.solve_staffing(s, 5.0, 42)
    assert result.proven_optimal and result.evaluation.score.weighted_unmet_hours == 0
