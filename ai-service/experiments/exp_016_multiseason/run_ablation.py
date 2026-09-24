"""exp_016b — Ablation ĐỊNH TUYẾN VÙNG của M4-R2 qua 6 mùa: thiết kế (Bắc: scale-aware+Tweedie,
Nam: pha 50% Climatology) chọn trên validation ≤2008 và outer 2010 — có khái quát sang các
mùa khác không? 4 cấu hình, MỖI fold fit 1 lần (`predict_m4_routings`):
  M4-R2      : định tuyến mặc định (Bắc + Nam);
  no_routing : GBM chuẩn mọi vùng (= M4 ensemble đồng đều, exp_005);
  bac_only   : chỉ định tuyến Bắc;   nam_only : chỉ định tuyến Nam.

Có checkpoint theo mùa (chạy lại bỏ qua mùa đã xong).
Chạy: python -u experiments/exp_016_multiseason/run_ablation.py  (từ ai-service/)
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

from app.forecast.alert_classifier import with_thresholds
from app.forecast.backtest import (
    TARGET,
    build_horizon_pairs,
    compute_train_naive_errors,
    load_real_panel_with_features,
)
from app.forecast.m4 import ROUTING, predict_m4_routings
from app.forecast.multiseason import season_splits
from app.forecast.splits import assert_test_is_real_only

YEARS = [2005, 2006, 2007, 2008, 2009, 2010]
HORIZONS = (1, 2, 3, 6)
ROUTINGS = {
    "M4-R2": None,
    "no_routing": {},
    "bac_only": {"Bắc": ROUTING["Bắc"]},
    "nam_only": {"Nam": ROUTING["Nam"]},
}
_HERE = Path(__file__).resolve().parent
_OUT = _HERE / "results_ablation.json"


def run_season(panel_s, splits, regions, year) -> list[dict]:
    cache = {h: build_horizon_pairs(panel_s, h) for h in HORIZONS}
    reg_series = panel_s["province_id"].map(regions)
    rows = []
    for split in splits:
        hist = panel_s[panel_s["month"] <= split.train_end]
        pooled = float(np.mean(compute_train_naive_errors(hist)))
        reg_scale = {
            r: float(
                np.mean(
                    compute_train_naive_errors(hist[reg_series.loc[hist.index] == r])
                )
            )
            for r in ("Bắc", "Trung", "Nam")
        }
        for h in split.usable_horizons:
            tm = split.target_month(h)
            assert_test_is_real_only(panel_s, tm)
            hp = cache[h]
            train = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["y_target"])
            test = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
            if test.empty or train.empty:
                continue
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                preds = predict_m4_routings(train, test, hist, tm, regions, ROUTINGS)
            for r in test.itertuples():
                p = r.province_id
                row = {
                    "season": year,
                    "origin": split.origin,
                    "horizon": h,
                    "province_id": p,
                    "region": regions.get(p, "?"),
                    "y_true": float(r.y_target),
                    "pooled_scale": pooled,
                    "region_scale": reg_scale[regions[p]],
                }
                row.update({name: float(pr[p]) for name, pr in preds.items()})
                rows.append(row)
            print(f"[mùa {year} origin {split.origin}] h={h} xong.")
    return rows


def main() -> None:
    feat = with_thresholds(load_real_panel_with_features(calendarize=True))
    meta = pd.read_csv(_ROOT / "data" / "external" / "province_metadata.csv")
    regions = dict(zip(meta["new_province_code"], meta["region"]))
    all_splits = season_splits(feat, YEARS)
    state = (
        json.loads(_OUT.read_text("utf-8"))
        if _OUT.exists()
        else {"rows": [], "done": []}
    )
    for y in YEARS:
        if y in state["done"]:
            print(f"[mùa {y}] đã có, bỏ qua.")
            continue
        panel_s = feat[feat["month"] <= pd.Timestamp(year=y, month=12, day=1)]
        state["rows"] += run_season(panel_s, all_splits[y], regions, y)
        state["done"].append(y)
        _OUT.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        print(f"[mùa {y}] xong và đã lưu checkpoint.")


if __name__ == "__main__":
    _ = TARGET  # giữ import cho mở rộng
    main()
