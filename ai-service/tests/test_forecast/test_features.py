from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.forecast.features import (
    add_climate_lag_features,
    add_climate_rolling_features,
    add_disease_lag_features,
    add_momentum_features,
    add_oni_features,
    add_province_baseline_features,
    add_seasonal_features,
    add_seasonal_norm_features,
    build_feature_matrix,
)


def _make_panel(
    n_months: int = 40, provinces: tuple[str, ...] = ("a", "b")
) -> pd.DataFrame:
    months = pd.date_range("2015-01-01", periods=n_months, freq="MS")
    rows = []
    for p in provinces:
        for i, m in enumerate(months):
            rows.append(
                {
                    "province_id": p,
                    "month": m,
                    "cases": float(i + 1),
                    "incidence_per_100k": float(i + 1) * 2,
                    "temp_mean": 20.0 + i * 0.1,
                    "precip_total": 100.0 + i,
                    "humidity_mean": 70.0 + i * 0.05,
                    "oni": np.sin(i / 6),
                }
            )
    return pd.DataFrame(rows)


def _assert_causal(
    feature_fn, panel: pd.DataFrame, feature_cols: list[str], anomaly_at_index: int = -1
):
    """Đổi giá trị ở tháng CUỐI (tương lai xa nhất) rồi kiểm tra mọi feature
    ở các tháng TRƯỚC đó không đổi — pattern chuẩn kiểm tra tính nhân quả."""
    panel_a = panel.copy()
    panel_b = panel.copy()
    last_month = panel_b["month"].max()
    for col in [
        "cases",
        "incidence_per_100k",
        "temp_mean",
        "precip_total",
        "humidity_mean",
        "oni",
    ]:
        if col in panel_b.columns:
            panel_b.loc[panel_b["month"] == last_month, col] = 999_999.0

    feat_a = feature_fn(panel_a)
    feat_b = feature_fn(panel_b)

    before = feat_a["month"] != last_month
    for col in feature_cols:
        pd.testing.assert_series_equal(
            feat_a.loc[before, col].reset_index(drop=True),
            feat_b.loc[before, col].reset_index(drop=True),
            check_names=False,
        )


def test_seasonal_features_hand_computed():
    panel = _make_panel(n_months=3)
    feat = add_seasonal_features(panel)
    jan = feat[feat["month"] == "2015-01-01"].iloc[0]
    assert jan["sin_month"] == pytest.approx(np.sin(2 * np.pi * 1 / 12))
    assert jan["cos_month"] == pytest.approx(np.cos(2 * np.pi * 1 / 12))


def test_climate_lag_is_causal():
    panel = _make_panel()
    _assert_causal(
        lambda p: add_climate_lag_features(p, max_lag=3),
        panel,
        ["temp_mean_lag_1", "temp_mean_lag_2", "temp_mean_lag_3"],
    )


def test_climate_lag_hand_computed():
    panel = _make_panel(provinces=("a",))
    feat = add_climate_lag_features(panel, max_lag=2, reporting_delay_months=0)
    row5 = feat.iloc[5]
    assert row5["temp_mean_lag_1"] == pytest.approx(feat.iloc[4]["temp_mean"])
    assert row5["temp_mean_lag_2"] == pytest.approx(feat.iloc[3]["temp_mean"])


def test_climate_lag_respects_reporting_delay():
    panel = _make_panel(provinces=("a",))
    feat = add_climate_lag_features(panel, max_lag=1, reporting_delay_months=2)
    row5 = feat.iloc[5]
    # lag_1 voi D=2 -> shift tong (1+2)=3
    assert row5["temp_mean_lag_1"] == pytest.approx(feat.iloc[2]["temp_mean"])


def test_climate_rolling_is_causal():
    panel = _make_panel()
    _assert_causal(
        lambda p: add_climate_rolling_features(p, windows=(2, 3)),
        panel,
        ["temp_mean_roll_mean_2", "temp_mean_roll_mean_3"],
    )


def test_climate_rolling_excludes_current_month():
    panel = _make_panel(provinces=("a",))
    feat = add_climate_rolling_features(panel, windows=(2,))
    row5 = feat.iloc[5]
    expected = feat.iloc[3:5][
        "temp_mean"
    ].mean()  # thang 4 va 5 (index 3,4), KHONG gom index 5
    assert row5["temp_mean_roll_mean_2"] == pytest.approx(expected)


def test_disease_lag_is_causal():
    panel = _make_panel()
    _assert_causal(
        lambda p: add_disease_lag_features(p, max_lag=3, reporting_delay_months=1),
        panel,
        [
            "incidence_per_100k_lag_2",
            "incidence_per_100k_lag_3",
            "incidence_per_100k_lag_4",
        ],
    )


def test_disease_lag_hand_computed_with_reporting_delay():
    panel = _make_panel(provinces=("a",))
    feat = add_disease_lag_features(panel, max_lag=1, reporting_delay_months=1)
    row10 = feat.iloc[10]
    # lag_1 voi D=1 -> ten cot la lag_2 (=1+D), gia tri tai index 10-2=8
    assert "incidence_per_100k_lag_2" in feat.columns
    assert row10["incidence_per_100k_lag_2"] == pytest.approx(
        feat.iloc[8]["incidence_per_100k"]
    )


def test_momentum_is_causal():
    panel = _make_panel()
    _assert_causal(
        lambda p: add_momentum_features(p, reporting_delay_months=1),
        panel,
        ["momentum", "acceleration"],
    )


def test_momentum_hand_computed():
    panel = _make_panel(provinces=("a",))
    feat = add_momentum_features(panel, reporting_delay_months=1)
    row10 = feat.iloc[10]
    # D=1: lag_d=index9, lag_d1=index8, lag_d2=index7
    expected_momentum = (
        feat.iloc[9]["incidence_per_100k"] - feat.iloc[8]["incidence_per_100k"]
    )
    expected_accel = expected_momentum - (
        feat.iloc[8]["incidence_per_100k"] - feat.iloc[7]["incidence_per_100k"]
    )
    assert row10["momentum"] == pytest.approx(expected_momentum)
    assert row10["acceleration"] == pytest.approx(expected_accel)


def test_oni_lag_is_causal():
    panel = _make_panel()
    _assert_causal(
        lambda p: add_oni_features(p, lags=(3, 6)),
        panel,
        ["oni_lag_3", "oni_lag_6"],
    )


def test_oni_lag_hand_computed():
    panel = _make_panel(provinces=("a",))
    feat = add_oni_features(panel, lags=(3,))
    row10 = feat.iloc[10]
    assert row10["oni_lag_3"] == pytest.approx(feat.iloc[7]["oni"])


def test_seasonal_norm_is_causal():
    panel = _make_panel(n_months=40)
    _assert_causal(
        lambda p: add_seasonal_norm_features(p, reporting_delay_months=1),
        panel,
        [
            "incidence_per_100k_same_month_last_year",
            "incidence_per_100k_deviation_from_median",
        ],
    )


def test_seasonal_norm_same_month_last_year_hand_computed():
    panel = _make_panel(provinces=("a",))
    feat = add_seasonal_norm_features(panel, reporting_delay_months=1)
    row15 = feat.iloc[15]
    assert row15["incidence_per_100k_same_month_last_year"] == pytest.approx(
        feat.iloc[3]["incidence_per_100k"]
    )


def test_seasonal_norm_deviation_uses_only_past_years():
    """Median lịch sử tại 1 điểm không được lẫn chính giá trị hiện tại của
    nó (nếu không sẽ luôn kéo deviation về gần 0 một cách giả tạo)."""
    months = pd.date_range("2015-01-01", periods=48, freq="MS")
    # thang 1 tang dan qua nam: 10,20,30,40; cac thang khac hang so 1.0
    vals = [10.0 * ((m.year - 2015) + 1) if m.month == 1 else 1.0 for m in months]
    df = pd.DataFrame({"province_id": "x", "month": months, "incidence_per_100k": vals})
    feat = add_seasonal_norm_features(df, reporting_delay_months=0)
    jan_rows = feat[feat["month"].dt.month == 1].reset_index(drop=True)
    # nam dau: chua co lich su -> NaN. nam 2: median([10])=10, lag=20 -> dev=10
    assert pd.isna(jan_rows.loc[0, "incidence_per_100k_deviation_from_median"])
    assert jan_rows.loc[1, "incidence_per_100k_deviation_from_median"] == pytest.approx(
        10.0
    )
    # nam 3: median([10,20])=15, lag=30 -> dev=15
    assert jan_rows.loc[2, "incidence_per_100k_deviation_from_median"] == pytest.approx(
        15.0
    )


def test_build_feature_matrix_runs_end_to_end_no_error():
    panel = _make_panel(n_months=40)
    feat = build_feature_matrix(panel, reporting_delay_months=1)
    assert len(feat) == len(panel)
    assert "sin_month" in feat.columns
    assert "momentum" in feat.columns
    assert "incidence_per_100k_deviation_from_median" in feat.columns


def test_province_baseline_is_causal():
    _assert_causal(
        lambda p: add_province_baseline_features(p, reporting_delay_months=1),
        _make_panel(n_months=40),
        ["prov_mean_hist", "prov_mean_12m"],
    )


def test_province_baseline_hand_computed():
    panel = _make_panel(n_months=30, provinces=("a",))
    feat = add_province_baseline_features(
        panel, reporting_delay_months=1, min_history_months=12
    )
    # incidence = 2*(i+1); tai dong index 15 chi dung index <= 14 (D=1)
    row = feat.iloc[15]
    expected_hist = np.mean([2.0 * (i + 1) for i in range(15)])
    expected_12m = np.mean([2.0 * (i + 1) for i in range(3, 15)])
    assert row["prov_mean_hist"] == pytest.approx(expected_hist)
    assert row["prov_mean_12m"] == pytest.approx(expected_12m)
    assert np.isnan(feat.iloc[5]["prov_mean_hist"])  # chua du 12 thang lich su


def _spatial_panel_and_adj():
    panel = _make_panel(n_months=20, provinces=("a", "b", "c"))
    panel["incidence_per_100k"] = panel["incidence_per_100k"] * panel[
        "province_id"
    ].map({"a": 1.0, "b": 10.0, "c": 100.0})
    adj = pd.DataFrame(
        [[0, 1, 0], [1, 0, 1], [0, 1, 0]],
        index=["a", "b", "c"],
        columns=["a", "b", "c"],
        dtype=float,
    )
    return panel, adj


def test_spatial_features_causal():
    from app.forecast.features import SPATIAL_FEATURE_COLS, add_spatial_features

    panel, adj = _spatial_panel_and_adj()
    _assert_causal(
        lambda p: add_spatial_features(p, adj, reporting_delay_months=1),
        panel,
        SPATIAL_FEATURE_COLS,
    )


def test_spatial_features_hand_computed():
    from app.forecast.features import add_spatial_features

    panel, adj = _spatial_panel_and_adj()
    feat = add_spatial_features(panel, adj, reporting_delay_months=1)
    row = feat[(feat.province_id == "b") & (feat.month == pd.Timestamp("2015-06-01"))]
    # thang 2015-06 = index 5; lag 2 -> index 3, incidence goc = 2*(i+1) = 8
    # ke cua b = a (x1) va c (x100): mean = (8*1 + 8*100)/2
    assert row["nb_mean_lag_2"].iloc[0] == pytest.approx((8.0 + 800.0) / 2)
    assert row["nb_max_lag_2"].iloc[0] == pytest.approx(800.0)
    # toan quoc: mean(8*1, 8*10, 8*100)
    assert row["nat_mean_lag_2"].iloc[0] == pytest.approx(8.0 * 111.0 / 3)
    # tinh a chi co ke la b
    ra = feat[(feat.province_id == "a") & (feat.month == pd.Timestamp("2015-06-01"))]
    assert ra["nb_mean_lag_2"].iloc[0] == pytest.approx(80.0)


def test_spatial_features_are_float_even_with_nullable_input():
    from app.forecast.features import SPATIAL_FEATURE_COLS, add_spatial_features

    panel, adj = _spatial_panel_and_adj()
    panel["incidence_per_100k"] = panel["incidence_per_100k"].astype("Float64")
    feat = add_spatial_features(panel, adj)
    for col in SPATIAL_FEATURE_COLS:
        assert feat[col].dtype == "float64", col


def test_spatial_neighbor_mean_skips_missing_neighbors():
    from app.forecast.features import add_spatial_features

    panel, adj = _spatial_panel_and_adj()
    # tinh c thieu du lieu o thang index 3 (2015-04): b phai lay mean chi tu a
    panel.loc[
        (panel.province_id == "c") & (panel.month == pd.Timestamp("2015-04-01")),
        "incidence_per_100k",
    ] = np.nan
    feat = add_spatial_features(panel, adj)
    row = feat[(feat.province_id == "b") & (feat.month == pd.Timestamp("2015-06-01"))]
    assert row["nb_mean_lag_2"].iloc[0] == pytest.approx(8.0)  # chi tinh a (x1)
    assert row["nb_max_lag_2"].iloc[0] == pytest.approx(8.0)
