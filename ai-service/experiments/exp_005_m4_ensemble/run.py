"""exp_005 — M4 Ensemble (docs/02 §7): E1 trung bình đơn giản + E2 trung
bình có trọng số (nghịch đảo sai số validation), thành viên M1 GLM NegBin +
M2a XGBoost + M2b LightGBM (T1 default, xem exp_002). M3 hhh4 KHÔNG đưa vào
— đã quyết định loại ở exp_004 (thua mọi model khác mọi horizon, cả 2 bản
có/không khí hậu).

Trọng số E2 ước lượng trên cửa sổ VALIDATION riêng (10 origin, dữ liệu
<= 2008-12 — cùng cutoff với exp_003's inner window) — KHÔNG dùng chính 8
outer origin để vừa ước lượng trọng số vừa đánh giá (sẽ là rò rỉ/lạc quan
giả tạo, đúng nguyên tắc tách inner/outer đã áp dụng xuyên suốt dự án).

Chạy: python experiments/exp_005_m4_ensemble/run.py   (từ ai-service/)
"""

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import pandas as pd

from app.forecast.ensemble import combine_ensemble, validation_error_weights
from app.forecast.features import build_feature_matrix
from app.forecast.metrics import mae, mase
from app.forecast.models import (
    fit_predict_m1_glm_negbin,
    fit_predict_m2_lightgbm,
    fit_predict_m2_xgboost,
)
from app.forecast.splits import assert_test_is_real_only, make_splits

TARGET = "incidence_per_100k"
HORIZONS = (1, 2, 3, 6)
REPORTING_DELAY_MONTHS = 1

VALIDATION_CUTOFF = pd.Timestamp("2008-12-01")
VALIDATION_N_ORIGINS = 10
VALIDATION_EMBARGO_MONTHS = 1

OUTER_N_ORIGINS = 8
OUTER_EMBARGO_MONTHS = 1

MEMBERS = ("M1_glm_negbin", "M2a_xgboost", "M2b_lightgbm")

# Giong het exp_002 - cung 1 tap dac trung T1 mac dinh de M1/M2a/M2b o day
# la DUNG Y HET cau hinh da danh gia o exp_002, khong phai ban khac.
FEATURE_COLS = [
    "sin_month",
    "cos_month",
    "temp_mean_lag_1",
    "temp_mean_lag_2",
    "precip_total_lag_1",
    "precip_total_lag_2",
    "humidity_mean_lag_1",
    "temp_mean_roll_mean_3",
    "precip_total_roll_mean_3",
    "incidence_per_100k_lag_2",
    "incidence_per_100k_lag_3",
    "momentum",
    "acceleration",
    "oni_lag_3",
    "oni_lag_6",
    "incidence_per_100k_same_month_last_year",
    "incidence_per_100k_deviation_from_median",
]

_PANEL_PATH = _ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
_OUT_PATH = Path(__file__).resolve().parent / "results.json"


def load_real_panel_with_features() -> pd.DataFrame:
    panel = pd.read_parquet(_PANEL_PATH)
    real = panel[panel["data_source"] == "real"].copy()
    real = real.sort_values(["province_id", "month"]).reset_index(drop=True)
    return build_feature_matrix(real, reporting_delay_months=REPORTING_DELAY_MONTHS)


def build_horizon_pairs(feat_panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    incidence_lookup = feat_panel.set_index(["province_id", "month"])[
        "incidence_per_100k"
    ]
    cases_lookup = feat_panel.set_index(["province_id", "month"])["cases"]
    population_lookup = feat_panel.set_index(["province_id", "month"])["population"]

    df = feat_panel.copy()
    target_months = df["month"] + pd.DateOffset(months=horizon)
    idx = pd.MultiIndex.from_arrays([df["province_id"], target_months])
    df["y_target"] = incidence_lookup.reindex(idx).to_numpy(
        dtype="float64", na_value=np.nan
    )
    df["cases_target"] = cases_lookup.reindex(idx).to_numpy(
        dtype="float64", na_value=np.nan
    )
    df["population_target"] = population_lookup.reindex(idx).to_numpy(
        dtype="float64", na_value=np.nan
    )
    df["_target_month"] = target_months
    return df


def compute_train_naive_errors(train_df: pd.DataFrame) -> np.ndarray:
    errors = []
    for _, g in train_df.groupby("province_id"):
        g = g.set_index("month")[TARGET].sort_index()
        shifted = g.shift(12)
        errors.extend((g - shifted).dropna().abs().tolist())
    return np.array(errors)


def get_member_predictions(
    train_pairs: pd.DataFrame, test_rows: pd.DataFrame
) -> dict[str, dict[str, float]]:
    """Fit + predict M1/M2a/M2b (T1 default) cho 1 (origin, horizon) —
    trả về {model_name: {province_id: pred}}. M1 có thể lỗi hội tụ (đã biết
    từ exp_002, ~2/32 tổ hợp) — bỏ qua model đó cho đúng origin/horizon này,
    KHÔNG loại cả origin/horizon (E1/E2 tự re-normalize trên model còn lại)."""
    m1_train = train_pairs.drop(columns=["population"]).rename(
        columns={"cases_target": "_m1_target", "population_target": "population"}
    )
    m1_test = test_rows.drop(columns=["population"]).rename(
        columns={"population_target": "population"}
    )

    preds: dict[str, dict[str, float]] = {}
    try:
        m1_pred = fit_predict_m1_glm_negbin(
            m1_train, m1_test, FEATURE_COLS, target_col="_m1_target"
        )
        preds["M1_glm_negbin"] = dict(zip(test_rows["province_id"], m1_pred))
    except Exception as exc:  # noqa: BLE001 - bo qua M1 rieng fold nay
        print(f"  M1 lỗi (bỏ qua fold này): {exc}")

    m2a_pred = fit_predict_m2_xgboost(
        train_pairs, test_rows, FEATURE_COLS, target_col="y_target"
    )
    preds["M2a_xgboost"] = dict(zip(test_rows["province_id"], m2a_pred))

    m2b_pred = fit_predict_m2_lightgbm(
        train_pairs, test_rows, FEATURE_COLS, target_col="y_target"
    )
    preds["M2b_lightgbm"] = dict(zip(test_rows["province_id"], m2b_pred))
    return preds


def _evaluate_origins(
    feat_panel: pd.DataFrame,
    splits,
    horizon_pairs_cache: dict[int, pd.DataFrame],
    weights: dict[str, float] | None,
    label_prefix: str,
) -> list[dict]:
    rows: list[dict] = []
    for split in splits:
        raw_train_for_naive = feat_panel[feat_panel["month"] <= split.train_end]
        train_naive_errors = compute_train_naive_errors(raw_train_for_naive)

        for h in split.usable_horizons:
            target_month = split.target_month(h)
            assert_test_is_real_only(feat_panel, target_month)

            hp = horizon_pairs_cache[h]
            train_pairs = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["y_target"])
            test_rows = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
            if test_rows.empty or train_pairs.empty:
                continue
            y_true = test_rows.set_index("province_id")["y_target"]
            provinces = test_rows["province_id"].tolist()

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                member_preds = get_member_predictions(train_pairs, test_rows)

            all_preds = dict(member_preds)
            all_preds["E1_simple_avg"] = combine_ensemble(member_preds, provinces)
            if weights is not None:
                all_preds["E2_weighted_avg"] = combine_ensemble(
                    member_preds, provinces, weights=weights
                )

            for model_name, preds in all_preds.items():
                y_pred = pd.Series(preds).reindex(y_true.index)
                valid = y_pred.notna() & y_true.notna()
                if valid.sum() == 0:
                    continue
                rows.append(
                    {
                        "origin": split.origin,
                        "train_end": str(split.train_end.date()),
                        "horizon": h,
                        "target_month": str(target_month.date()),
                        "model": model_name,
                        "n_provinces": int(valid.sum()),
                        "mae": mae(y_true[valid], y_pred[valid]),
                        "mase": mase(y_true[valid], y_pred[valid], train_naive_errors),
                    }
                )
            print(f"[{label_prefix} origin {split.origin}] h={h} xong.")
    return rows


def estimate_validation_weights(feat_panel: pd.DataFrame) -> dict[str, float]:
    """Chạy M1/M2a/M2b trên cửa sổ validation (10 origin, <= 2008-12, tách
    biệt khỏi outer) — trọng số E2 = nghịch đảo MASE trung bình (gộp mọi
    horizon), chuẩn hoá về tổng 1."""
    val_panel = feat_panel[feat_panel["month"] <= VALIDATION_CUTOFF]
    val_splits = make_splits(
        val_panel,
        n_origins=VALIDATION_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=VALIDATION_EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    val_cache = {h: build_horizon_pairs(val_panel, h) for h in HORIZONS}
    rows = _evaluate_origins(
        val_panel, val_splits, val_cache, weights=None, label_prefix="VAL"
    )

    df = pd.DataFrame(rows)
    avg_mase = df[df["model"].isin(MEMBERS)].groupby("model")["mase"].mean()
    weights = validation_error_weights(avg_mase.to_dict())
    print("\nMASE trung bình trên validation (10 origin, <=2008-12):")
    print(avg_mase.round(4).to_string())
    print("Trọng số E2:", {k: round(v, 4) for k, v in weights.items()})
    return weights


def run() -> tuple[list[dict], dict[str, float]]:
    feat_panel = load_real_panel_with_features()

    weights = estimate_validation_weights(feat_panel)

    outer_splits = make_splits(
        feat_panel,
        n_origins=OUTER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=OUTER_EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    outer_cache = {h: build_horizon_pairs(feat_panel, h) for h in HORIZONS}
    rows = _evaluate_origins(
        feat_panel, outer_splits, outer_cache, weights=weights, label_prefix="OUTER"
    )
    return rows, weights


def summarize(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    return (
        df.groupby(["model", "horizon"])
        .agg(
            mase_mean=("mase", "mean"),
            mase_std=("mase", "std"),
            mae_mean=("mae", "mean"),
        )
        .reset_index()
    )


if __name__ == "__main__":
    _rows, _weights = run()
    _OUT_PATH.write_text(
        json.dumps({"weights": _weights, "rows": _rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    _summary = summarize(_rows)
    pd.set_option("display.width", 120)
    print()
    print(_summary.pivot(index="model", columns="horizon", values="mase_mean").round(4))
    print(f"\nĐã ghi {len(_rows)} dòng kết quả chi tiết vào {_OUT_PATH}")
