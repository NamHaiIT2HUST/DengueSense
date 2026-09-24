"""exp_011 — Bài toán B (cảnh báo vượt ngưỡng P75, docs/02 §5.2-5.3) từ dự báo M4-R2.

Bước 1 (file này): sinh dự báo M4-R2 cho từng (origin, horizon, tỉnh) trên cửa
sổ VALIDATION (10 origin ≤2008-12, để FIT bộ hiệu chỉnh) và OUTER (8 origin, để
ĐÁNH GIÁ), kèm ngưỡng P75 nhân quả (lịch sử ≤ train_end, đúng tháng dương lịch
của tỉnh đó) và dân số tháng dự báo (cho đuôi Poisson). Bước 2: `analyze.py`.

Chạy: python -u experiments/exp_011_alerting/run.py  (từ ai-service/)
"""

from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import pandas as pd

from app.forecast.alerting import exceedance_thresholds
from app.forecast.backtest import build_horizon_pairs, load_real_panel_with_features
from app.forecast.m4 import predict_m4
from app.forecast.splits import assert_test_is_real_only, make_splits

HORIZONS = (1, 2, 3, 6)
REPORTING_DELAY_MONTHS = 1
VAL_CUTOFF = pd.Timestamp("2008-12-01")
VAL_N_ORIGINS = 10
OUTER_N_ORIGINS = 8
EMBARGO_MONTHS = 1

_OUT_PATH = Path(__file__).resolve().parent / "predictions.json"
_REGION_PATH = _ROOT / "data" / "external" / "province_metadata.csv"


def run_window(panel, splits, regions, window) -> list[dict]:
    cache = {h: build_horizon_pairs(panel, h) for h in HORIZONS}
    rows = []
    for split in splits:
        hist = panel[panel["month"] <= split.train_end]
        for h in split.usable_horizons:
            target_month = split.target_month(h)
            assert_test_is_real_only(panel, target_month)
            hp = cache[h]
            train_pairs = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["y_target"])
            test_rows = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
            if test_rows.empty or train_pairs.empty:
                continue
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                pred = predict_m4(train_pairs, test_rows, hist, target_month, regions)
            thr = exceedance_thresholds(hist, target_month, 0.75)
            for r in test_rows.itertuples():
                p = r.province_id
                if p not in thr:
                    continue
                rows.append(
                    {
                        "window": window,
                        "origin": split.origin,
                        "train_end": str(split.train_end.date()),
                        "horizon": h,
                        "target_month": str(target_month.date()),
                        "province_id": p,
                        "region": regions.get(p, "?"),
                        "pred": float(pred[p]),
                        "y_true": float(r.y_target),
                        "thr": float(thr[p]),
                        "population": float(r.population_target),
                    }
                )
            print(f"[{window} origin {split.origin}] h={h} xong.")
    return rows


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
    rows = run_window(val_panel, val_splits, regions, "validation")
    outer_splits = make_splits(
        feat_panel,
        n_origins=OUTER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    rows += run_window(feat_panel, outer_splits, regions, "outer")
    _OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(f"Đã ghi {len(rows)} dòng vào {_OUT_PATH}")
