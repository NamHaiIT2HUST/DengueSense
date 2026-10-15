import math

import pytest
from ortools.linear_solver import pywraplp

from app.optimize import milp
from tests.test_optimize.test_oracle import oracle


@pytest.mark.parametrize(
    "name",
    [
        "priority_trap",
        "cost_tie",
        "zero_cost",
        "locked_expensive",
        "locked_exact",
        "infeasible_floor",
    ],
)
def test_milp_matches_oracle(case, milp_settings, name):
    scenario = case(name)
    expected = oracle(scenario)
    result = milp.solve_staffing(scenario, 3.0, 42, settings=milp_settings)
    if expected is None:
        assert result.status == "INFEASIBLE" and result.allocations is None
    else:
        assert result.status == "FEASIBLE", result.model_dump()
        assert (
            result.evaluation.score.weighted_unmet_hours,
            result.evaluation.score.total_cost_vnd,
        ) == expected
        assert not result.proven_optimal and all(
            not p.proven_optimal for p in result.phases
        )
        assert result.time_to_first_feasible_s is None
        assert result.first_feasible_observation == "final_only"
        assert result.solver_metadata["accepted_parameters"]
        assert "SCIP" in result.solver_metadata["backend_version"]


@pytest.mark.parametrize("people,shortage", [(0, 8), (1, 0), (2, 0)])
@pytest.mark.parametrize("priority", [0, 1])
def test_shortfall_exact_under_cost_objective(case, people, shortage, priority):
    s = case("shortfall_exact")
    s.groups[0].total_people = 2
    s.needs[0].max_people = 2
    s.needs[0].priority = priority
    solver, cells, unmet, _binary, _health, cost = milp._build_model(s)
    solver.Add(cells["G1", "N1"] == people)
    solver.Minimize(cost)
    assert solver.Solve() == pywraplp.Solver.OPTIMAL
    assert unmet["N1"].solution_value() == shortage


def test_health_lock_cannot_fake_shortfall(case):
    s = case("zero_cost")
    s.groups[0].total_people = 2
    s.needs[0].max_people = 2
    solver, cells, _, _, health, cost = milp._build_model(s)
    solver.Add(health == 8)
    solver.Add(cells["G1", "N1"] == 1)
    solver.Minimize(cost)
    assert solver.Solve() == pywraplp.Solver.INFEASIBLE


def test_missing_backend(case, milp_settings, monkeypatch):
    monkeypatch.setattr(milp.pywraplp.Solver, "CreateSolver", lambda name: None)
    r = milp.solve_staffing(case("priority_trap"), 1.0, 42, settings=milp_settings)
    assert r.status == "ERROR" and r.error_code == "BACKEND_CONFIGURATION"


@pytest.mark.parametrize("value", [math.nan, math.inf, 0.0, 0.5, True])
def test_settings_validation(milp_settings, value):
    data = milp_settings.model_dump()
    data["integrality_tolerance"] = value
    with pytest.raises(ValueError):
        type(milp_settings).model_validate(data)


def test_milp_envelope_rejects_oversized_rows(case):
    s = case("zero_cost")
    s.arcs = []
    s.needs[0].demand_hours = 2**53 - 1
    with pytest.raises(ValueError, match="MILP_ENVELOPE"):
        milp._build_model(s)


@pytest.mark.parametrize(
    "raw,expected",
    [
        (pywraplp.Solver.NOT_SOLVED, "UNKNOWN"),
        (pywraplp.Solver.INFEASIBLE, "INFEASIBLE"),
        (pywraplp.Solver.MODEL_INVALID, "MODEL_INVALID"),
        (pywraplp.Solver.UNBOUNDED, "ERROR"),
        (pywraplp.Solver.ABNORMAL, "ERROR"),
    ],
)
def test_no_incumbent_status(case, milp_settings, monkeypatch, raw, expected):
    original = milp.pywraplp.Solver.CreateSolver

    class Backend:
        def __init__(self):
            self.inner = original("SCIP")

        def __getattr__(self, name):
            return getattr(self.inner, name)

        def Solve(self):
            return raw

    monkeypatch.setattr(milp.pywraplp.Solver, "CreateSolver", lambda name: Backend())
    r = milp.solve_staffing(case("priority_trap"), 1.0, 42, settings=milp_settings)
    assert r.status == expected and r.allocations is None
    assert r.phases[1].status == "NOT_RUN"


@pytest.mark.parametrize(
    "raw,expected",
    [
        (pywraplp.Solver.OPTIMAL, "FEASIBLE"),
        (pywraplp.Solver.FEASIBLE, "FEASIBLE"),
        (pywraplp.Solver.NOT_SOLVED, "FEASIBLE"),
        (pywraplp.Solver.INFEASIBLE, "ERROR"),
        (pywraplp.Solver.MODEL_INVALID, "MODEL_INVALID"),
        (pywraplp.Solver.UNBOUNDED, "ERROR"),
        (pywraplp.Solver.ABNORMAL, "ERROR"),
    ],
)
def test_phase2_status_retains_incumbent(
    case, milp_settings, monkeypatch, raw, expected
):
    original = milp.pywraplp.Solver.CreateSolver

    class Backend:
        def __init__(self):
            self.inner = original("SCIP")
            self.calls = 0

        def __getattr__(self, name):
            return getattr(self.inner, name)

        def Solve(self):
            self.calls += 1
            actual = self.inner.Solve()
            return actual if self.calls == 1 else raw

    monkeypatch.setattr(milp.pywraplp.Solver, "CreateSolver", lambda name: Backend())
    r = milp.solve_staffing(case("priority_trap"), 1.0, 42, settings=milp_settings)
    assert r.status == expected and r.evaluation.score.total_cost_vnd == 40
    assert r.phases[1].objective_value == 40 and not r.proven_optimal


@pytest.mark.parametrize(
    "value,accepted",
    [
        (1 + 0.5e-6, True),
        (1 + 2e-6, False),
        (math.nan, False),
        (math.inf, False),
        (3.0, False),
    ],
)
def test_numerical_values_before_round(
    case, milp_settings, monkeypatch, value, accepted
):
    s = case("zero_cost")
    s.groups[0].hours_per_person = 0
    s.groups[0].total_people = 2
    s.needs[0].max_people = 2
    s.needs[0].demand_hours = 0
    solver, cells, unmet, _, health, _ = milp._build_model(s)
    solver.Add(cells["G1", "N1"] == 1)
    solver.Minimize(health)
    assert solver.Solve() == pywraplp.Solver.OPTIMAL
    original = pywraplp.Variable.solution_value
    monkeypatch.setattr(
        pywraplp.Variable,
        "solution_value",
        lambda self: value if self.name() == "G1:N1" else original(self),
    )
    if accepted:
        rows, evaluation = milp._read_solution(
            s, solver, cells, unmet, milp_settings, 0, None
        )
        assert rows[0].people == 1 and evaluation.feasible
    else:
        with pytest.raises(ValueError):
            milp._read_solution(s, solver, cells, unmet, milp_settings, 0, None)


def test_backend_settings_rejection(case, milp_settings, monkeypatch):
    monkeypatch.setattr(
        pywraplp.Solver, "SetSolverSpecificParametersAsString", lambda self, text: False
    )
    r = milp.solve_staffing(case("priority_trap"), 1.0, 42, settings=milp_settings)
    assert r.status == "ERROR" and r.error_code == "BACKEND_CONFIGURATION"


def test_numerical_failure_retains_previous(case, milp_settings, monkeypatch):
    original = milp._read_solution

    def read(*args):
        if args[5] == 1:
            raise ValueError("invalid raw u")
        return original(*args)

    monkeypatch.setattr(milp, "_read_solution", read)
    r = milp.solve_staffing(case("priority_trap"), 1.0, 42, settings=milp_settings)
    assert r.status == "ERROR" and r.error_code == "NUMERICAL_VALIDATION"
    assert r.evaluation.feasible and r.evaluation.score.total_cost_vnd == 40


def test_thread_boolean_rejected(milp_settings):
    data = milp_settings.model_dump()
    data["threads"] = True
    with pytest.raises(ValueError):
        type(milp_settings).model_validate(data)


@pytest.mark.parametrize("variable", ["u:N1", "z:N1"])
@pytest.mark.parametrize("value", [math.nan, math.inf, 0.5, -1.0])
def test_raw_shortfall_and_binary_rejected(
    case, milp_settings, monkeypatch, variable, value
):
    s = case("zero_cost")
    solver, cells, unmet, _, health, _ = milp._build_model(s)
    solver.Minimize(health)
    assert solver.Solve() == pywraplp.Solver.OPTIMAL
    original = pywraplp.Variable.solution_value
    monkeypatch.setattr(
        pywraplp.Variable,
        "solution_value",
        lambda self: value if self.name() == variable else original(self),
    )
    with pytest.raises(ValueError):
        milp._read_solution(s, solver, cells, unmet, milp_settings, 0, None)


def test_raw_row_residual_before_rounding(case, milp_settings, monkeypatch):
    s = case("zero_cost")
    solver, cells, unmet, _, health, _ = milp._build_model(s)
    solver.Add(cells["G1", "N1"] == 1)
    solver.Minimize(health)
    assert solver.Solve() == pywraplp.Solver.OPTIMAL
    original = pywraplp.Variable.solution_value
    monkeypatch.setattr(
        pywraplp.Variable,
        "solution_value",
        lambda self: 1 - 0.5e-6 if self.name() == "G1:N1" else original(self),
    )
    with pytest.raises(ValueError, match="row residual"):
        milp._read_solution(s, solver, cells, unmet, milp_settings, 0, None)


@pytest.mark.parametrize("value", [math.nan, math.inf, 2e-6])
def test_raw_objective_residual(case, milp_settings, monkeypatch, value):
    s = case("zero_cost")
    solver, cells, unmet, _, health, _ = milp._build_model(s)
    solver.Minimize(health)
    assert solver.Solve() == pywraplp.Solver.OPTIMAL
    monkeypatch.setattr(pywraplp.Objective, "Value", lambda self: value)
    with pytest.raises(ValueError, match="objective residual"):
        milp._read_solution(s, solver, cells, unmet, milp_settings, 0, None)


@pytest.mark.parametrize("fault", ["u", "z", "objective"])
def test_phase2_raw_fault_retains_incumbent(case, milp_settings, monkeypatch, fault):
    calls = 0
    solve = pywraplp.Solver.Solve
    value = pywraplp.Variable.solution_value
    objective = pywraplp.Objective.Value

    def solve_counted(self):
        nonlocal calls
        calls += 1
        return solve(self)

    monkeypatch.setattr(pywraplp.Solver, "Solve", solve_counted)
    monkeypatch.setattr(
        pywraplp.Variable,
        "solution_value",
        lambda self: (
            math.nan if calls == 2 and self.name() == f"{fault}:N1" else value(self)
        ),
    )
    monkeypatch.setattr(
        pywraplp.Objective,
        "Value",
        lambda self: (
            objective(self) + 2e-6
            if calls == 2 and fault == "objective"
            else objective(self)
        ),
    )
    result = milp.solve_staffing(case("priority_trap"), 1.0, 42, settings=milp_settings)
    assert result.status == "ERROR" and result.error_code == "NUMERICAL_VALIDATION"
    assert result.evaluation.feasible and result.evaluation.score.total_cost_vnd == 40
    assert not result.proven_optimal


def test_solver_rejects_unsupported_envelope(case, milp_settings):
    s = case("zero_cost")
    s.arcs = []
    s.needs[0].demand_hours = 2**53 - 1
    with pytest.raises(ValueError, match="MILP_ENVELOPE"):
        milp.solve_staffing(s, 1.0, 42, settings=milp_settings)
