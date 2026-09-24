"""exp_009 — TÍN HIỆU MỚI cho 2 điểm yếu còn lại của M4 (miền Bắc >1, bias bùng
dịch −15): đặc trưng lan truyền không gian (ca bệnh tỉnh kề, toàn quốc ở t-2,
t-3; nhân quả). exp_006-008 kết luận "cần tín hiệu mới, không chỉ đổi loss".

Biến thể khai báo TRƯỚC khi chạy (ensemble GBM = (M2a XGBoost + M2b LightGBM)/2,
tham số T1, Poisson; cột mới nối vào CUỐI danh sách — GBM nhạy thứ tự cột):
  S0 baseline V0 (17 đặc trưng T1)            S5 V3 scale-aware (không không gian)
  S1 V0 + láng giềng (3 cột)                  S4 V3 + cả 5 cột không gian (extra_cols)
  S2 V0 + toàn quốc (2 cột)
  S3 V0 + cả 5 cột không gian

Chọn theo VALIDATION (10 origin ≤2008-12), quy tắc khai báo trước:
 - toàn cục: S1/S2/S3 được nhận nếu MASE gộp không tệ hơn S0 quá 1% VÀ (MASE bùng
   dịch hoặc trung bình MASE 3 vùng giảm ≥ 5%);
 - Bắc: dùng S4 thay S5 nếu MASE vùng Bắc trên validation giảm > 10%.
Outer chỉ để xác nhận/báo cáo.

Chạy: python -u experiments/exp_009_spatial_signal/run.py  (từ ai-service/)
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

from app.data.adjacency import build_adjacency_matrix
from app.forecast.backtest import (
    FEATURE_COLS_T1,
    TARGET,
    build_horizon_pairs,
    compute_train_naive_errors,
    load_real_panel_with_features,
)
from app.forecast.features import SPATIAL_FEATURE_COLS, add_spatial_features
from app.forecast.models import (
    SCALE_AWARE_CASE_COLS,
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

NB = ["nb_mean_lag_2", "nb_mean_lag_3", "nb_max_lag_2"]
NAT = ["nat_mean_lag_2", "nat_mom"]
NONCASE = [c for c in FEATURE_COLS_T1 if c not in SCALE_AWARE_CASE_COLS]
SCALE = ["prov_mean_hist", "prov_mean_12m"]
assert set(NB + NAT) == set(SPATIAL_FEATURE_COLS)

VARIANTS = {
    "S0_baseline": {"kind": "plain", "cols": FEATURE_COLS_T1},
    "S1_neighbors": {"kind": "plain", "cols": FEATURE_COLS_T1 + NB},
    "S2_national": {"kind": "plain", "cols": FEATURE_COLS_T1 + NAT},
    "S3_all_spatial": {"kind": "plain", "cols": FEATURE_COLS_T1 + NB + NAT},
    "S5_v3": {"kind": "v3", "noncase": NONCASE, "extra": SCALE},
    "S4_v3_spatial": {"kind": "v3", "noncase": NONCASE, "extra": SCALE + NB + NAT},
}

_OUT_PATH = Path(__file__).resolve().parent / "results.json"
_REGION_PATH = _ROOT / "data" / "external" / "province_metadata.csv"


def _split_data(hp, split):
    train_pairs = hp[
        (hp["month"] <= split.train_end) & (hp["_target_month"] <= split.train_end)
    ].dropna(subset=["y_target"])
    test_rows = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
    return train_pairs.copy(), test_rows.copy()


def predict_variant(name, train_pairs, test_rows) -> dict[str, float]:
    cfg = VARIANTS[name]
    preds = []
    for fn in (fit_predict_m2_xgboost, fit_predict_m2_lightgbm):
        if cfg["kind"] == "plain":
            arr = fn(train_pairs, test_rows, cfg["cols"], target_col="y_target")
        else:
            arr = fit_predict_scale_aware(
                fn,
                train_pairs,
                test_rows,
                cfg["noncase"],
                case_cols=SCALE_AWARE_CASE_COLS,
                extra_cols=cfg["extra"],
            )
        preds.append(np.asarray(arr, dtype=float))
    return dict(zip(test_rows["province_id"], np.mean(preds, axis=0).tolist()))


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
                            "pred": float(preds[p]),
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
    feat_panel = add_spatial_features(
        load_real_panel_with_features(),
        build_adjacency_matrix(),
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
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
