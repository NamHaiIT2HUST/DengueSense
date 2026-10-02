"""Kiểm thử các hợp đồng OpenAPI NỘI BỘ và bản đồ định tuyến của gateway (contracts/).

Bốn file OpenAPI (public + 3 internal) chứa BẢN SAO có chủ đích của các schema dùng chung (không $ref chéo file).
Các test ở đây là thứ giữ cho các bản sao không lệch nhau, cho hai luồng làm song song (docs/09 §17.1).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

_CONTRACTS = Path(__file__).resolve().parents[3] / "contracts"
_OPENAPI = _CONTRACTS / "openapi"

INTERNAL = {
    "identity": "identity-internal.yaml",
    "surveillance": "surveillance-internal.yaml",
    "forecast": "forecast-internal.yaml",
}
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
# Operation nội bộ được phép KHÔNG cần token dịch vụ (`security: []`).
UNAUTHENTICATED_OK = {"healthz", "readyz", "getJwks", "issueServiceToken"}
# POST có tác dụng phụ nhưng KHÔNG cần Idempotency-Key (đăng nhập/đăng xuất/cấp token là idempotent theo bản chất).
NO_IDEMPOTENCY_KEY = {"login", "refreshToken", "logout", "issueServiceToken"}


def _load(name: str) -> dict:
    return yaml.safe_load((_OPENAPI / name).read_text(encoding="utf-8"))


def _operations(spec: dict) -> dict[str, tuple[str, str, dict]]:
    ops: dict[str, tuple[str, str, dict]] = {}
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            if method in HTTP_METHODS:
                assert (
                    op["operationId"] not in ops
                ), f"operationId trùng: {op['operationId']}"
                ops[op["operationId"]] = (method, path, op)
    return ops


@pytest.fixture(scope="module")
def public() -> dict:
    return _load("public-v1.yaml")


@pytest.fixture(scope="module")
def internal() -> dict[str, dict]:
    return {svc: _load(f) for svc, f in INTERNAL.items()}


# ---------- hình dạng chung của hợp đồng nội bộ ----------


@pytest.mark.parametrize("svc", sorted(INTERNAL))
def test_internal_paths_are_prefixed_except_health(svc, internal):
    for opid, (_, path, _) in _operations(internal[svc]).items():
        if opid in {"healthz", "readyz"}:
            assert path in {"/healthz", "/readyz"}
        else:
            assert path.startswith(
                "/internal/v1/"
            ), f"{svc}.{opid}: {path} thiếu tiền tố /internal/v1"


@pytest.mark.parametrize("svc", sorted(INTERNAL))
def test_internal_requires_service_token_by_default(svc, internal):
    spec = internal[svc]
    assert spec["security"] == [{"serviceToken": []}]
    assert spec["components"]["securitySchemes"]["serviceToken"]["scheme"] == "bearer"
    open_ops = {
        opid
        for opid, (_, _, op) in _operations(spec).items()
        if op.get("security") == []
    }
    assert (
        open_ops <= UNAUTHENTICATED_OK
    ), f"{svc}: operation không cần token phải thuộc danh sách đã duyệt: {open_ops - UNAUTHENTICATED_OK}"


@pytest.mark.parametrize("svc", sorted(INTERNAL))
def test_secured_operations_declare_401_and_use_problem_json(svc, internal):
    for opid, (_, _, op) in _operations(internal[svc]).items():
        if op.get("security") == []:
            continue
        assert "401" in op["responses"], f"{svc}.{opid} thiếu phản hồi 401"
        for code, resp in op["responses"].items():
            if code.startswith(("4", "5")):
                ref = resp.get("$ref", "")
                assert ref.startswith(
                    "#/components/responses/"
                ), f"{svc}.{opid} {code} phải dùng response chuẩn"


@pytest.mark.parametrize("svc", sorted(INTERNAL))
def test_side_effect_posts_require_idempotency_key(svc, internal):
    for opid, (method, _, op) in _operations(internal[svc]).items():
        if method != "post" or opid in NO_IDEMPOTENCY_KEY:
            continue
        refs = {p.get("$ref", "") for p in op.get("parameters", [])}
        assert (
            "#/components/parameters/IdempotencyKey" in refs
        ), f"{svc}.{opid}: POST tác dụng phụ thiếu Idempotency-Key"


def test_operations_that_depend_on_actor_declare_actor_headers(internal):
    """Service đích kiểm lại vai trò (không tin gateway) nên PHẢI nhận danh tính người dùng gốc."""
    for svc, opid in (
        ("forecast", "createForecastRun"),
        ("surveillance", "createDataVersion"),
    ):
        _, _, op = _operations(internal[svc])[opid]
        refs = {p.get("$ref", "") for p in op["parameters"]}
        assert (
            "#/components/parameters/ActorId" in refs
        ), f"{svc}.{opid} thiếu X-Actor-ID"
        assert (
            "#/components/parameters/ActorRoles" in refs
        ), f"{svc}.{opid} thiếu X-Actor-Roles"


def test_login_never_exposes_refresh_token_publicly(public, internal):
    """ADR-0005: refresh token chỉ đi qua cookie HttpOnly do gateway đặt; hợp đồng CÔNG KHAI không được có nó."""
    assert (
        "refresh_token"
        in internal["identity"]["components"]["schemas"]["InternalTokenResponse"][
            "properties"
        ]
    )
    assert (
        "refresh_token"
        not in public["components"]["schemas"]["TokenResponse"]["properties"]
    )


# ---------- schema dùng chung không được lệch ----------


def _schemas(spec: dict) -> dict:
    return spec["components"]["schemas"]


def test_shared_schemas_are_identical_across_all_specs(public, internal):
    """Schema trùng TÊN ở nhiều file phải GIỐNG HỆT — nếu cố ý khác thì phải đổi tên."""
    specs = {"public": public, **internal}
    seen: dict[str, tuple[str, dict]] = {}
    mismatches: list[str] = []
    for spec_name, spec in specs.items():
        for name, schema in _schemas(spec).items():
            if name in seen and seen[name][1] != schema:
                mismatches.append(f"{name}: {seen[name][0]} ≠ {spec_name}")
            seen.setdefault(name, (spec_name, schema))
    assert not mismatches, (
        "schema dùng chung bị lệch (sửa cả hai bản, hoặc đổi tên nếu cố ý khác): "
        + "; ".join(mismatches)
    )
    shared = [n for n in seen if sum(n in _schemas(s) for s in specs.values()) > 1]
    assert {
        "Problem",
        "Meta",
        "ForecastItem",
        "Province",
        "DataVersion",
        "Observation",
        "User",
    } <= set(shared)


def test_legend_matches_public_risk_map_legend(public, internal):
    """`legend` do forecast trả (nội bộ) phải có đúng hình dạng mà gateway trả cho frontend (công khai)."""

    def without_description(schema: dict) -> dict:
        return {k: v for k, v in schema.items() if k != "description"}

    public_legend = _schemas(public)["RiskMap"]["properties"]["legend"]
    internal_legend = _schemas(internal["forecast"])["Legend"]
    assert without_description(public_legend) == without_description(internal_legend)


def test_forecast_item_keeps_the_honesty_fields(internal, public):
    """Luật T1/T3/T7 (docs/10 §9): hợp đồng không được lặng lẽ bỏ base_rate, provenance, cờ cảnh báo."""
    for spec in (public, internal["forecast"]):
        item = _schemas(spec)["ForecastItem"]
        assert {
            "exceed_prob",
            "base_rate",
            "threshold_p75",
            "cases_pred_interval",
            "input_data_sources",
            "reliability",
            "flags",
        } <= set(item["required"])
        meta = _schemas(spec)["Meta"]
        assert {
            "run_id",
            "run_mode",
            "model_version",
            "data_version",
            "origin_month",
            "limitations_ref",
        } <= set(meta["required"])


def test_province_id_is_a_slug_not_a_numeric_code(public):
    """province_id thật là slug (ho_chi_minh) — khớp panel và province_metadata.csv, không phải mã số."""
    pid = _schemas(public)["ProvinceId"]
    assert re.fullmatch(pid["pattern"], "ho_chi_minh")
    assert not re.fullmatch(pid["pattern"], "79")
    assert not re.fullmatch(pid["pattern"], "Ho Chi Minh")


# ---------- bản đồ định tuyến gateway ----------


@pytest.fixture(scope="module")
def routing() -> dict:
    return yaml.safe_load((_CONTRACTS / "routing.yaml").read_text(encoding="utf-8"))


def test_routing_covers_exactly_the_public_operations(public, routing):
    public_ops = set(_operations(public))
    routed = set(routing["operations"])
    assert (
        routed == public_ops
    ), f"thiếu định tuyến: {sorted(public_ops - routed)}; định tuyến thừa: {sorted(routed - public_ops)}"


def test_routing_upstreams_point_to_real_internal_operations(internal, routing):
    ops = {svc: _operations(spec) for svc, spec in internal.items()}
    for public_op, entry in routing["operations"].items():
        assert entry["upstream"], f"{public_op} không có upstream"
        for ref in entry["upstream"]:
            svc, _, opid = ref.partition(".")
            assert svc in ops, f"{public_op}: service lạ trong {ref}"
            assert (
                opid in ops[svc]
            ), f"{public_op}: {ref} không tồn tại trong {INTERNAL[svc]}"


def test_routing_roles_match_public_security_and_known_roles(public, routing):
    valid = set(_schemas(public)["Role"]["enum"]) | {"public"}
    for opid, (_, _, op) in _operations(public).items():
        entry = routing["operations"][opid]
        assert entry["min_role"] in valid, f"{opid}: vai trò lạ {entry['min_role']}"
        is_public = op.get("security") == []
        assert (
            entry["min_role"] == "public"
        ) == is_public, f"{opid}: min_role không khớp `security` của hợp đồng công khai"
    assert routing["operations"]["createForecastRun"]["min_role"] == "analyst"


def test_risk_map_is_the_only_multi_upstream_bff_besides_run_resolution(routing):
    """Gộp nhiều lời gọi là ngoại lệ có chủ đích (docs/09 §4.2: tối đa 3, timeout tổng 2 s)."""
    for opid, entry in routing["operations"].items():
        assert len(entry["upstream"]) <= 3, f"{opid} ghép quá 3 lời gọi"
    assert len(routing["operations"]["getRiskMap"]["upstream"]) == 3


# ---------- mã lỗi ----------

_CODE_RE = re.compile(
    r"`((?:common|auth|forecast|surveillance|gateway|workflow|genai|notification|optimize)\.[a-z_]+)`"
)


def _catalog() -> set[str]:
    text = (_CONTRACTS / "errors.md").read_text(encoding="utf-8")
    return set(re.findall(r"^\| `([a-z]+\.[a-z_]+)` \|", text, flags=re.MULTILINE))


@pytest.mark.parametrize("filename", ["public-v1.yaml", *INTERNAL.values()])
def test_every_error_code_in_each_contract_is_cataloged(filename):
    text = (_OPENAPI / filename).read_text(encoding="utf-8")
    mentioned = set(_CODE_RE.findall(text))
    missing = mentioned - _catalog()
    assert (
        not missing
    ), f"{filename}: mã lỗi chưa có trong contracts/errors.md: {sorted(missing)}"
