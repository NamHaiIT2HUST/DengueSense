"""exp_010 — Kiểm định độ vững của M4-R2 (docs/02 §4.4):
  - NHIỄU khí hậu: nhân (1 + N(0, σ)) lên temp_mean/precip_total/humidity_mean
    THÔ theo từng (tỉnh, tháng, biến), σ ∈ {5%, 10%}, rồi dựng lại đặc trưng;
  - KHUYẾT THIẾU: bỏ ngẫu nhiên 10%/20% giá trị khí hậu thô → NaN, dựng lại đặc trưng
    (lag/rolling lan truyền NaN đúng như khi pipeline dữ liệu gián đoạn thật);
  - GIẢM THIỂU: cùng khuyết 10%/20% nhưng điền khuyết NHÂN QUẢ (trung bình cùng tháng
    dương lịch các năm trước, `features.impute_climate_causal`) trước khi dựng đặc trưng.

Kịch bản: model HUẤN LUYỆN trên dữ liệu sạch, chỉ đầu vào lúc DỰ BÁO (đặc trưng
tại origin) bị nhiễu/khuyết — mô phỏng lỗi/đứt cảm biến/API khi vận hành. Fit
một lần mỗi (origin, horizon) rồi dự báo cho mọi bản nhiễu (`predict_m4_many`).
Mỗi điều kiện lặp R lần với seed khác nhau. Chưa kiểm được: nhiễu/khuyết ở dữ
liệu HUẤN LUYỆN, và "năm bất thường 2020-2021/2023" (dữ liệu real kết thúc 2010).

Chạy: python -u experiments/exp_010_robustness/run.py  (từ ai-service/)
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
    TARGET,
    build_horizon_pairs,
    compute_train_naive_errors,
)
from app.forecast.features import (
    CLIMATE_COLS,
    build_feature_matrix,
    impute_climate_causal,
)
from app.forecast.m4 import predict_m4_many
from app.forecast.splits import assert_test_is_real_only, make_splits

HORIZONS = (1, 2, 3, 6)
N_ORIGINS = 8
EMBARGO_MONTHS = 1
REPORTING_DELAY_MONTHS = 1
OUTBREAK_QUANTILE = 0.90
REPS = 10

CONDITIONS = {
    "clean": {"noise": 0.0, "missing": 0.0},
    "noise_5": {"noise": 0.05, "missing": 0.0},
    "noise_10": {"noise": 0.10, "missing": 0.0},
    "missing_10": {"noise": 0.0, "missing": 0.10},
    "missing_20": {"noise": 0.0, "missing": 0.20},
    # bien phap giam thieu: dien khuyet NHAN QUA bang trung binh cung thang cac nam truoc
    "missing_10_imputed": {"noise": 0.0, "missing": 0.10, "impute": True},
    "missing_20_imputed": {"noise": 0.0, "missing": 0.20, "impute": True},
}

_PANEL_PATH = _ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
_REGION_PATH = _ROOT / "data" / "external" / "province_metadata.csv"
_OUT_PATH = Path(__file__).resolve().parent / "results.json"


def perturb_panel(real: pd.DataFrame, cond: dict, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    df = real.copy()
    for col in CLIMATE_COLS:
        x = df[col].to_numpy(dtype="float64").copy()
        if cond["noise"] > 0:
            x = x * (1.0 + rng.normal(0.0, cond["noise"], size=len(x)))
        if cond["missing"] > 0:
            x[rng.random(len(x)) < cond["missing"]] = np.nan
        df[col] = x
    if cond.get("impute"):
        df = impute_climate_causal(df)
    return df


def _keep_test_months(hp: pd.DataFrame) -> pd.DataFrame:
    """Chỉ giữ tháng có thể là origin (từ 2009-11) — tiết kiệm bộ nhớ, 41 bản nhiễu."""
    return hp[hp["month"] >= pd.Timestamp("2009-11-01")]


def featurize(real: pd.DataFrame) -> pd.DataFrame:
    return build_feature_matrix(real, reporting_delay_months=REPORTING_DELAY_MONTHS)


def main() -> None:
    panel = pd.read_parquet(_PANEL_PATH)
    real = panel[panel["data_source"] == "real"].copy()
    real = real.sort_values(["province_id", "month"]).reset_index(drop=True)
    meta = pd.read_csv(_REGION_PATH)
    regions = dict(zip(meta["new_province_code"], meta["region"]))

    clean_feat = featurize(real)
    clean_hp = {h: build_horizon_pairs(clean_feat, h) for h in HORIZONS}

    # ban nhieu: (condition, rep) -> {h: hp}; 'clean' chi 1 lan
    variants: list[tuple[str, int]] = [("clean", 0)] + [
        (name, r) for name in CONDITIONS if name != "clean" for r in range(REPS)
    ]
    hp_by_variant: dict[tuple[str, int], dict[int, pd.DataFrame]] = {
        ("clean", 0): clean_hp
    }
    for name, r in variants[1:]:
        seed = 1000 * (list(CONDITIONS).index(name) + 1) + r
        feat = featurize(perturb_panel(real, CONDITIONS[name], seed))
        hp_by_variant[(name, r)] = {
            h: _keep_test_months(build_horizon_pairs(feat, h)) for h in HORIZONS
        }
        print(f"[dựng đặc trưng] {name} rep {r}")

    splits = make_splits(
        clean_feat,
        n_origins=N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    rows = []
    for split in splits:
        hist = clean_feat[clean_feat["month"] <= split.train_end]
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
            assert_test_is_real_only(clean_feat, target_month)
            hp = clean_hp[h]
            train_pairs = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["y_target"])
            clean_test = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
            if clean_test.empty or train_pairs.empty:
                continue
            keep = clean_test["province_id"].tolist()
            frames = []
            for key in variants:
                t = hp_by_variant[key][h]
                t = t[(t["month"] == split.train_end) & t["province_id"].isin(keep)]
                frames.append(t.set_index("province_id").loc[keep].reset_index())
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                preds = predict_m4_many(
                    train_pairs, frames, hist, target_month, regions
                )
            y_true = clean_test.set_index("province_id")["y_target"]
            for (name, rep), frame, pred in zip(variants, frames, preds):
                n_missing_feat = int(frame.isna().any(axis=1).sum())
                for p, yt in y_true.items():
                    rows.append(
                        {
                            "condition": name,
                            "rep": rep,
                            "origin": split.origin,
                            "horizon": h,
                            "province_id": p,
                            "region": regions.get(p, "?"),
                            "y_true": float(yt),
                            "pred": float(pred[p]),
                            "pooled_scale": pooled_scale,
                            "region_scale": reg_scale.get(regions.get(p)),
                            "is_outbreak": bool(yt > p90[p]),
                            "rows_with_nan_features": n_missing_feat,
                        }
                    )
            print(f"[origin {split.origin}] h={h} xong.")

    _OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(f"Đã ghi {len(rows)} dòng vào {_OUT_PATH}")


if __name__ == "__main__":
    main()
