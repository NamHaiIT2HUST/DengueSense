"""exp_015 — đo tác động của lỗi "lag theo số dòng" (5/34 tỉnh có 1–2 tháng thiếu giữa
chuỗi real, exp_009) lên M4-R2: chạy lại ĐÚNG đánh giá M4-R2 (8 origin, 4 horizon,
`predict_m4`) với panel căn theo tháng lịch (`load_real_panel_with_features(
calendarize=True)`), so với số đã công bố (exp_008/010: 0.404/0.625/0.851/1.394,
gộp 0.8185; Bắc 1.373, Trung 0.904, Nam 0.722).

Chạy: python -u experiments/exp_015_calendar_lags/run.py  (từ ai-service/)
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
    build_horizon_pairs,
    compute_train_naive_errors,
    load_real_panel_with_features,
)
from app.forecast.m4 import predict_m4
from app.forecast.splits import assert_test_is_real_only, make_splits

HORIZONS = (1, 2, 3, 6)
_HERE = Path(__file__).resolve().parent
PUBLISHED = {"h1": 0.404, "h2": 0.625, "h3": 0.851, "h6": 1.394, "all": 0.8185}
PUBLISHED_REGION = {"Bắc": 1.373, "Trung": 0.904, "Nam": 0.722}


def main() -> None:
    panel = load_real_panel_with_features(calendarize=True)
    meta = pd.read_csv(_ROOT / "data" / "external" / "province_metadata.csv")
    regions = dict(zip(meta["new_province_code"], meta["region"]))
    splits = make_splits(
        panel,
        n_origins=8,
        horizons=HORIZONS,
        embargo_months=1,
        reporting_delay_months=1,
    )
    cache = {h: build_horizon_pairs(panel, h) for h in HORIZONS}
    rows = []
    for split in splits:
        hist = panel[panel["month"] <= split.train_end]
        pooled = float(np.mean(compute_train_naive_errors(hist)))
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
        for h in split.usable_horizons:
            tm = split.target_month(h)
            assert_test_is_real_only(panel, tm)
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
                pred = predict_m4(train, test, hist, tm, regions)
            for r in test.itertuples():
                rows.append(
                    {
                        "origin": split.origin,
                        "horizon": h,
                        "province_id": r.province_id,
                        "region": regions.get(r.province_id, "?"),
                        "y_true": float(r.y_target),
                        "pred": float(pred[r.province_id]),
                        "pooled_scale": pooled,
                        "region_scale": reg_scale[regions[r.province_id]],
                    }
                )
            print(f"[origin {split.origin}] h={h} xong.")
    df = pd.DataFrame(rows)
    (_HERE / "predictions.json").write_text(
        json.dumps(rows, ensure_ascii=False), encoding="utf-8"
    )
    df["ep"] = (df.y_true - df.pred).abs() / df.pooled_scale
    df["er"] = (df.y_true - df.pred).abs() / df.region_scale
    by_h = df.groupby("horizon").ep.mean()
    reg = df.groupby("region").er.mean()
    cal = {
        "h1": by_h[1],
        "h2": by_h[2],
        "h3": by_h[3],
        "h6": by_h[6],
        "all": df.ep.mean(),
    }
    print("\n=== M4-R2 với lag theo THÁNG LỊCH vs số đã công bố (lag theo dòng) ===")
    for k, v in cal.items():
        print(
            f"{k:4s} lịch {v:.4f} | công bố {PUBLISHED[k]:.4f} | Δ {100 * (v / PUBLISHED[k] - 1):+.2f}%"
        )
    for r, v in reg.items():
        print(
            f"{r:6s} lịch {v:.3f} | công bố {PUBLISHED_REGION[r]:.3f} | Δ {100 * (v / PUBLISHED_REGION[r] - 1):+.2f}%"
        )
    (_HERE / "summary.json").write_text(
        json.dumps(
            {"calendar": cal, "region": reg.to_dict(), "published": PUBLISHED}, indent=1
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
