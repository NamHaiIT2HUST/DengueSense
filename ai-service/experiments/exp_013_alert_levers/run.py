"""exp_013 — đòn bẩy cho classifier cảnh báo (exp_012: ROC-AUC 0.758 < mốc 0.83; Nam ~0.60).

Khai báo TRƯỚC khi chạy (mỗi đòn bẩy độc lập, so với A0 = classifier exp_012):
  A1 spatial : + đặc trưng không gian (láng giềng/toàn quốc, nhân quả) và bản chia cho
               (thr+1) — bùng phát ở tỉnh kề có thể báo trước việc VƯỢT NGƯỠNG rõ hơn báo trước số ca;
  A2 pooled  : MỘT model chung cho mọi horizon (thêm cột `h`), 4× dữ liệu huấn luyện/model;
  A3 rank-avg: trung bình hạng của A0 và điểm suy từ hồi quy M4-R2 (exp_011) — tính ở analyze.py.
QUY TẮC CHẤP NHẬN (trên VALIDATION, outer chỉ xác nhận): đòn bẩy nhận nếu PR-AUC gộp tăng
≥ 5% tương đối VÀ ROC-AUC gộp không giảm.

Chạy: python -u experiments/exp_013_alert_levers/run.py  (từ ai-service/)
"""

from __future__ import annotations

import importlib.util
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
from app.forecast.features import add_spatial_features
from app.forecast.models import fit_predict_m2_lightgbm, fit_predict_m2_xgboost
from app.forecast.splits import assert_test_is_real_only, make_splits

_spec = importlib.util.spec_from_file_location(
    "exp012_run", _ROOT / "experiments" / "exp_012_direct_classifier" / "run.py"
)
e12 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(e12)

HORIZONS = e12.HORIZONS
NB = ["nb_mean_lag_2", "nb_mean_lag_3", "nb_max_lag_2"]
NAT = ["nat_mean_lag_2", "nat_mom"]
SP_REL_SRC = ["nb_mean_lag_2", "nb_max_lag_2", "nat_mean_lag_2"]
SP_REL = [f"{c}__vs_thr" for c in SP_REL_SRC]
COLS_A0 = e12.CLF_COLS
COLS_A1 = COLS_A0 + NB + NAT + SP_REL
COLS_A2 = COLS_A0 + ["h"]

_OUT_PATH = Path(__file__).resolve().parent / "predictions.json"


def build_pairs(panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    hp = e12.build_pairs(panel, horizon)
    for c in SP_REL_SRC:
        hp[f"{c}__vs_thr"] = hp[c] / (hp["thr_target"] + 1.0)
    hp["h"] = float(horizon)
    return hp


def _fit_predict(train, test, cols) -> np.ndarray:
    probs = []
    for fn, obj in (
        (fit_predict_m2_xgboost, "binary:logistic"),
        (fit_predict_m2_lightgbm, "binary"),
    ):
        probs.append(
            np.asarray(
                fn(train, test, cols, target_col="label", objective=obj), dtype=float
            )
        )
    return np.clip(np.mean(probs, axis=0), 0.0, 1.0)


def run_window(panel, splits, regions, window) -> list[dict]:
    cache = {h: build_pairs(panel, h) for h in HORIZONS}
    rows = []
    for split in splits:
        trains, tests = {}, {}
        for h in split.usable_horizons:
            assert_test_is_real_only(panel, split.target_month(h))
            hp = cache[h]
            trains[h] = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["label"])
            tests[h] = hp[hp["month"] == split.train_end].dropna(subset=["label"])
        ok = [
            h
            for h in split.usable_horizons
            if not tests[h].empty and trains[h]["label"].nunique() == 2
        ]
        if not ok:
            continue
        pooled_train = pd.concat([trains[h] for h in ok], ignore_index=True)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for h in ok:
                p0 = _fit_predict(trains[h], tests[h], COLS_A0)
                p1 = _fit_predict(trains[h], tests[h], COLS_A1)
                p2 = _fit_predict(pooled_train, tests[h], COLS_A2)
                for r, a, b, c in zip(tests[h].itertuples(), p0, p1, p2):
                    rows.append(
                        {
                            "window": window,
                            "origin": split.origin,
                            "horizon": h,
                            "province_id": r.province_id,
                            "region": regions.get(r.province_id, "?"),
                            "target_month": str(split.target_month(h).date()),
                            "train_end": str(split.train_end.date()),
                            "label": int(r.label),
                            "p_A0": float(a),
                            "p_A1": float(b),
                            "p_A2": float(c),
                        }
                    )
                print(f"[{window} origin {split.origin}] h={h} xong.")
    return rows


if __name__ == "__main__":
    panel = add_spatial_features(
        e12.load_real_panel_with_features(),
        build_adjacency_matrix(),
        reporting_delay_months=e12.REPORTING_DELAY_MONTHS,
    )
    panel = e12.with_thresholds(panel)
    meta = pd.read_csv(e12._REGION_PATH)
    regions = dict(zip(meta["new_province_code"], meta["region"]))

    val_panel = panel[panel["month"] <= e12.VAL_CUTOFF]
    val_splits = make_splits(
        val_panel,
        n_origins=e12.VAL_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=e12.EMBARGO_MONTHS,
        reporting_delay_months=e12.REPORTING_DELAY_MONTHS,
    )
    rows = run_window(val_panel, val_splits, regions, "validation")
    outer_splits = make_splits(
        panel,
        n_origins=e12.OUTER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=e12.EMBARGO_MONTHS,
        reporting_delay_months=e12.REPORTING_DELAY_MONTHS,
    )
    rows += run_window(panel, outer_splits, regions, "outer")
    _OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
    print(f"Đã ghi {len(rows)} dòng vào {_OUT_PATH}")
