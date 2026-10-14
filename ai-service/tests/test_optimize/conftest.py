import json
from pathlib import Path

import pytest

from app.optimize.staffing import StaffingScenario


@pytest.fixture
def case():
    def load(name):
        path = Path(__file__).parent / "fixtures" / f"{name}.json"
        return StaffingScenario.model_validate(json.loads(path.read_text()))

    return load
