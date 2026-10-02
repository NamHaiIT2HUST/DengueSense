"""Cổng Đợt 1: động cơ THẬT (fit lại M4-R2 + bộ phân loại + SHAP) phải cho đúng số của exp_016 ở cùng tháng neo.

Chạy thật mất ~25 giây/tháng neo và cần panel v0.2.0 (dữ liệu nằm ngoài git) — bỏ qua nếu không có. Bản đối chiếu là các
file demo đã commit (`dashboard/public/demo/run-*.json`), vốn được kiểm ngược với `results.json` của exp_016 ở test_replay.
"""

import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from app.serving.forecast_api import engine

_ROOT = Path(__file__).resolve().parents[2]
PANEL = _ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
REF = _ROOT.parent / "dashboard" / "public" / "demo"


def _ctx_stub(last_real: str, months: list[str]):
    """Đủ thuộc tính cho `validate_backtest_origin` mà không dựng cả panel."""
    return SimpleNamespace(
        last_real_month=pd.Timestamp(f"{last_real}-01"),
        feat=pd.DataFrame({"month": [pd.Timestamp(f"{m}-01") for m in months]}),
    )


def test_backtest_origin_validation_is_strict():
    ctx = _ctx_stub("2010-12", ["2010-03", "2010-06", "2010-07"])
    assert engine.validate_backtest_origin(ctx, "2010-03") == pd.Timestamp("2010-03-01")
    assert engine.validate_backtest_origin(ctx, "2010-06") == pd.Timestamp("2010-06-01")
    for bad, code in [
        ("2010-07", "forecast.origin_out_of_range"),  # sau giai đoạn đã kiểm chứng
        ("2012-01", "forecast.origin_out_of_range"),
        ("2010-3", "common.validation_error"),
        ("03/2010", "common.validation_error"),
        ("", "common.validation_error"),
    ]:
        with pytest.raises(engine.EngineError) as e:
            engine.validate_backtest_origin(ctx, bad)
        assert e.value.code == code, bad


def test_origin_without_data_or_targets_is_rejected():
    with pytest.raises(engine.EngineError) as e:  # thiếu dữ liệu thật cho tầm 6
        engine.validate_backtest_origin(_ctx_stub("2010-08", ["2010-03"]), "2010-03")
    assert e.value.code == "forecast.origin_out_of_range"
    with pytest.raises(engine.EngineError):  # panel không có tháng neo
        engine.validate_backtest_origin(_ctx_stub("2010-12", ["2010-02"]), "2010-03")


def _assert_statistically_equivalent(got, want):
    """Nền tảng KHÁC (Linux/Docker): RNG lấy mẫu con của XGBoost phụ thuộc thư viện chuẩn của trình biên dịch nên số không
    trùng từng chữ số. Đo trên container Linux: tương quan log ≥ 0,9997, Spearman xác suất ≥ 0,988, |Δp| trung bình ≈ 0,02.
    Ngưỡng dưới đây chặt hơn thế một chút nhưng đủ để bắt lỗi thật (sai tháng neo, sai dữ liệu huấn luyện, bỏ thành phần).
    """
    import numpy as np
    from scipy.stats import spearmanr

    for h in (1, 2, 3, 6):
        keys = sorted(k for k in want if k[1] == h)
        a = np.array([got[k]["incidence_pred_per_100k"] for k in keys])
        b = np.array([want[k]["incidence_pred_per_100k"] for k in keys])
        pa = np.array([got[k]["exceed_prob"] for k in keys])
        pb = np.array([want[k]["exceed_prob"] for k in keys])
        assert np.corrcoef(np.log1p(a), np.log1p(b))[0, 1] > 0.998, h
        assert spearmanr(pa, pb)[0] > 0.97, h
        assert np.abs(pa - pb).mean() < 0.04, h


@pytest.mark.skipif(
    not PANEL.exists(),
    reason="panel v0.2.0 nằm ngoài git — dựng bằng app.data.build_panel",
)
def test_engine_reproduces_exp_016_at_gate_origin_2010_03():
    # Tiến trình sạch (xem _engine_run.py): kết quả số phụ thuộc thư viện BLAS/luồng đã nạp — như service thật.
    proc = subprocess.run(
        [sys.executable, str(Path(__file__).with_name("_engine_run.py")), "2010-03"],
        capture_output=True,
        text=True,
        cwd=_ROOT,
        timeout=600,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    run = json.loads(proc.stdout.strip().splitlines()[-1])
    ref = json.loads((REF / "run-2010-03.json").read_text("utf-8"))

    assert run["origin_month"] == "2010-03"
    got = {(i["province_id"], i["horizon"]): i for i in run["items"]}
    want = {(i["province_id"], i["horizon"]): i for i in ref["items"]}
    assert got.keys() == want.keys() and len(got) == 34 * 4

    if sys.platform == "win32":
        # NỀN TẢNG THAM CHIẾU (nơi exp_016 được chạy): khớp từng số.
        for key, w in want.items():
            g = got[key]
            assert g["incidence_pred_per_100k"] == pytest.approx(
                w["incidence_pred_per_100k"], rel=1e-6
            ), key
            assert g["exceed_prob"] == pytest.approx(w["exceed_prob"], abs=1e-6), key
            assert g["threshold_p75"] == pytest.approx(
                w["threshold_p75"], rel=1e-6
            ), key
            assert g["cases_pred"] == pytest.approx(w["cases_pred"], rel=1e-6), key
            assert g["flags"] == w["flags"], key
    else:
        _assert_statistically_equivalent(got, want)

    for (
        key,
        w,
    ) in (
        want.items()
    ):  # phần KHÔNG phụ thuộc RNG của mô hình: khớp tuyệt đối trên mọi nền tảng
        g = got[key]
        assert g["threshold_p75"] == pytest.approx(w["threshold_p75"], rel=1e-9), key
        assert g["base_rate"] == pytest.approx(w["base_rate"], abs=1e-9), key
        assert g["reliability"] == w["reliability"], key
        assert g["input_data_sources"] == w["input_data_sources"], key
        assert g["cases_pred_interval"] is None

    assert run["explanations"].keys() == ref["explanations"].keys()
    for key, w in ref["explanations"].items():
        g = run["explanations"][key]
        assert g["base_value"] == pytest.approx(w["base_value"], abs=1e-6), key
        assert [f["feature"] for f in g["factors"]] == [
            f["feature"] for f in w["factors"]
        ], key
    assert run["legend_cases_per_100k"] == ref["legend_cases_per_100k"]
