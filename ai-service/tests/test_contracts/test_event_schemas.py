"""Kiểm thử hợp đồng sự kiện (contracts/events) và danh mục mã lỗi (contracts/errors.md).

Mục đích: hợp đồng là nguồn sự thật (docs/09 §6.10) nên chính nó phải được kiểm —
schema hợp lệ, ví dụ mẫu khớp schema, và không có mã lỗi "mồ côi" ngoài errors.md.
"""

from __future__ import annotations

import copy
import json
import re
import uuid
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

_CONTRACTS = Path(__file__).resolve().parents[3] / "contracts"
_EVENTS = _CONTRACTS / "events"
_RUN_ID = str(uuid.uuid4())

SAMPLES = {
    "forecast.run.completed": {
        "run_id": _RUN_ID,
        "run_mode": "backtest",
        "origin_month": "2010-03",
        "model_version": "m4-r2@1.0.0",
        "data_version": "v0.2.0",
        "province_count": 34,
        "horizons": [1, 2, 3, 6],
    },
    "forecast.run.failed": {
        "run_id": _RUN_ID,
        "run_mode": "live_experimental",
        "origin_month": "2026-08",
        "error_code": "forecast.run_failed",
    },
    "surveillance.data_version.published": {
        "data_version": "v0.3.0",
        "first_month": "1994-01",
        "last_month": "2025-12",
        "real_share": 0.727,
    },
}


def _load(name: str) -> dict:
    return json.loads((_EVENTS / name).read_text(encoding="utf-8"))


def _envelope(event_type: str, data: dict) -> dict:
    return {
        "specversion": "1.0",
        "id": str(uuid.uuid4()),
        "source": "denguesense/" + event_type.split(".")[0],
        "type": event_type,
        "dataschema": f"contracts/events/{event_type}.v1.json",
        "time": "2026-09-25T02:14:09Z",
        "subject": f"run/{_RUN_ID}",
        "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        "data": data,
    }


def _event_files() -> list[Path]:
    return sorted(p for p in _EVENTS.glob("*.json") if p.name != "envelope.v1.json")


def test_every_schema_is_valid_json_schema():
    files = sorted(_EVENTS.glob("*.json"))
    assert len(files) >= 4
    for f in files:
        Draft202012Validator.check_schema(json.loads(f.read_text(encoding="utf-8")))


def test_every_event_schema_has_a_sample_and_every_sample_a_schema():
    names = {p.name.removesuffix(".v1.json") for p in _event_files()}
    assert names == set(SAMPLES), "mỗi schema sự kiện phải có 1 mẫu kiểm thử"


@pytest.mark.parametrize("event_type", sorted(SAMPLES))
def test_sample_data_and_envelope_are_valid(event_type):
    Draft202012Validator(_load(f"{event_type}.v1.json")).validate(SAMPLES[event_type])
    Draft202012Validator(_load("envelope.v1.json")).validate(
        _envelope(event_type, SAMPLES[event_type])
    )


@pytest.mark.parametrize("event_type", sorted(SAMPLES))
def test_dataschema_in_envelope_points_to_an_existing_file(event_type):
    env = _envelope(event_type, SAMPLES[event_type])
    assert (_CONTRACTS.parent / env["dataschema"]).is_file()


@pytest.mark.parametrize("event_type", sorted(SAMPLES))
def test_unknown_field_in_data_is_rejected(event_type):
    """additionalProperties=false: thêm trường lạ vào `data` phải đi qua đổi schema (docs/09 §7.2)."""
    bad = copy.deepcopy(SAMPLES[event_type])
    bad["truong_la"] = 1
    with pytest.raises(ValidationError):
        Draft202012Validator(_load(f"{event_type}.v1.json")).validate(bad)


def test_missing_required_field_is_rejected():
    bad = copy.deepcopy(SAMPLES["forecast.run.completed"])
    del bad["model_version"]
    with pytest.raises(ValidationError):
        Draft202012Validator(_load("forecast.run.completed.v1.json")).validate(bad)


def test_envelope_rejects_wrong_specversion_and_bad_type():
    validator = Draft202012Validator(_load("envelope.v1.json"))
    env = _envelope("forecast.run.completed", SAMPLES["forecast.run.completed"])
    validator.validate(env)
    for field, value in (("specversion", "0.3"), ("type", "ForecastCompleted")):
        broken = {**env, field: value}
        with pytest.raises(ValidationError):
            validator.validate(broken)


def test_run_mode_and_horizon_are_restricted():
    validator = Draft202012Validator(_load("forecast.run.completed.v1.json"))
    for field, value in (
        ("run_mode", "live"),
        ("horizons", [4]),
        ("origin_month", "2010-13"),
    ):
        bad = {**SAMPLES["forecast.run.completed"], field: value}
        with pytest.raises(ValidationError):
            validator.validate(bad)


# ----- errors.md ↔ OpenAPI -----

_CODE_RE = re.compile(
    r"`((?:common|auth|forecast|surveillance|gateway|workflow|genai|notification|optimize)\.[a-z_]+)`"
)


def _catalog_codes() -> set[str]:
    text = (_CONTRACTS / "errors.md").read_text(encoding="utf-8")
    return set(re.findall(r"^\| `([a-z]+\.[a-z_]+)` \|", text, flags=re.MULTILINE))


def test_errors_catalog_is_well_formed_and_unique():
    text = (_CONTRACTS / "errors.md").read_text(encoding="utf-8")
    rows = re.findall(r"^\| `([a-z]+\.[a-z_]+)` \|", text, flags=re.MULTILINE)
    assert len(rows) == len(set(rows)), "mã lỗi bị khai báo trùng"
    assert "common.validation_error" in rows and "common.internal_error" in rows


def test_every_error_code_mentioned_in_openapi_is_in_the_catalog():
    spec_text = (_CONTRACTS / "openapi" / "public-v1.yaml").read_text(encoding="utf-8")
    spec = yaml.safe_load(spec_text)
    mentioned = set(_CODE_RE.findall(spec_text))
    for schema_name in ("Problem", "Warning"):
        mentioned.update(
            spec["components"]["schemas"][schema_name]["properties"]["code"].get(
                "examples", []
            )
        )
    assert mentioned, "phải tìm thấy ít nhất 1 mã lỗi trong OpenAPI"
    missing = mentioned - _catalog_codes()
    assert (
        not missing
    ), f"mã lỗi có trong OpenAPI nhưng thiếu ở contracts/errors.md: {missing}"


def test_openapi_operations_have_unique_ids_and_json_snake_case_fields():
    spec = yaml.safe_load(
        (_CONTRACTS / "openapi" / "public-v1.yaml").read_text(encoding="utf-8")
    )
    op_ids = [
        op["operationId"]
        for methods in spec["paths"].values()
        for op in methods.values()
        if isinstance(op, dict) and "operationId" in op
    ]
    assert len(op_ids) == len(set(op_ids)) >= 15
    snake = re.compile(r"^[a-z][a-z0-9_]*$")
    # Bắc/Trung/Nam là khoá tiếng Việt có dấu trong reliability_by_region — ngoại lệ có chủ đích.
    allowed = {"Bắc", "Trung", "Nam"}
    for name, schema in spec["components"]["schemas"].items():
        for prop in schema.get("properties", {}):
            assert prop in allowed or snake.match(
                prop
            ), f"{name}.{prop} không phải snake_case"
