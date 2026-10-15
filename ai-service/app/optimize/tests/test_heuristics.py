import itertools

import pytest

from app.optimize import heuristics
from app.optimize.settings import HeuristicSettings
from app.optimize.staffing import Allocation


@pytest.fixture
def settings():
    return HeuristicSettings(
        health_fraction=0.7,
        initial_temperature_fraction=0.1,
        min_temperature=1.0,
        cooling_rate=0.995,
        candidate_batch_size=64,
        tabu_tenure=7,
        diversify_after=50,
    )


@pytest.mark.parametrize("method", ["sa", "tabu"])
def test_improves_and_repeats_seed(case, settings, method):
    s = case("improve_seed")
    initial = [Allocation(group_id="G1", need_id="N1", people=1)]
    solve = getattr(heuristics, "improve_" + method)
    a = solve(s, initial, None, 42, settings=settings, max_steps=200)
    b = solve(s, initial, None, 42, settings=settings, max_steps=200)
    assert (
        a.evaluation.score.weighted_unmet_hours,
        a.evaluation.score.total_cost_vnd,
    ) == (0, 10)
    assert a.allocations == b.allocations and a.search_steps == b.search_steps
    assert not a.proven_optimal and a.time_limit_s is None and not a.deadline_exceeded
    assert a.search_steps <= 200 and a.evaluation.feasible


def test_inverse_and_atomic_swap(case, settings):
    s = case("cost_tie")
    s.groups[0].total_people = 1
    s.groups[1].total_people = 1
    s.needs[0].min_people = 1
    n = s.needs[0].model_copy(deep=True)
    n.need_id = "N2"
    n.site_id = "S2"
    s.needs.append(n)
    for a in s.arcs:
        a.cost_vnd = 10 if a.group_id == "G1" else 1
    s.arcs.extend(
        [
            type(s.arcs[0])(group_id="G1", need_id="N2", cost_vnd=1),
            type(s.arcs[0])(group_id="G2", need_id="N2", cost_vnd=10),
        ]
    )
    initial = [
        Allocation(group_id="G1", need_id="N1", people=1),
        Allocation(group_id="G2", need_id="N2", people=1),
    ]
    moves = heuristics._moves(s, {(a.group_id, a.need_id): a.people for a in initial})
    swaps = [m for m in moves if len(m) == 4]
    assert len(swaps) == 1
    assert heuristics._inverse(heuristics._inverse(swaps[0])) == swaps[0]
    for solve in [heuristics.improve_sa, heuristics.improve_tabu]:
        r = solve(s, initial, None, 42, settings=settings, max_steps=200)
        assert r.evaluation.score.total_cost_vnd == 2 and r.evaluation.feasible


@pytest.mark.parametrize("method", ["sa", "tabu"])
def test_locks_and_invalid_initial(case, settings, method):
    solve = getattr(heuristics, "improve_" + method)
    s = case("locked_expensive")
    initial = [Allocation(group_id="G1", need_id="N1", people=1)]
    r = solve(s, initial, None, 42, settings=settings, max_steps=50)
    assert r.evaluation.score.total_cost_vnd == 20
    with pytest.raises(ValueError, match="INITIAL"):
        solve(s, [], None, 42, settings=settings, max_steps=50)
    s = case("locked_exact")
    s.locked_allocations[0].people = 0
    assert all(("G1", "N1") not in dict(m) for m in heuristics._moves(s, {}))


@pytest.mark.parametrize(
    "time,steps", [(None, None), (1.0, 10), (0.0, None), (None, True), (None, 0)]
)
def test_invalid_budget(case, settings, time, steps):
    with pytest.raises(ValueError):
        heuristics.improve_sa(
            case("zero_cost"), [], time, 42, settings=settings, max_steps=steps
        )


@pytest.mark.parametrize("method", ["sa", "tabu"])
def test_step_mode_does_not_use_clock_for_search(case, settings, method, monkeypatch):
    solve = getattr(heuristics, "improve_" + method)
    baseline = solve(case("zero_cost"), [], None, 42, settings=settings, max_steps=10)
    clock = itertools.count()
    monkeypatch.setattr(heuristics, "monotonic", lambda: 1000.0 * next(clock))
    r = solve(case("zero_cost"), [], None, 42, settings=settings, max_steps=10)
    assert (
        r.allocations == baseline.allocations
        and r.search_steps == baseline.search_steps
    )


@pytest.mark.parametrize("method", ["sa", "tabu"])
def test_expired_deadline_keeps_initial(case, settings, method, monkeypatch):
    clock = itertools.count()
    monkeypatch.setattr(heuristics, "monotonic", lambda: float(next(clock)))
    initial = [Allocation(group_id="G1", need_id="N1", people=1)]
    r = getattr(heuristics, "improve_" + method)(
        case("zero_cost"), initial, 0.1, 42, settings=settings
    )
    assert r.allocations == initial and r.search_steps == 0 and r.deadline_exceeded


def test_tabu_inverse_blocked(case, settings, monkeypatch):
    states = []
    forward = ((("G1", "N1"), -1), (("G2", "N1"), 1))

    def moves(s, counts, deadline=None):
        states.append(dict(counts))
        return [forward] if counts.get(("G1", "N1")) else [heuristics._inverse(forward)]

    monkeypatch.setattr(heuristics, "_moves", moves)
    initial = [Allocation(group_id="G1", need_id="N1", people=1)]
    r = heuristics.improve_tabu(
        case("cost_tie"), initial, None, 42, settings=settings, max_steps=20
    )
    assert r.evaluation.score.total_cost_vnd == 10
    assert all(s.get(("G2", "N1")) == 1 for s in states[1:14])
    assert states[14].get(("G2", "N1")) == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("health_fraction", True),
        ("cooling_rate", 1.0),
        ("tabu_tenure", 1.0),
        ("candidate_batch_size", 0),
        ("min_temperature", float("inf")),
    ],
)
def test_invalid_settings(settings, field, value):
    data = settings.model_dump()
    data[field] = value
    with pytest.raises(ValueError):
        type(settings).model_validate(data)


def test_tabu_aspiration(case, settings, monkeypatch):
    s = case("priority_trap")
    for n in s.needs:
        n.demand_hours = 8
        n.priority = 1
        n.max_people = 1
    initial = [Allocation(group_id="G1", need_id="N1", people=1)]
    moves = [((("G1", "N1"), -1),), ((("G1", "N2"), 1),), ((("G1", "N1"), 1),)]
    iterator = iter(moves)
    monkeypatch.setattr(
        heuristics, "_moves", lambda *args: [m] if (m := next(iterator, None)) else []
    )
    result = heuristics.improve_tabu(
        s, initial, None, 42, settings=settings, max_steps=20
    )
    assert result.evaluation.score.weighted_unmet_hours == 0
    assert result.evaluation.score.total_cost_vnd == 30


@pytest.fixture
def four_groups(case):
    s = case("cost_tie")
    s.arcs[0].cost_vnd = 10
    s.arcs[1].cost_vnd = 20
    for id, cost in [("G3", 30), ("G4", 40)]:
        group = s.groups[0].model_copy(deep=True)
        group.group_id = id
        group.source_site_id = id
        s.groups.append(group)
        arc = s.arcs[0].model_copy(deep=True)
        arc.group_id = id
        arc.cost_vnd = cost
        s.arcs.append(arc)
    return s


def test_tabu_expiry_after_accepted_moves(four_groups, settings, monkeypatch):
    states = []

    def transfer(a, b):
        return tuple(sorted((((a, "N1"), -1), ((b, "N1"), 1))))

    def moves(s, counts, deadline=None):
        active = next(g for (g, n), v in counts.items() if v)
        states.append(active)
        if len(states) > 5:
            return []
        if len(states) == 2:
            return [transfer("G2", "G1"), transfer("G2", "G3")]
        destinations = {1: "G2", 3: "G4", 4: "G2", 5: "G1"}
        return [transfer(active, destinations[len(states)])]

    monkeypatch.setattr(heuristics, "_moves", moves)
    result = heuristics.improve_tabu(
        four_groups,
        [Allocation(group_id="G1", need_id="N1", people=1)],
        None,
        42,
        settings=settings.model_copy(update={"tabu_tenure": 2}),
        max_steps=20,
    )
    assert states[:6] == ["G1", "G2", "G3", "G4", "G2", "G1"]
    assert result.evaluation.score.total_cost_vnd == 10


def test_diversification_can_choose_worse_admissible_move(
    four_groups, settings, monkeypatch
):
    states = []

    class RNG:
        def shuffle(self, values):
            pass

        def choice(self, values):
            return values[-1]

    def transfer(a, b):
        return tuple(sorted((((a, "N1"), -1), ((b, "N1"), 1))))

    def moves(s, counts, deadline=None):
        active = next(g for (g, n), v in counts.items() if v)
        states.append(active)
        if len(states) == 1:
            return [transfer("G1", "G2")]
        if len(states) == 2:
            return [transfer("G2", "G3"), transfer("G2", "G4")]
        return []

    monkeypatch.setattr(heuristics.random, "Random", lambda seed: RNG())
    monkeypatch.setattr(heuristics, "_moves", moves)
    result = heuristics.improve_tabu(
        four_groups,
        [Allocation(group_id="G1", need_id="N1", people=1)],
        None,
        42,
        settings=settings.model_copy(update={"diversify_after": 1}),
        max_steps=20,
    )
    assert states[:3] == ["G1", "G2", "G4"]
    assert result.evaluation.score.total_cost_vnd == 10


def test_acceptance_rule():
    assert heuristics._accept(-1, 1.0, 0.99)
    assert heuristics._accept(0, 1.0, 0.99)
    assert heuristics._accept(1, 1.0, 0.1)
    assert not heuristics._accept(1, 1.0, 0.9)
