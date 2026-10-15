import json
from pathlib import Path

import pytest

from app.optimize.staffing import StaffingScenario


@pytest.fixture
def case():
    def load(name):
        root = Path(__file__).resolve().parents[3]
        path = Path(__file__).parent / "fixtures" / f"{name}.json"
        if not path.exists():
            path = root / "tests/test_optimize/fixtures" / f"{name}.json"
        return StaffingScenario.model_validate(json.loads(path.read_text()))

    return load


@pytest.fixture
def milp_settings():
    from app.optimize.settings import MilpSettings

    return MilpSettings(
        integrality_tolerance=1e-6,
        feasibility_tolerance=1e-6,
        objective_tolerance=1e-6,
        relative_gap_limit=0.0,
        absolute_gap_limit=0.0,
        threads=1,
    )
