"""exp_008 — thử các "đòn bẩy" cho 2 điểm yếu còn lại của M4-R (exp_007): bias
dự báo thấp khi bùng dịch (−15) và miền Bắc vẫn > 1. Áp lên phần GBM của
M4-R (M2a+M2b, định tuyến Bắc→V3 scale-aware, Trung/Nam→V0).

Đòn bẩy khai báo TRƯỚC khi chạy (mỗi cái độc lập, không thử tổ hợp trước):
  C0 control  : Poisson, không trọng số (= GBM của M4-R)
  C1 tweedie  : objective Tweedie (variance_power 1.5) thay Poisson
  C2 weighted : trọng số mẫu 3x cho dòng train có target > p90 của tỉnh (p90
                tính CHỈ trên train_pairs của origin đó)
  C3 blend B3 : 0.5*GBM + 0.5*Climatology (B3, mốc mạnh nhất exp_001)

QUY TẮC CHẤP NHẬN (khai báo trước, đánh giá trên VALIDATION 10 origin ≤2008-12):
đòn bẩy được nhận nếu MASE gộp không tệ hơn C0 quá 1% VÀ (MASE bùng dịch hoặc
reg_avg giảm ≥ 5%). Outer chỉ để xác nhận/báo cáo, không dùng để chọn.

Chạy: python -u experiments/exp_008_outbreak_north/run.py  (từ ai-service/)
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

from app.forecast.backtest import (
    FEATURE_COLS_T1,
    TARGET,
    build_horizon_pairs,
    compute_train_naive_errors,
    load_real_panel_with_features,
)
from app.forecast.models import (
    fit_predict_m2_lightgbm,
    fit_predict_m2_xgboost,
    fit_predict_scale_aware,
)
from app.forecast.splits import assert_test_is_real_only, make_splits

HORIZONS = (1, 2, 3, 6)
REPORTING_DELAY_MONTHS = 1
VAL_CUTOFF = pd.Timestamp("2008-12-01")
VAL_N_ORIGINS = 10
OUTER_N_ORIGINS = 8
EMBARGO_MONTHS = 1
OUTBREAK_QUANTILE = 0.90
OUTBREAK_WEIGHT = 3.0
ROUTED_TO_V3 = ("Bắc",)  # ket qua exp_007 (chon bang validation)

CASE_COLS = [
    "incidence_per_100k_lag_2",
    "incidence_per_100k_lag_3",
    "momentum",
    "acceleration",
    "incidence_per_100k_same_month_last_year",
    "incidence_per_100k_deviation_from_median",
]
NONCASE_COLS = [c for c in FEATURE_COLS_T1 if c not in CASE_COLS]
SCALE_COLS = ["prov_mean_hist", "prov_mean_12m"]

LEVERS = {
    "C0_control": {"objective": None, "weights": False, "blend_b3": False},
    "C1_tweedie": {"objective": "tweedie", "weights": False, "blend_b3": False},
    "C2_weighted": {"objective": None, "weights": True, "blend_b3": False},
    "C3_blend_B3": {"objective": None, "weights": False, "blend_b3": True},
}

_OUT_PATH = Path(__file__).resolve().parent / "results.json"
_REGION_PATH = _ROOT / "data" / "external" / "province_metadata.csv"


def _split_data(hp, split):
    train_pairs = hp[
        (hp["month"] <= split.train_end) & (hp["_target_month"] <= split.train_end)
    ].dropna(subset=["y_target"])
    test_rows = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
    return train_pairs.copy(), test_rows.copy()


def _objective(fit_name: str, lever: dict) -> str | None:
    if lever["objective"] == "tweedie":
        return "reg:tweedie" if fit_name == "xgb" else "tweedie"
    return None


def _fit_kwargs(fit_name: str, lever: dict) -> dict:
    kw: dict = {}
    obj = _objective(fit_name, lever)
    if obj:
        kw["objective"] = obj
        kw["params"] = {"tweedie_variance_power": 1.5}
    if lever["weights"]:
        kw["weight_col"] = "_w"
    return kw


def gbm_predict(train_pairs, test_rows, lever, regions) -> dict[str, float]:
    """(M2a+M2b)/2 với định tuyến vùng: Bắc -> V3 scale-aware, còn lại V0."""
    tr = train_pairs.copy()
    p90 = tr.groupby("province_id")["y_target"].transform(
        lambda s: s.quantile(OUTBREAK_QUANTILE)
    )
    tr["_w"] = np.where(tr["y_target"] > p90, OUTBREAK_WEIGHT, 1.0)
    out: dict[str, float] = {}
    per_variant: dict[str, dict[str, float]] = {"V0": {}, "V3": {}}
    for fit_name, fn in [
        ("xgb", fit_predict_m2_xgboost),
        ("lgb", fit_predict_m2_lightgbm),
    ]:
        kw = _fit_kwargs(fit_name, lever)
        v0 = np.asarray(
            fn(tr, test_rows, FEATURE_COLS_T1, target_col="y_target", **kw), float
        )
        v3 = fit_predict_scale_aware(
            fn,
            tr,
            test_rows,
            NONCASE_COLS,
            case_cols=CASE_COLS,
            extra_cols=SCALE_COLS,
            **kw,
        )
        for name, arr in (("V0", v0), ("V3", v3)):
            for p, v in zip(test_rows["province_id"], arr):
                per_variant[name].setdefault(p, []).append(float(v))
    for p in test_rows["province_id"]:
        use_v3 = regions.get(p) in ROUTED_TO_V3
        vals = per_variant["V3" if use_v3 else "V0"][p]
        out[p] = float(np.mean(vals))
    return out


def b3_predict(hist: pd.DataFrame, target_month: pd.Timestamp) -> dict[str, float]:
    sub = hist[hist["month"].dt.month == target_month.month]
    return sub.groupby("province_id")[TARGET].mean().to_dict()


def run_window(feat_panel, splits, cache, regions, window) -> list[dict]:
    rows = []
    for split in splits:
        hist = feat_panel[feat_panel["month"] <= split.train_end]
        pooled_scale = float(np.mean(compute_train_naive_errors(hist)))
        reg_scale = {
            r: float(
                np.mean(
                    compute_train_naive_errors(
                        hist[hist["province_id"].map(regions) == r]
                    )
                )
            )
            for r in ("Bắc", "Trung", "Nam")
        }
        p90 = hist.groupby("province_id")[TARGET].quantile(OUTBREAK_QUANTILE)
        for h in split.usable_horizons:
            target_month = split.target_month(h)
            assert_test_is_real_only(feat_panel, target_month)
            train_pairs, test_rows = _split_data(cache[h], split)
            if test_rows.empty or train_pairs.empty:
                continue
            y_true = test_rows.set_index("province_id")["y_target"]
            b3 = b3_predict(hist, target_month)
            for lname, lever in LEVERS.items():
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    preds = gbm_predict(train_pairs, test_rows, lever, regions)
                for p, yt in y_true.items():
                    pred = preds[p]
                    if lever["blend_b3"] and p in b3:
                        pred = 0.5 * pred + 0.5 * b3[p]
                    region = regions.get(p, "?")
                    rows.append(
                        {
                            "window": window,
                            "variant": lname,
                            "origin": split.origin,
                            "horizon": h,
                            "province_id": p,
                            "region": region,
                            "y_true": float(yt),
                            "pred": float(pred),
                            "pooled_scale": pooled_scale,
                            "region_scale": reg_scale.get(region),
                            "is_outbreak": bool(yt > p90[p]),
                        }
                    )
            print(f"[{window} origin {split.origin}] h={h} xong.")
    return rows


def summarize(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    df["e_pool"] = (df["y_true"] - df["pred"]).abs() / df["pooled_scale"]
    df["e_reg"] = (df["y_true"] - df["pred"]).abs() / df["region_scale"]
    out = []
    for (w, v), g in df.groupby(["window", "variant"]):
        reg = g.groupby("region")["e_reg"].mean()
        ob = g[g["is_outbreak"]]
        out.append(
            {
                "window": w,
                "variant": v,
                "mase_pooled": g["e_pool"].mean(),
                "mase_h1": g[g.horizon == 1]["e_pool"].mean(),
                "mase_h3": g[g.horizon == 3]["e_pool"].mean(),
                "mase_h6": g[g.horizon == 6]["e_pool"].mean(),
                "reg_Bac": reg["Bắc"],
                "reg_Trung": reg["Trung"],
                "reg_Nam": reg["Nam"],
                "reg_avg": reg.mean(),
                "outbreak_mase": ob["e_pool"].mean(),
                "outbreak_bias": (ob["pred"] - ob["y_true"]).mean(),
                "bias_all": (g["pred"] - g["y_true"]).mean(),
            }
        )
    return pd.DataFrame(out)


if __name__ == "__main__":
    feat_panel = load_real_panel_with_features()
    meta = pd.read_csv(_REGION_PATH)
    regions = dict(zip(meta["new_province_code"], meta["region"]))

    val_panel = feat_panel[feat_panel["month"] <= VAL_CUTOFF]
    val_splits = make_splits(
        val_panel,
        n_origins=VAL_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    rows = run_window(
        val_panel,
        val_splits,
        {h: build_horizon_pairs(val_panel, h) for h in HORIZONS},
        regions,
        "validation",
    )
    outer_splits = make_splits(
        feat_panel,
        n_origins=OUTER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    rows += run_window(
        feat_panel,
        outer_splits,
        {h: build_horizon_pairs(feat_panel, h) for h in HORIZONS},
        regions,
        "outer",
    )
    _OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    pd.set_option("display.width", 200)
    summary = summarize(rows)
    print()
    print(summary.round(3).to_string(index=False))
    summary.round(4).to_csv(
        Path(__file__).resolve().parent / "summary.csv", index=False
    )
