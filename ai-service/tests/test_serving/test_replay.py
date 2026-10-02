"""Dữ liệu demo (`dashboard/public/demo/*.json`, sinh bởi `replay`) phải: (1) KHỚP nguyên văn kết quả đã công bố của
exp_016, (2) khớp hợp đồng `public-v1.yaml`, (3) tuân các luật trung thực. Đây cũng là bản đối chiếu mà service
`forecast` thật phải thoả (cùng origin → cùng số)."""

import json
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator

from app.serving.forecast_api import policy, replay

_ROOT = Path(__file__).resolve().parents[2]
DEMO = _ROOT.parent / "dashboard" / "public" / "demo"
SPEC = yaml.safe_load(
    (_ROOT.parent / "contracts" / "openapi" / "public-v1.yaml").read_text("utf-8")
)

ORIGINS = [
    "2009-11",
    "2009-12",
    "2010-01",
    "2010-02",
    "2010-03",
    "2010-04",
    "2010-05",
    "2010-06",
]
FLAG_CATALOG = {
    "outbreak_underprediction_risk",
    "estimated_inputs",
    "stale_data",
    "out_of_validated_period",
}


def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(
        {"$ref": f"#/components/schemas/{name}", "components": SPEC["components"]}
    )


def _load(name: str):
    return json.loads((DEMO / name).read_text("utf-8"))


@pytest.fixture(scope="module")
def runs():
    return {o: _load(f"run-{o}.json") for o in ORIGINS}


@pytest.fixture(scope="module")
def exp016():
    raw = json.loads(replay.RESULTS_PATH.read_text("utf-8"))
    m4 = {
        (r["origin"], r["horizon"], r["province_id"]): r["m4"]
        for r in raw["forecast"]
        if r["season"] == 2010
    }
    clf = {
        (r["origin"], r["horizon"], r["province_id"]): r["p_clf"]
        for r in raw["alert"]
        if r["season"] == 2010
    }
    return m4, clf


def test_numbers_match_exp_016_exactly(runs, exp016):
    m4, clf = exp016
    checked = 0
    for idx, origin in enumerate(ORIGINS):
        for item in runs[origin]["items"]:
            key = (idx, item["horizon"], item["province_id"])
            assert item["incidence_pred_per_100k"] == m4[key], key
            assert item["exceed_prob"] == clf[key], key
            checked += 1
    assert checked == 8 * 4 * 34


def test_gate_origin_2010_03_has_all_34_provinces_at_every_horizon(runs):
    items = runs["2010-03"]["items"]
    for h in (1, 2, 3, 6):
        assert len({i["province_id"] for i in items if i["horizon"] == h}) == 34


def test_items_and_run_conform_to_the_public_contract(runs):
    item_v, run_v = _validator("ForecastItem"), _validator("ForecastRun")
    for run in runs.values():
        run_v.validate(run["run"])
        for item in run["items"]:
            item_v.validate(item)


def test_explanations_conform_and_are_top5_by_abs_contribution(runs):
    v = _validator("Explanation")
    run = runs["2010-03"]
    meta = {
        "run_id": run["run"]["run_id"],
        "run_mode": "backtest",
        "model_version": policy.MODEL_VERSION,
        "data_version": policy.DATA_VERSION,
        "origin_month": "2010-03",
        "generated_at": run["run"]["created_at"],
        "limitations_ref": "/api/v1/model-card/limitations",
    }
    assert len(run["explanations"]) == 34 * 4
    for key, e in run["explanations"].items():
        province, h = key.split("|")
        v.validate(
            {
                "meta": meta,
                "province_id": province,
                "horizon": int(h),
                "explained_component": replay.EXPLAINED_COMPONENT,
                **e,
            }
        )
        mags = [abs(f["contribution"]) for f in e["factors"]]
        assert len(mags) == replay.TOP_K and mags == sorted(mags, reverse=True)


def test_honesty_invariants(runs):
    for origin, run in runs.items():
        for item in run["items"]:
            assert (
                item["cases_pred_interval"] is None
            )  # chưa có khoảng đã kiểm chứng độ phủ
            assert 0.0 <= item["base_rate"] <= 1.0 and 0.0 <= item["exceed_prob"] <= 1.0
            assert set(item["flags"]) <= FLAG_CATALOG
            assert (
                "out_of_validated_period" not in item["flags"]
            )  # mọi origin ≤ 2010-06
            assert item["reliability"] == policy.reliability_for(item["region"])
            s = item["input_data_sources"]
            assert abs(s["real"] + s["estimated"] + s["imputed"] - 1.0) < 1e-9
            assert s["estimated"] == 0.0  # dữ liệu ≤ 2010 đều là số đo thật
            assert item["target_month"] > origin
        # nhãn cờ phải khớp luật `policy` (không có bản luật thứ hai)
        for item in run["items"]:
            assert ("outbreak_underprediction_risk" in item["flags"]) == (
                item["exceed_prob"] >= 0.5
            )


def test_base_rate_is_causal_training_window_rate_not_the_future_rate(runs):
    """Tỉ lệ nền là của CỬA SỔ HUẤN LUYỆN (biết được tại origin). Tỉ lệ thực tế ở mùa được dự báo cao hơn (L9) —
    dữ liệu tái hiện ghi cả hai để UI nói thẳng độ lệch, không giấu."""
    run = runs["2010-03"]
    base = {i["horizon"]: i["base_rate"] for i in run["items"]}
    actual = {}
    for h in (1, 2, 3, 6):
        rows = [a for a in run["actuals"] if a["horizon"] == h]
        actual[h] = sum(a["exceeded"] for a in rows) / len(rows)
    assert all(0.15 < b < 0.3 for b in base.values())
    assert (
        actual[6] > base[6]
    )  # mùa 2010 vượt tỉ lệ nền huấn luyện: dịch chuyển phân phối


def test_index_and_observations(runs):
    idx = _load("index.json")
    prov_v, dv_v = _validator("Province"), _validator("DataVersion")
    assert len(idx["provinces"]) == 34
    for p in idx["provinces"]:
        prov_v.validate(p)
    for d in idx["data_versions"]:
        dv_v.validate(d)
    assert [r["origin_month"] for r in idx["runs"]] == ORIGINS
    assert len({r["run_id"] for r in idx["runs"]}) == 8

    obs = _load("observations.json")
    assert len(obs) == 34
    ov = _validator("Observation")
    for series in obs.values():
        n = len(series["cases"])
        assert n == len(series["incidence_per_100k"]) == len(series["data_source"])
        for c, i, s in zip(
            series["cases"], series["incidence_per_100k"], series["data_source"]
        ):
            if c is not None:
                ov.validate(
                    {
                        "month": "2010-01",
                        "cases": c,
                        "incidence_per_100k": i,
                        "data_source": s,
                    }
                )


def test_run_ids_are_deterministic():
    assert replay.run_id_for("2010-03") == replay.run_id_for("2010-03")
    assert replay.run_id_for("2010-03") != replay.run_id_for("2010-04")
