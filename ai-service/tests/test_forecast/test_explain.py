from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.forecast.explain import (
    feature_family,
    fit_lightgbm_model,
    fit_xgboost_model,
    tree_shap,
)


def _data(n=400, seed=0):
    rng = np.random.default_rng(seed)
    x1 = rng.normal(size=n)
    x2 = rng.normal(size=n)
    noise = rng.normal(size=n)
    y = np.exp(0.8 * x1 + 0.1 * noise) * 3
    return pd.DataFrame({"x1": x1, "x2": x2, "noise": noise, "y": y})


def test_lightgbm_shap_is_additive_in_raw_space():
    df = _data()
    m = fit_lightgbm_model(df, ["x1", "x2", "noise"], "y")
    X = df[["x1", "x2", "noise"]].head(50)
    contrib, base = tree_shap(m, X)
    raw = m.predict(X, raw_score=True)
    np.testing.assert_allclose(contrib.sum(axis=1) + base, raw, rtol=1e-5, atol=1e-5)


def test_xgboost_shap_is_additive_in_raw_space():
    df = _data()
    m = fit_xgboost_model(df, ["x1", "x2", "noise"], "y")
    X = df[["x1", "x2", "noise"]].head(50)
    contrib, base = tree_shap(m, X)
    raw = m.get_booster().predict(__import__("xgboost").DMatrix(X), output_margin=True)
    np.testing.assert_allclose(contrib.sum(axis=1) + base, raw, rtol=1e-4, atol=1e-4)


@pytest.mark.parametrize("fitter", [fit_lightgbm_model, fit_xgboost_model])
def test_shap_ranks_the_informative_feature_first(fitter):
    df = _data(800)
    m = fitter(df, ["x1", "x2", "noise"], "y")
    contrib, _ = tree_shap(m, df[["x1", "x2", "noise"]])
    importance = np.abs(contrib).mean(axis=0)
    assert importance.argmax() == 0  # x1 la bien that su anh huong y
    assert importance[0] > 3 * importance[1]


def test_feature_family_mapping():
    assert feature_family("temp_mean_lag_2") == "Khí hậu (nhiệt/mưa/ẩm)"
    assert feature_family("precip_total_roll_mean_3") == "Khí hậu (nhiệt/mưa/ẩm)"
    assert feature_family("oni_lag_3") == "ONI (El Niño)"
    assert feature_family("sin_month") == "Mùa vụ"
    assert (
        feature_family("incidence_per_100k_lag_2") == "Ca bệnh gần đây (lag, đà tăng)"
    )
    assert feature_family("momentum") == "Ca bệnh gần đây (lag, đà tăng)"
    assert (
        feature_family("incidence_per_100k_same_month_last_year")
        == "Chuẩn mùa vụ của tỉnh"
    )
    assert feature_family("prov_mean_hist") == "Quy mô / ngưỡng của tỉnh"
    assert (
        feature_family("incidence_per_100k_lag_2__vs_thr") == "Quy mô / ngưỡng của tỉnh"
    )
    assert feature_family("nb_mean_lag_2") == "Không gian (láng giềng/toàn quốc)"
