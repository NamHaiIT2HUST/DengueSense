from __future__ import annotations

import math

import pandas as pd

from app.forecast.m4 import assemble_m4, climatology_forecast

REG = {"b": "Bắc", "t": "Trung", "n": "Nam"}


def test_assemble_routes_each_region_and_averages_with_m1():
    out = assemble_m4(
        m1_preds={"b": 3.0, "t": 3.0, "n": 3.0},
        gbm_std={"b": 6.0, "t": 6.0, "n": 6.0},
        gbm_v3_tweedie={"b": 0.0, "t": 99.0, "n": 99.0},
        b3={"b": 100.0, "t": 100.0, "n": 0.0},
        regions=REG,
    )
    assert math.isclose(out["b"], (3.0 + 2 * 0.0) / 3)  # Bắc: V3 tweedie
    assert math.isclose(out["t"], (3.0 + 2 * 6.0) / 3)  # Trung: GBM chuẩn
    assert math.isclose(out["n"], (3.0 + 2 * 3.0) / 3)  # Nam: 0.5*6 + 0.5*0 = 3


def test_assemble_without_m1_uses_gbm_only():
    out = assemble_m4({}, {"t": 6.0}, {}, {}, {"t": "Trung"})
    assert out["t"] == 6.0


def test_assemble_nan_m1_falls_back_to_gbm():
    out = assemble_m4({"t": float("nan")}, {"t": 6.0}, {}, {}, {"t": "Trung"})
    assert out["t"] == 6.0


def test_climatology_forecast_averages_same_calendar_month_per_province():
    months = pd.to_datetime(["2000-03-01", "2001-03-01", "2001-04-01"] * 2)
    df = pd.DataFrame(
        {
            "province_id": ["a"] * 3 + ["b"] * 3,
            "month": months,
            "incidence_per_100k": [2.0, 4.0, 100.0, 10.0, 20.0, 100.0],
        }
    )
    out = climatology_forecast(df, pd.Timestamp("2002-03-01"))
    assert out == {"a": 3.0, "b": 15.0}


def test_assemble_empty_routing_means_no_routing():
    out = assemble_m4(
        {"b": 3.0}, {"b": 6.0}, {"b": 0.0}, {"b": 100.0}, {"b": "Bắc"}, routing={}
    )
    assert math.isclose(out["b"], (3.0 + 2 * 6.0) / 3)  # GBM chuan, khong V3/B3
