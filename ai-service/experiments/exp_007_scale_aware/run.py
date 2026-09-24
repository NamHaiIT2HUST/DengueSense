"""exp_007 — sửa 2 điểm yếu M4 lộ ra ở exp_006: (1) thua seasonal-naive ở miền
Bắc (model pooled dự báo dương sàn quá cao ở tỉnh incidence ≈ 0), (2) bias
trái dấu giữa các vùng + dự báo thấp khi bùng dịch. Giả thuyết: model pooled
không biết QUY MÔ riêng từng tỉnh.

4 biến thể GBM (M2a XGBoost + M2b LightGBM, tham số T1 mặc định, ensemble
E1_gbm = trung bình 2 model), khai báo TRƯỚC khi chạy:
  V0  baseline: 17 đặc trưng T1, target tuyệt đối (= exp_005/006)
  V1  V0 + quy mô tỉnh (prov_mean_hist, prov_mean_12m — nhân quả, tới t-D)
  V2  V1 + target là TỈ LỆ y/(prov_mean_hist+1), dự báo nhân lại quy mô
  V3  V2 + các đặc trưng ca bệnh chia cho quy mô (lag/momentum/... tương đối)

CHỌN biến thể theo cửa sổ VALIDATION (10 origin, ≤2008-12; tách khỏi outer),
tiêu chí khai báo trước: trung bình MASE 3 vùng (mẫu số riêng từng vùng),
không dùng outer để chọn. Outer báo cáo đầy đủ cho mọi biến thể (minh bạch).

Chạy: python -u experiments/exp_007_scale_aware/run.py  (từ ai-service/)
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
from app.forecast.models import fit_predict_m2_lightgbm, fit_predict_m2_xgboost
from app.forecast.splits import assert_test_is_real_only, make_splits

HORIZONS = (1, 2, 3, 6)
REPORTING_DELAY_MONTHS = 1
VAL_CUTOFF = pd.Timestamp("2008-12-01")
VAL_N_ORIGINS = 10
OUTER_N_ORIGINS = 8
EMBARGO_MONTHS = 1
OUTBREAK_QUANTILE = 0.90
SCALE_SHIFT = 1.0  # quy mo = prov_mean_hist + 1 (co giai dinh tinh khi baseline ~ 0)

BASE_COLS = FEATURE_COLS_T1
SCALE_COLS = ["prov_mean_hist", "prov_mean_12m"]
# dac trung ca benh tuyet doi -> phien ban tuong doi (chia cho quy mo) o V3
CASE_COLS = [
    "incidence_per_100k_lag_2",
    "incidence_per_100k_lag_3",
    "momentum",
    "acceleration",
    "incidence_per_100k_same_month_last_year",
    "incidence_per_100k_deviation_from_median",
]
NONCASE_COLS = [c for c in BASE_COLS if c not in CASE_COLS]
REL_COLS = [f"{c}__rel" for c in CASE_COLS]

VARIANTS = {
    "V0_baseline": {"cols": BASE_COLS, "ratio": False, "rel": False},
    "V1_scale_features": {"cols": BASE_COLS + SCALE_COLS, "ratio": False, "rel": False},
    "V2_ratio_target": {"cols": BASE_COLS + SCALE_COLS, "ratio": True, "rel": False},
    "V3_ratio_rel_features": {
        "cols": NONCASE_COLS + REL_COLS + SCALE_COLS,
        "ratio": True,
        "rel": True,
    },
}

_OUT_PATH = Path(__file__).resolve().parent / "results.json"
_REGION_PATH = _ROOT / "data" / "external" / "province_metadata.csv"


def _split_data(hp, split):
    train_pairs = hp[
        (hp["month"] <= split.train_end) & (hp["_target_month"] <= split.train_end)
    ].dropna(subset=["y_target"])
    test_rows = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
    return train_pairs.copy(), test_rows.copy()


def _add_rel(df: pd.DataFrame) -> pd.DataFrame:
    scale = df["prov_mean_hist"] + SCALE_SHIFT
    for c in CASE_COLS:
        df[f"{c}__rel"] = df[c] / scale
    return df


def predict_variant(name, train_pairs, test_rows) -> dict[str, dict[str, float]]:
    cfg = VARIANTS[name]
    tr, te = train_pairs.copy(), test_rows.copy()
    if cfg["rel"]:
        tr, te = _add_rel(tr), _add_rel(te)
    target_col = "y_target"
    te_scale = np.ones(len(te))
    if cfg["ratio"]:
        tr["y_ratio"] = tr["y_target"] / (tr["prov_mean_hist"] + SCALE_SHIFT)
        te_scale = (te["prov_mean_hist"] + SCALE_SHIFT).to_numpy()
        target_col = "y_ratio"
    out = {}
    for mname, fn in [
        ("M2a_xgboost", fit_predict_m2_xgboost),
        ("M2b_lightgbm", fit_predict_m2_lightgbm),
    ]:
        p = np.asarray(fn(tr, te, cfg["cols"], target_col=target_col), dtype=float)
        p = np.clip(p * te_scale, 0.0, None)
        out[mname] = dict(zip(te["province_id"], p.tolist()))
    return out


def run_window(feat_panel, splits, cache, regions, window) -> list[dict]:
    rows = []
    for split in splits:
        hist = feat_panel[feat_panel["month"] <= split.train_end]
        pooled_scale = float(np.mean(compute_train_naive_errors(hist)))
        reg_scale = {}
        for r in ("Bắc", "Trung", "Nam"):
            sub = hist[hist["province_id"].map(regions) == r]
            reg_scale[r] = float(np.mean(compute_train_naive_errors(sub)))
        p90 = hist.groupby("province_id")[TARGET].quantile(OUTBREAK_QUANTILE)
        for h in split.usable_horizons:
            assert_test_is_real_only(feat_panel, split.target_month(h))
            train_pairs, test_rows = _split_data(cache[h], split)
            if test_rows.empty or train_pairs.empty:
                continue
            y_true = test_rows.set_index("province_id")["y_target"]
            for vname in VARIANTS:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    preds = predict_variant(vname, train_pairs, test_rows)
                for p, yt in y_true.items():
                    a, b = preds["M2a_xgboost"].get(p), preds["M2b_lightgbm"].get(p)
                    if a is None or b is None or np.isnan(a) or np.isnan(b):
                        continue
                    region = regions.get(p, "?")
                    rows.append(
                        {
                            "window": window,
                            "variant": vname,
                            "origin": split.origin,
                            "horizon": h,
                            "province_id": p,
                            "region": region,
                            "y_true": float(yt),
                            "pred": float((a + b) / 2),
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
    val_cache = {h: build_horizon_pairs(val_panel, h) for h in HORIZONS}
    rows = run_window(val_panel, val_splits, val_cache, regions, "validation")

    outer_splits = make_splits(
        feat_panel,
        n_origins=OUTER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    cache = {h: build_horizon_pairs(feat_panel, h) for h in HORIZONS}
    rows += run_window(feat_panel, outer_splits, cache, regions, "outer")

    _OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    pd.set_option("display.width", 200)
    summary = summarize(rows)
    print()
    print(summary.round(3).to_string(index=False))
    summary.round(4).to_csv(
        Path(__file__).resolve().parent / "summary.csv", index=False
    )
