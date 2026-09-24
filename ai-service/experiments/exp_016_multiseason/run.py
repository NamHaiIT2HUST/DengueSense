"""exp_016 — Đánh giá NHIỀU MÙA (2005–2010) cho M4-R2, baseline B2/B3 và classifier
cảnh báo, để đo độ biến thiên giữa các năm và khoảng tin cậy (mọi đánh giá trước
đó chỉ có 1 mùa: 2010). Khung: `app/forecast/multiseason.py` (mùa Y = 8 origin,
train_end (Y-1)-11 … Y-06, target ≤ Y-12; mùa 2010 = đúng outer cũ).

⚠️ Không mùa nào "sạch tuyệt đối" cho M4-R2 (thiết kế đã chọn trên validation ≤2008
và outer 2010) — khung này đo ĐỘ ỔN ĐỊNH, không công bố "kết quả chưa từng thấy".

Lưu kết quả theo mùa (checkpoint): chạy lại sẽ BỎ QUA mùa đã xong (an toàn nếu máy
ngủ/tắt giữa chừng). Chạy: python -u experiments/exp_016_multiseason/run.py
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

from app.forecast.alert_classifier import (
    build_pairs as clf_pairs,
)
from app.forecast.alert_classifier import (
    fit_predict_classifier,
    with_thresholds,
)
from app.forecast.backtest import (
    TARGET,
    build_horizon_pairs,
    compute_train_naive_errors,
    load_real_panel_with_features,
)
from app.forecast.m4 import climatology_forecast, predict_m4
from app.forecast.multiseason import season_splits
from app.forecast.splits import assert_test_is_real_only

YEARS = [2005, 2006, 2007, 2008, 2009, 2010]
HORIZONS = (1, 2, 3, 6)
_HERE = Path(__file__).resolve().parent
_OUT = _HERE / "results.json"


def run_season(panel_s, splits, regions, year) -> tuple[list[dict], list[dict]]:
    m4_cache = {h: build_horizon_pairs(panel_s, h) for h in HORIZONS}
    clf_cache = {h: clf_pairs(panel_s, h) for h in HORIZONS}
    inc = panel_s.set_index(["province_id", "month"])[TARGET]
    reg_series = panel_s["province_id"].map(regions)
    rows, clf_rows = [], []
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
        p90 = hist.groupby("province_id")[TARGET].quantile(0.90)
        for h in split.usable_horizons:
            tm = split.target_month(h)
            assert_test_is_real_only(panel_s, tm)
            hp = m4_cache[h]
            train = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["y_target"])
            test = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
            if test.empty or train.empty:
                continue
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                m4 = predict_m4(train, test, hist, tm, regions)
            b3 = climatology_forecast(hist, tm)
            prev = tm - pd.DateOffset(months=12)
            for r in test.itertuples():
                p = r.province_id
                b2 = inc.get((p, prev), np.nan)
                rows.append(
                    {
                        "season": year,
                        "origin": split.origin,
                        "horizon": h,
                        "province_id": p,
                        "region": regions.get(p, "?"),
                        "y_true": float(r.y_target),
                        "m4": float(m4[p]),
                        "b3": float(b3.get(p, np.nan)),
                        "b2": float(b2) if pd.notna(b2) else float("nan"),
                        "pooled_scale": pooled,
                        "region_scale": reg_scale[regions[p]],
                        "is_outbreak": bool(r.y_target > p90[p]),
                    }
                )
            # classifier canh bao
            cp = clf_cache[h]
            ctrain = cp[
                (cp["month"] <= split.train_end)
                & (cp["_target_month"] <= split.train_end)
            ].dropna(subset=["label"])
            ctest = cp[cp["month"] == split.train_end].dropna(subset=["label"])
            if not ctest.empty and ctrain["label"].nunique() == 2:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    pc = fit_predict_classifier(ctrain, ctest)
                for r, pi in zip(ctest.itertuples(), pc):
                    clf_rows.append(
                        {
                            "season": year,
                            "origin": split.origin,
                            "horizon": h,
                            "province_id": r.province_id,
                            "region": regions.get(r.province_id, "?"),
                            "label": int(r.label),
                            "p_clf": float(pi),
                        }
                    )
            print(f"[mùa {year} origin {split.origin}] h={h} xong.")
    return rows, clf_rows


def main() -> None:
    feat = with_thresholds(load_real_panel_with_features(calendarize=True))
    meta = pd.read_csv(_ROOT / "data" / "external" / "province_metadata.csv")
    regions = dict(zip(meta["new_province_code"], meta["region"]))
    all_splits = season_splits(feat, YEARS)
    state = (
        json.loads(_OUT.read_text("utf-8"))
        if _OUT.exists()
        else {"forecast": [], "alert": [], "done": []}
    )
    for y in YEARS:
        if y in state["done"]:
            print(f"[mùa {y}] đã có, bỏ qua.")
            continue
        panel_s = feat[feat["month"] <= pd.Timestamp(year=y, month=12, day=1)]
        rows, clf_rows = run_season(panel_s, all_splits[y], regions, y)
        state["forecast"] += rows
        state["alert"] += clf_rows
        state["done"].append(y)
        _OUT.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
        print(f"[mùa {y}] xong và đã lưu checkpoint.")


if __name__ == "__main__":
    main()
