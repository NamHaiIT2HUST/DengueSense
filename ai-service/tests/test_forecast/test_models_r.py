"""Test cho M3 hhh4 — SKIP toàn bộ nếu máy không có R (CI không cài R, chỉ
máy dev có — xem app/forecast/r_env.py). Không phải test giả, chỉ là test
có điều kiện chạy được."""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
import pytest

r_available = True
try:
    from app.forecast.r_env import setup_r

    setup_r()
    from rpy2 import robjects

    robjects.r("suppressMessages(library(surveillance))")
except Exception:  # noqa: BLE001 - chi de kiem tra R co san khong
    r_available = False

pytestmark = pytest.mark.skipif(
    not r_available, reason="Cần cài R + surveillance package"
)


def _make_panel(n_months: int = 60, n_provinces: int = 6) -> pd.DataFrame:
    rng = np.random.default_rng(0)
    months = pd.date_range("2015-01-01", periods=n_months, freq="MS")
    rows = []
    for i in range(n_provinces):
        p = f"p{i}"
        population = 1_000_000
        base = 5.0 * (i + 1)
        for m in months:
            cases = max(0, rng.poisson(base))
            rows.append(
                {
                    "province_id": p,
                    "month": m,
                    "population": population,
                    "cases": float(cases),
                    "incidence_per_100k": cases / population * 100_000,
                    "temp_mean": 25.0 + 3.0 * np.sin(2 * np.pi * m.month / 12) + i,
                    "precip_total": 100.0 + 50.0 * np.cos(2 * np.pi * m.month / 12),
                }
            )
    return pd.DataFrame(rows)


def test_fit_hhh4_runs_without_error():
    from app.forecast.models_r import fit_hhh4

    panel = _make_panel()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        province_order, train_end_idx, _all_months, _pop_wide = fit_hhh4(
            panel, pd.Timestamp("2018-06-01"), max_horizon=3
        )
    assert len(province_order) == 6
    assert train_end_idx > 0


def test_simulate_forecast_shape_matches_province_count():
    from app.forecast.models_r import fit_hhh4, simulate_forecast

    panel = _make_panel()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        province_order, train_end_idx, _, _ = fit_hhh4(
            panel, pd.Timestamp("2018-06-01"), max_horizon=3
        )
        pred = simulate_forecast(train_end_idx, horizon=3, nsim=50)

    assert pred.shape == (len(province_order),)
    assert not np.isnan(pred).any()
    assert (pred >= 0).all()


def test_simulate_forecast_not_collapsed_to_scalar():
    """Regression test cho bug thật: class hhh4sims không tự drop chiều
    đơn vị như array thường, khiến rowMeans() gộp nhầm tất cả các tỉnh
    thành 1 số duy nhất nếu không unclass() trước."""
    from app.forecast.models_r import fit_hhh4, simulate_forecast

    panel = _make_panel(n_provinces=6)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit_hhh4(panel, pd.Timestamp("2018-06-01"), max_horizon=1)
        pred = simulate_forecast(train_end_idx=42, horizon=1, nsim=50)

    assert pred.shape[0] == 6
    # cac tinh co base incidence khac nhau ro -> khong the tat ca deu bang nhau
    assert len(set(pred.round(3))) > 1


def test_fit_predict_m3_hhh4_returns_dict_per_province():
    from app.forecast.models_r import fit_predict_m3_hhh4

    panel = _make_panel()
    train_df = panel[panel["month"] <= "2018-06-01"]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = fit_predict_m3_hhh4(
            train_df,
            target_month=pd.Timestamp("2018-09-01"),
            horizon=3,
            full_panel_for_sts=panel,
            nsim=50,
        )
    assert set(result.keys()) == {f"p{i}" for i in range(6)}
    assert all(v >= 0 for v in result.values())


def test_fit_hhh4_with_climate_covariates_runs_and_differs_from_no_climate():
    """Regression test cho covariate khí hậu (climatology theo tỉnh) thêm
    vào end$f — chạy không lỗi, và dự báo phải KHÁC bản không có khí hậu
    (nếu giống hệt thì covariate không thực sự được model dùng)."""
    from app.forecast.models_r import fit_hhh4, simulate_forecast

    panel = _make_panel()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit_hhh4(panel, pd.Timestamp("2018-06-01"), max_horizon=3)
        pred_no_climate = simulate_forecast(train_end_idx=42, horizon=3, nsim=50)

        fit_hhh4(
            panel,
            pd.Timestamp("2018-06-01"),
            max_horizon=3,
            climate_cols=("temp_mean", "precip_total"),
        )
        pred_with_climate = simulate_forecast(train_end_idx=42, horizon=3, nsim=50)

    assert pred_with_climate.shape == (6,)
    assert not np.isnan(pred_with_climate).any()
    assert (pred_with_climate >= 0).all()
    assert not np.allclose(pred_no_climate, pred_with_climate)
