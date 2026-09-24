"""exp_012 — classifier TRỰC TIẾP cho cảnh báo vượt ngưỡng P75 (phương án dự
phòng của docs/02 §1, kích hoạt vì exp_011 cho ROC-AUC ~0.73 < mốc 0.83): GBM
nhị phân (XGBoost `binary:logistic` + LightGBM `binary`, T1, trung bình xác
suất), nhãn = y(t+h) > P75 của tỉnh đó cho tháng đó (nhân quả, mở rộng).

Đặc trưng: 17 đặc trưng T1 + quy mô tỉnh (prov_mean_hist/12m) + ngưỡng của tháng
đích (`thr_target`, biết trước) + đặc trưng ca bệnh TƯƠNG ĐỐI so với ngưỡng
(lag2/lag3/cùng-tháng-năm-trước/quy-mô chia cho thr+1). Cột mới nối CUỐI.
Huấn luyện: cặp (X tại t, nhãn tại t+h) với t và t+h ≤ train_end — cùng khung
chống rò rỉ các experiment trước. So với "suy từ hồi quy" của exp_011 trên CÙNG
tập dòng (khớp theo origin, horizon, tỉnh).

Chạy: python -u experiments/exp_012_direct_classifier/run.py  (từ ai-service/)
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

from app.forecast.alerting import add_expanding_exceedance_threshold
from app.forecast.backtest import (
    FEATURE_COLS_T1,
    build_horizon_pairs,
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

REL_SOURCES = [
    "incidence_per_100k_lag_2",
    "incidence_per_100k_lag_3",
    "incidence_per_100k_same_month_last_year",
    "prov_mean_hist",
    "prov_mean_12m",
]
REL_COLS = [f"{c}__vs_thr" for c in REL_SOURCES]
CLF_COLS = (
    FEATURE_COLS_T1 + ["prov_mean_hist", "prov_mean_12m", "thr_target"] + REL_COLS
)

_OUT_PATH = Path(__file__).resolve().parent / "predictions.json"
_REGION_PATH = _ROOT / "data" / "external" / "province_metadata.csv"


def with_thresholds(panel: pd.DataFrame) -> pd.DataFrame:
    """Gắn `thr_month` (ngưỡng nhân quả của CHÍNH tháng đó) vào panel."""
    thr = add_expanding_exceedance_threshold(panel)[
        ["province_id", "month", "thr_month"]
    ]
    return panel.merge(thr, on=["province_id", "month"], how="left")


def build_pairs(panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    hp = build_horizon_pairs(panel, horizon)
    thr = panel.set_index(["province_id", "month"])["thr_month"]
    idx = pd.MultiIndex.from_arrays([hp["province_id"], hp["_target_month"]])
    hp["thr_target"] = thr.reindex(idx).to_numpy(dtype="float64", na_value=np.nan)
    for c in REL_SOURCES:
        hp[f"{c}__vs_thr"] = hp[c] / (hp["thr_target"] + 1.0)
    hp["label"] = np.where(
        hp["thr_target"].notna() & hp["y_target"].notna(),
        (hp["y_target"] > hp["thr_target"]).astype(float),
        np.nan,
    )
    return hp


def run_window(panel, splits, regions, window) -> list[dict]:
    cache = {h: build_pairs(panel, h) for h in HORIZONS}
    rows = []
    for split in splits:
        for h in split.usable_horizons:
            target_month = split.target_month(h)
            assert_test_is_real_only(panel, target_month)
            hp = cache[h]
            train = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["label"])
            test = hp[hp["month"] == split.train_end].dropna(subset=["label"])
            if test.empty or train.empty or train["label"].nunique() < 2:
                continue
            probs = []
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                for fn, obj in (
                    (fit_predict_m2_xgboost, "binary:logistic"),
                    (fit_predict_m2_lightgbm, "binary"),
                ):
                    probs.append(
                        np.asarray(
                            fn(
                                train, test, CLF_COLS, target_col="label", objective=obj
                            ),
                            dtype=float,
                        )
                    )
            p = np.clip(np.mean(probs, axis=0), 0.0, 1.0)
            for r, pi in zip(test.itertuples(), p):
                rows.append(
                    {
                        "window": window,
                        "origin": split.origin,
                        "horizon": h,
                        "province_id": r.province_id,
                        "region": regions.get(r.province_id, "?"),
                        "target_month": str(target_month.date()),
                        "train_end": str(split.train_end.date()),
                        "y_true": float(r.y_target),
                        "thr_target": float(r.thr_target),
                        "label": int(r.label),
                        "p_clf": float(pi),
                    }
                )
            print(f"[{window} origin {split.origin}] h={h} xong.")
    return rows


if __name__ == "__main__":
    panel = with_thresholds(load_real_panel_with_features())
    meta = pd.read_csv(_REGION_PATH)
    regions = dict(zip(meta["new_province_code"], meta["region"]))

    val_panel = panel[panel["month"] <= VAL_CUTOFF]
    val_splits = make_splits(
        val_panel,
        n_origins=VAL_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    rows = run_window(val_panel, val_splits, regions, "validation")
    outer_splits = make_splits(
        panel,
        n_origins=OUTER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    rows += run_window(panel, outer_splits, regions, "outer")
    _OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(f"Đã ghi {len(rows)} dòng vào {_OUT_PATH}")
