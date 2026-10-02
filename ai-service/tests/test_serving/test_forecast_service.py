"""API nội bộ của `forecast` theo hợp đồng `forecast-internal.yaml`: fail-closed, luồng tạo lượt → job → kết quả, bất biến,
idempotent, và MỌI phản hồi thành công khớp schema của hợp đồng. Động cơ được thay bằng `compute` giả trả số THẬT đã commit
(demo run 2010-03) để test nhanh; đường tính thật kiểm ở test_engine.py."""

import json
import time
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator

from app.serving.common.settings import ServingSettings
from app.serving.forecast_api import engine
from app.serving.forecast_api.auth import (
    ServiceVerifier,
    make_dependencies,
    parse_public_key,
)
from app.serving.forecast_api.catalog import Catalog
from app.serving.forecast_api.main import create_app
from app.serving.forecast_api.panel import data_version_not_found
from app.serving.forecast_api.runner import JobRunner
from app.serving.forecast_api.service import ForecastService
from app.serving.forecast_api.store import MemoryRunStore
from tests.test_serving.jwt_helpers import Signer

_ROOT = Path(__file__).resolve().parents[3]
CONTRACT = yaml.safe_load(
    (_ROOT / "contracts" / "openapi" / "forecast-internal.yaml").read_text("utf-8")
)
DEMO = json.loads(
    (_ROOT / "dashboard" / "public" / "demo" / "run-2010-03.json").read_text("utf-8")
)
KEY = "0192f3a1-0000-7000-8000-000000000001"


def valid(name: str, value) -> None:
    Draft202012Validator(
        {"$ref": f"#/components/schemas/{name}", "components": CONTRACT["components"]}
    ).validate(value)


class FakePanels:
    """Panel giả: phiên bản duy nhất `v0.2.0`, dữ liệu thật tới 2010-12 (đủ cho tháng neo ≤ 2010-06)."""

    def __init__(self) -> None:
        months = [
            pd.Timestamp(f"{y}-{m:02d}-01") for y in (2009, 2010) for m in range(1, 13)
        ]
        self.ctx = SimpleNamespace(
            last_real_month=pd.Timestamp("2010-12-01"),
            feat=pd.DataFrame({"month": months}),
        )

    def resolve(self, data_version):
        if data_version not in (None, "v0.2.0"):
            raise data_version_not_found()
        return "v0.2.0"

    def context(self, data_version):
        return self.ctx


def canned_compute(ctx, origin_month, on_progress):
    on_progress(0.5)
    return engine.RunResult(
        origin_month=origin_month,
        items=DEMO["items"],
        explanations=DEMO["explanations"],
        legend_cases_per_100k=DEMO["legend_cases_per_100k"],
    )


class Env:
    def __init__(self, compute=canned_compute) -> None:
        self.signer = Signer()
        self.store = MemoryRunStore()
        self.panels = FakePanels()
        self.runner = JobRunner(
            self.store, self.panels, compute=compute, poll_seconds=0.05
        )
        verifier = ServiceVerifier(
            {"k1": parse_public_key(self.signer.public_b64)},
            "denguesense-identity",
            "forecast",
        )
        service = ForecastService(
            self.store, self.panels, Catalog.load(), notify=self.runner.notify
        )
        self.app = create_app(
            ServingSettings("forecast", "t", "error", 1 << 20),
            [],
            service=service,
            verifier=verifier,
        )
        self.client = TestClient(self.app, raise_server_exceptions=False)
        self.token = self.signer.service_token()

    def call(
        self,
        method,
        path,
        *,
        roles=None,
        actor="0192f3a1-0000-7000-8000-0000000000aa",
        token=None,
        key=KEY,
        json_body=None,
        **kw,
    ):
        headers = {"Authorization": f"Bearer {token or self.token}"}
        if roles is not None:
            headers.update({"X-Actor-ID": actor, "X-Actor-Roles": roles})
        if key:
            headers["Idempotency-Key"] = key
        return self.client.request(method, path, headers=headers, json=json_body, **kw)

    def create(self, origin="2010-03", *, roles="analyst", key=KEY, **body):
        return self.call(
            "POST",
            "/internal/v1/forecast-runs",
            roles=roles,
            key=key,
            json_body={"mode": "backtest", "origin_month": origin, **body},
        )

    def run_to_completion(self, origin="2010-03"):
        job = self.create(origin).json()
        assert self.runner.run_one()
        return self.call("GET", f"/internal/v1/jobs/{job['job_id']}").json()


@pytest.fixture()
def env():
    return Env()


# ---------- Fail-closed ----------


def _operations():
    ops = []
    for path, methods in CONTRACT["paths"].items():
        for method, op in methods.items():
            ops.append((method.upper(), path, op.get("security") == []))
    return ops


def _concrete(path: str) -> str:
    return (
        path.replace("{run_id}", "0192f3a1-0000-7000-8000-000000000001")
        .replace("{job_id}", "0192f3a1-0000-7000-8000-000000000001")
        .replace("{province_id}", "ha_noi")
    )


def test_public_routes_match_the_contract():
    assert {p for _, p, pub in _operations() if pub} == {"/healthz", "/readyz"}


@pytest.mark.parametrize(
    "method,path", [(m, p) for m, p, pub in _operations() if not pub]
)
def test_every_contract_operation_is_fail_closed(env, method, path):
    url = _concrete(path)
    assert (
        env.client.request(method, url).status_code == 401
    ), "thiếu token → 401 (trước cả kiểm tham số)"
    user_token = env.signer.service_token(
        "forecast", typ=None
    )  # giống token người dùng: không có typ=service
    wrong_aud = env.signer.service_token("surveillance")
    expired = env.signer.service_token(now=time.time() - 3600)
    other_issuer = env.signer.service_token(issuer="ke-gia-mao")
    for tok in (user_token, wrong_aud, expired, other_issuer, "rac.rac.rac", ""):
        r = env.client.request(method, url, headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 401, tok[:12]
        assert r.json()["code"] == "common.unauthenticated"


def test_token_attacks_are_rejected(env):
    url = "/internal/v1/model-card"
    good = env.token
    head, payload, sig = good.split(".")
    tampered_payload = payload[:-2] + ("AA" if not payload.endswith("AA") else "BB")
    forged = Signer()  # khoá khác
    cases = {
        "chữ ký sai": f"{head}.{tampered_payload}.{sig}",
        "khoá lạ": forged.service_token(),
        "alg none": env.signer.sign(
            {
                "iss": "denguesense-identity",
                "sub": "g",
                "aud": ["forecast"],
                "exp": int(time.time()) + 60,
                "typ": "service",
            },
            {"alg": "none", "kid": "k1"},
        ),
        "kid lạ": env.signer.sign(
            {
                "iss": "denguesense-identity",
                "sub": "g",
                "aud": ["forecast"],
                "exp": int(time.time()) + 60,
                "typ": "service",
            },
            {"alg": "EdDSA", "kid": "khong-co"},
        ),
        "thiếu sub": env.signer.sign(
            {
                "iss": "denguesense-identity",
                "aud": ["forecast"],
                "exp": int(time.time()) + 60,
                "typ": "service",
            }
        ),
    }
    for name, tok in cases.items():
        assert (
            env.client.get(url, headers={"Authorization": f"Bearer {tok}"}).status_code
            == 401
        ), name
    assert (
        env.client.get(url, headers={"Authorization": f"Bearer {good}"}).status_code
        == 200
    )
    assert (
        env.client.get(url, headers={"Authorization": f"Basic {good}"}).status_code
        == 401
    )


def test_no_unauthenticated_schema_endpoints(env):
    for path in ("/openapi.json", "/docs", "/redoc"):
        assert env.client.get(path).status_code == 404


def test_actor_headers_are_ignored_without_valid_service_token(env):
    r = env.client.post(
        "/internal/v1/forecast-runs",
        headers={"X-Actor-ID": "u", "X-Actor-Roles": "admin", "Idempotency-Key": KEY},
        json={},
    )
    assert r.status_code == 401


def test_api_cannot_be_mounted_without_verifier():
    with pytest.raises(ValueError):
        create_app(ServingSettings("forecast", "t", "error", 1024), service=object())  # type: ignore[arg-type]


# ---------- Catalog / model card ----------


def test_model_endpoints_conform_to_contract(env):
    card = env.call("GET", "/internal/v1/model-card").json()
    valid("ModelCard", card)
    assert card["model_version"] == "m4-r2@1.0.0"
    lim = env.call("GET", "/internal/v1/model-card/limitations").json()
    assert len(lim["items"]) == 12 and lim["model_version"] == "m4-r2@1.0.0"
    for item in lim["items"]:
        valid("Limitation", item)
    versions = env.call("GET", "/internal/v1/model-versions").json()
    for item in versions["items"]:
        valid("ModelVersion", item)
    assert [v["status"] for v in versions["items"]] == ["approved"]


def test_catalog_requires_exactly_one_approved_version():
    with pytest.raises(ValueError):
        Catalog([])


# ---------- Tạo lượt → job → kết quả ----------


def test_full_flow_create_run_read_results(env):
    r = env.create("2010-03")
    assert r.status_code == 202, r.text
    job = r.json()
    valid("Job", job)
    assert job["status"] == "queued" and job["result_ref"] is None
    assert r.headers["location"] == f"/internal/v1/jobs/{job['job_id']}"

    # chưa chạy xong → kết quả chưa đọc được
    run_id = env.store.list_runs(None, None, 10, None)[0][0].run_id
    not_ready = env.call(
        "GET", f"/internal/v1/forecast-runs/{run_id}/forecasts?horizon=3"
    )
    assert (
        not_ready.status_code == 409
        and not_ready.json()["code"] == "forecast.run_not_ready"
    )

    assert env.runner.run_one()
    done = env.call("GET", f"/internal/v1/jobs/{job['job_id']}").json()
    valid("Job", done)
    assert done["status"] == "succeeded" and done["progress"] == 1.0
    assert done["result_ref"] == f"/internal/v1/forecast-runs/{run_id}"

    run = env.call("GET", f"/internal/v1/forecast-runs/{run_id}").json()
    valid("ForecastRun", run)
    assert (
        run["status"],
        run["run_mode"],
        run["origin_month"],
        run["model_version"],
        run["data_version"],
    ) == ("completed", "backtest", "2010-03", "m4-r2@1.0.0", "v0.2.0")

    rf = env.call(
        "GET", f"/internal/v1/forecast-runs/{run_id}/forecasts?horizon=3"
    ).json()
    valid("RunForecasts", rf)
    assert rf["meta"]["run_id"] == run_id and rf["meta"]["origin_month"] == "2010-03"
    assert rf["meta"]["limitations_ref"] == "/api/v1/model-card/limitations"
    assert len(rf["items"]) == 34 and {i["horizon"] for i in rf["items"]} == {3}
    want = {i["province_id"]: i for i in DEMO["items"] if i["horizon"] == 3}
    for item in rf["items"]:  # số phục vụ = số động cơ trả, không bị đổi
        assert item == want[item["province_id"]]
        assert item["cases_pred_interval"] is None
    assert rf["legend"]["exceed_prob"][0]["label"] == "Dưới 20%"
    assert rf["legend"]["cases_per_100k"] == DEMO["legend_cases_per_100k"]

    pf = env.call(
        "GET", f"/internal/v1/forecast-runs/{run_id}/provinces/khanh_hoa/forecasts"
    ).json()
    valid("ProvinceForecasts", pf)
    assert [i["horizon"] for i in pf["items"]] == [1, 2, 3, 6]

    ex = env.call(
        "GET",
        f"/internal/v1/forecast-runs/{run_id}/provinces/khanh_hoa/explanation?horizon=6",
    ).json()
    valid("Explanation", ex)
    assert (
        ex["explained_component"] == "m2b_lightgbm_poisson" and len(ex["factors"]) == 5
    )

    assert env.store.outbox_count() == 1
    event = env.store.outbox[0]
    assert (
        event["type"] == "forecast.run.completed"
        and event["data"]["province_count"] == 34
    )
    assert event["data"]["horizons"] == [1, 2, 3, 6]


def test_events_conform_to_event_schemas(env):
    env.run_to_completion()
    schema_dir = _ROOT / "contracts" / "events"
    env_schema = json.loads((schema_dir / "envelope.v1.json").read_text("utf-8"))
    data_schema = json.loads(
        (schema_dir / "forecast.run.completed.v1.json").read_text("utf-8")
    )
    event = env.store.outbox[0]
    Draft202012Validator(env_schema).validate(event)
    Draft202012Validator(data_schema).validate(event["data"])


def test_run_list_and_filters(env):
    env.run_to_completion("2010-03")
    env.create("2010-04", key="0192f3a1-0000-7000-8000-000000000002")
    body = env.call("GET", "/internal/v1/forecast-runs?limit=1").json()
    assert len(body["items"]) == 1 and body["next_cursor"] is not None
    for item in body["items"]:
        valid("ForecastRun", item)
    assert (
        env.call("GET", "/internal/v1/forecast-runs?status=completed").json()["items"][
            0
        ]["origin_month"]
        == "2010-03"
    )
    assert (
        env.call("GET", "/internal/v1/forecast-runs?mode=live_experimental").json()[
            "items"
        ]
        == []
    )
    for bad in ("mode=x", "status=x", "limit=0", "limit=101"):
        assert (
            env.call("GET", f"/internal/v1/forecast-runs?{bad}").status_code == 400
        ), bad


def test_idempotency_and_deduplication(env):
    a = env.create("2010-03", key=KEY).json()
    again = env.create("2010-03", key=KEY).json()
    assert a["job_id"] == again["job_id"], "cùng key + cùng nội dung → đúng job cũ"
    clash = env.create("2010-04", key=KEY)
    assert (
        clash.status_code == 409
        and clash.json()["code"] == "common.idempotency_key_reused"
    )
    other_key = env.create("2010-03", key="0192f3a1-0000-7000-8000-000000000009").json()
    assert other_key["job_id"] != a["job_id"]
    assert (
        len(env.store.list_runs(None, None, 10, None)[0]) == 1
    ), "cùng đầu vào KHÔNG tạo lượt thứ hai (mô hình tất định)"
    assert env.runner.run_one() and not env.runner.run_one()
    assert (
        env.call("GET", f"/internal/v1/jobs/{other_key['job_id']}").json()["status"]
        == "succeeded"
    )


def test_create_run_authorization_and_validation(env):
    assert env.create(roles="viewer").status_code == 403
    assert (
        env.call(
            "POST",
            "/internal/v1/forecast-runs",
            json_body={"mode": "backtest", "origin_month": "2010-03"},
        ).status_code
        == 403
    ), "không có danh tính người dùng"
    assert env.create(roles="admin").status_code == 202
    e2 = Env()
    assert (
        e2.call(
            "POST",
            "/internal/v1/forecast-runs",
            roles="analyst",
            key=None,
            json_body={"mode": "backtest", "origin_month": "2010-03"},
        ).json()["code"]
        == "common.idempotency_key_required"
    )
    assert e2.create(key="khong-phai-uuid").status_code == 400

    bad_bodies = [
        {},
        {"mode": "backtest"},
        {"origin_month": "2010-03"},
        {"mode": "xxx", "origin_month": "2010-03"},
        {"mode": "backtest", "origin_month": "2010-3"},
        {"mode": "backtest", "origin_month": "2010-03", "chen_them": 1},
        {"mode": "backtest", "origin_month": "2010-03", "data_version": "0.2.0"},
        {"mode": "backtest", "origin_month": "2010-03", "model_version": "X"},
        [],
    ]
    for body in bad_bodies:
        r = e2.call(
            "POST", "/internal/v1/forecast-runs", roles="analyst", json_body=body
        )
        assert r.status_code == 400, body
        assert r.json()["code"] == "common.validation_error"
    raw = e2.client.post(
        "/internal/v1/forecast-runs",
        headers={
            "Authorization": f"Bearer {e2.token}",
            "X-Actor-ID": "u",
            "X-Actor-Roles": "analyst",
            "Idempotency-Key": KEY,
        },
        content=b"{khong json",
    )
    assert raw.status_code == 400
    assert (
        e2.store.list_runs(None, None, 10, None)[0] == []
    ), "đầu vào sai không để lại lượt nào"


def test_create_run_domain_errors(env):
    too_late = env.create("2010-07")
    assert (
        too_late.status_code == 400
        and too_late.json()["code"] == "forecast.origin_out_of_range"
    )
    assert env.create("2012-01").json()["code"] == "forecast.origin_out_of_range"
    no_data = env.create("2008-01")  # panel giả không có tháng này
    assert (
        no_data.status_code == 400
        and no_data.json()["code"] == "forecast.origin_out_of_range"
    )
    assert (
        env.create(data_version="v9.9.9").json()["code"]
        == "forecast.data_version_not_found"
    )
    assert env.create(model_version="m9-x@9.9.9").status_code == 404
    live = env.call(
        "POST",
        "/internal/v1/forecast-runs",
        roles="analyst",
        json_body={"mode": "live_experimental", "origin_month": "2026-06"},
    )
    assert (
        live.status_code == 409 and live.json()["code"] == "forecast.model_not_approved"
    )
    assert env.store.list_runs(None, None, 10, None)[0] == []


def test_read_endpoints_validate_input_and_report_not_found(env):
    env.run_to_completion()
    run_id = env.store.list_runs(None, None, 1, None)[0][0].run_id
    base = f"/internal/v1/forecast-runs/{run_id}"
    assert env.call("GET", f"{base}/forecasts").status_code == 400, "thiếu horizon"
    assert env.call("GET", f"{base}/forecasts?horizon=4").status_code == 400
    assert env.call("GET", f"{base}/forecasts?horizon=abc").status_code == 400
    assert env.call("GET", f"{base}/provinces/khong_co/forecasts").status_code == 404
    assert env.call("GET", f"{base}/provinces/HA_NOI/forecasts").status_code == 400
    assert (
        env.call("GET", f"{base}/provinces/ha_noi/explanation?horizon=5").status_code
        == 400
    )
    assert (
        env.call("GET", f"{base}/provinces/khong_co/explanation?horizon=3").status_code
        == 404
    )
    r = env.call(
        "GET", "/internal/v1/forecast-runs/0192f3a1-0000-7000-8000-0000000000ff"
    )
    assert r.status_code == 404 and r.json()["code"] == "forecast.run_not_found"
    assert (
        env.call("GET", "/internal/v1/forecast-runs/khong-phai-uuid").status_code == 404
    )
    assert (
        env.call(
            "GET", "/internal/v1/jobs/0192f3a1-0000-7000-8000-0000000000ff"
        ).status_code
        == 404
    )
    assert env.call("GET", "/internal/v1/jobs/rac").status_code == 404


# ---------- Thất bại và phục hồi ----------


def test_failed_run_reports_stable_code_and_leaks_nothing():
    def boom(ctx, origin, on_progress):
        raise RuntimeError("SELECT secret FROM /srv/private/path password=hunter2")

    e = Env(compute=boom)
    job = e.create().json()
    assert e.runner.run_one()
    done = e.call("GET", f"/internal/v1/jobs/{job['job_id']}").json()
    valid("Job", done)
    assert (
        done["status"] == "failed"
        and done["error_code"] == "forecast.run_failed"
        and done["result_ref"] is None
    )
    run_id = e.store.list_runs(None, None, 1, None)[0][0].run_id
    text = e.call("GET", f"/internal/v1/forecast-runs/{run_id}").text
    assert "hunter2" not in text and "/srv/private" not in text
    assert e.store.outbox[0]["type"] == "forecast.run.failed"
    assert (
        e.call(
            "GET", f"/internal/v1/forecast-runs/{run_id}/forecasts?horizon=1"
        ).json()["code"]
        == "forecast.run_not_ready"
    )
    # thất bại không chặn chạy lại cùng đầu vào
    retry = e.create(key="0192f3a1-0000-7000-8000-000000000003")
    assert retry.status_code == 202 and retry.json()["status"] == "queued"


def test_engine_error_code_is_preserved_when_it_is_a_forecast_code():
    def out_of_range(ctx, origin, on_progress):
        raise engine.EngineError("forecast.origin_out_of_range", "x")

    e = Env(compute=out_of_range)
    e.create()
    e.runner.run_one()
    assert (
        e.store.list_runs(None, None, 1, None)[0][0].error_code
        == "forecast.origin_out_of_range"
    )


def test_interrupted_runs_are_requeued_on_startup():
    e = Env()
    job = e.create().json()
    assert (
        e.store.claim_next(e.runner._clock()) is not None
    )  # tiến trình "chết" khi đang chạy
    assert (
        e.call("GET", f"/internal/v1/jobs/{job['job_id']}").json()["status"]
        == "running"
    )
    e.runner.start()  # khởi động lại: recover_interrupted rồi chạy tiếp
    try:
        deadline = time.time() + 5
        while time.time() < deadline:
            if (
                e.call("GET", f"/internal/v1/jobs/{job['job_id']}").json()["status"]
                == "succeeded"
            ):
                break
            time.sleep(0.05)
    finally:
        e.runner.stop()
    assert (
        e.call("GET", f"/internal/v1/jobs/{job['job_id']}").json()["status"]
        == "succeeded"
    )


def test_background_runner_processes_jobs_via_app_lifespan():
    e = Env()
    verifier = ServiceVerifier(
        {"k1": parse_public_key(e.signer.public_b64)},
        "denguesense-identity",
        "forecast",
    )
    service = ForecastService(e.store, e.panels, Catalog.load(), notify=e.runner.notify)
    app = create_app(
        ServingSettings("forecast", "t", "error", 1 << 20),
        [],
        service=service,
        verifier=verifier,
        runner=e.runner,
    )
    with TestClient(app) as client:  # vào lifespan → khởi động luồng nền
        h = {
            "Authorization": f"Bearer {e.token}",
            "X-Actor-ID": "u",
            "X-Actor-Roles": "analyst",
            "Idempotency-Key": KEY,
        }
        job = client.post(
            "/internal/v1/forecast-runs",
            headers=h,
            json={"mode": "backtest", "origin_month": "2010-03"},
        ).json()
        status = "queued"
        for _ in range(100):
            status = client.get(
                f"/internal/v1/jobs/{job['job_id']}",
                headers={"Authorization": f"Bearer {e.token}"},
            ).json()["status"]
            if status == "succeeded":
                break
            time.sleep(0.05)
        assert status == "succeeded"


def test_readiness_reports_dependency_failure_without_detail():
    e = Env()
    verifier = ServiceVerifier(
        {"k1": parse_public_key(e.signer.public_b64)},
        "denguesense-identity",
        "forecast",
    )

    async def broken() -> None:
        raise RuntimeError("password=hunter2 host=10.0.0.5")

    service = ForecastService(e.store, e.panels, Catalog.load())
    app = create_app(
        ServingSettings("forecast", "t", "error", 1 << 20),
        [broken],
        service=service,
        verifier=verifier,
    )
    r = TestClient(app).get("/readyz")
    assert r.status_code == 503 and "hunter2" not in r.text and "10.0.0.5" not in r.text


def test_make_dependencies_returns_pair():
    e = Env()
    verifier = ServiceVerifier(
        {"k1": parse_public_key(e.signer.public_b64)},
        "denguesense-identity",
        "forecast",
    )
    assert len(make_dependencies(verifier)) == 2
