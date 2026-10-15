import subprocess
import sys
from pathlib import Path


def test_milp_import_with_legacy_test_optimize_module(tmp_path):
    legacy = tmp_path / "tests"
    legacy.mkdir()
    (legacy / "__init__.py").write_text("")
    (legacy / "test_optimize.py").write_text("")
    test_module = Path(__file__).with_name("test_milp.py")
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import importlib, runpy, sys; "
                "sys.path.insert(0, sys.argv[1]); "
                "importlib.import_module('tests.test_optimize'); "
                "runpy.run_path(sys.argv[2])"
            ),
            str(tmp_path),
            str(test_module),
        ],
        cwd=Path(__file__).resolve().parents[3],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
