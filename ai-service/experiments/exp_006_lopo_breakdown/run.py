"""exp_006 — docs/02 §4.2 (phân rã kết quả theo vùng/mùa/chế độ dịch) và §4.3
(leave-one-province-out) cho M4 Ensemble.

Phần A (standard): fit M1/M2a/M2b như exp_005, LƯU dự báo từng tỉnh để phân
rã sau (exp_005 chỉ lưu MASE gộp). Phần B (LOPO): với mỗi tỉnh p, train trên
33 tỉnh còn lại (vẫn chia theo thời gian, cùng origin), dự báo p. M1 KHÔNG
tham gia LOPO (hiệu ứng cố định theo tỉnh — không dự báo được tỉnh chưa thấy),
nên so sánh LOPO dùng ensemble GBM = trung bình M2a + M2b, đối chiếu công
bằng với CÙNG ensemble GBM ở chế độ standard.

Lưu ý phạm vi LOPO: tỉnh p bị loại khỏi TẬP TRAIN nhưng đặc trưng suy từ
lịch sử chính p (lag ca bệnh, median lịch sử) vẫn dùng — đúng với kịch bản
"tỉnh mới có ≥ vài năm lịch sử địa phương" mà docs/02 §4.3 nhắc tới.

Chạy: python experiments/exp_006_lopo_breakdown/run.py  (từ ai-service/)
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
    get_member_predictions,
    load_real_panel_with_features,
)
from app.forecast.ensemble import combine_ensemble
from app.forecast.splits import assert_test_is_real_only, make_splits

HORIZONS = (1, 2, 3, 6)
N_ORIGINS = 8
EMBARGO_MONTHS = 1
REPORTING_DELAY_MONTHS = 1
GBM = ("M2a_xgboost", "M2b_lightgbm")
PEAK_MONTHS = (6, 7, 8, 9, 10, 11)  # mua mua/cao diem SXH mien Bac-Trung-Nam (xap xi)
OUTBREAK_QUANTILE = 0.90

_OUT_PATH = Path(__file__).resolve().parent / "results.json"
_REGION_PATH = _ROOT / "data" / "external" / "province_metadata.csv"


def _regions() -> dict[str, str]:
    meta = pd.read_csv(_REGION_PATH)
    return dict(zip(meta["new_province_code"], meta["region"]))


def _f(x):
    return None if x is None else float(x)


def _prep(feat_panel, splits):
    cache = {h: build_horizon_pairs(feat_panel, h) for h in HORIZONS}
    return cache


def _split_data(hp, split, h):
    train_pairs = hp[
        (hp["month"] <= split.train_end) & (hp["_target_month"] <= split.train_end)
    ].dropna(subset=["y_target"])
    test_rows = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
    return train_pairs, test_rows


def run_standard(feat_panel, splits, cache, regions) -> list[dict]:
    rows = []
    for split in splits:
        hist = feat_panel[feat_panel["month"] <= split.train_end]
        scale = float(np.mean(compute_train_naive_errors(hist)))
        p90 = hist.groupby("province_id")[TARGET].quantile(OUTBREAK_QUANTILE)
        for h in split.usable_horizons:
            target_month = split.target_month(h)
            assert_test_is_real_only(feat_panel, target_month)
            train_pairs, test_rows = _split_data(cache[h], split, h)
            if test_rows.empty or train_pairs.empty:
                continue
            provinces = test_rows["province_id"].tolist()
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                preds = get_member_predictions(train_pairs, test_rows)
            e1 = combine_ensemble(preds, provinces)
            e1_gbm = combine_ensemble({k: preds[k] for k in GBM}, provinces)
            y_true = test_rows.set_index("province_id")["y_target"]
            for p in provinces:
                rows.append(
                    {
                        "origin": split.origin,
                        "horizon": h,
                        "province_id": p,
                        "region": regions.get(p, "?"),
                        "target_month": str(target_month.date()),
                        "is_peak_season": bool(target_month.month in PEAK_MONTHS),
                        "is_outbreak": bool(y_true[p] > p90[p]),
                        "y_true": float(y_true[p]),
                        "scale": scale,
                        "M1_glm_negbin": _f(preds.get("M1_glm_negbin", {}).get(p)),
                        "M2a_xgboost": _f(preds["M2a_xgboost"].get(p)),
                        "M2b_lightgbm": _f(preds["M2b_lightgbm"].get(p)),
                        "E1": _f(e1.get(p)),
                        "E1_gbm": _f(e1_gbm.get(p)),
                    }
                )
            print(f"[STD origin {split.origin}] h={h} xong.")
    return rows


def run_lopo(feat_panel, splits, cache) -> list[dict]:
    rows = []
    provinces_all = sorted(feat_panel["province_id"].unique())
    for split in splits:
        hist = feat_panel[feat_panel["month"] <= split.train_end]
        scale = float(np.mean(compute_train_naive_errors(hist)))
        for h in split.usable_horizons:
            train_pairs, test_rows = _split_data(cache[h], split, h)
            if test_rows.empty or train_pairs.empty:
                continue
            y_true = test_rows.set_index("province_id")["y_target"]
            for p in provinces_all:
                if p not in y_true.index:
                    continue
                tr = train_pairs[train_pairs["province_id"] != p]
                te = test_rows[test_rows["province_id"] == p]
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    preds = get_member_predictions(tr, te, members=GBM)
                e1_gbm = combine_ensemble(preds, [p])
                rows.append(
                    {
                        "origin": split.origin,
                        "horizon": h,
                        "province_id": p,
                        "y_true": float(y_true[p]),
                        "scale": scale,
                        "M2a_xgboost": _f(preds["M2a_xgboost"][p]),
                        "M2b_lightgbm": _f(preds["M2b_lightgbm"][p]),
                        "E1_gbm": _f(e1_gbm[p]),
                    }
                )
            print(f"[LOPO origin {split.origin}] h={h} xong.")
    return rows


if __name__ == "__main__":
    feat_panel = load_real_panel_with_features()
    splits = make_splits(
        feat_panel,
        n_origins=N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    cache = _prep(feat_panel, splits)
    regions = _regions()

    standard = run_standard(feat_panel, splits, cache, regions)
    _OUT_PATH.write_text(
        json.dumps({"standard": standard, "lopo": []}, ensure_ascii=False),
        encoding="utf-8",
    )  # checkpoint: phan A khong mat neu phan B bi ngat
    lopo = run_lopo(feat_panel, splits, cache)
    _OUT_PATH.write_text(
        json.dumps({"standard": standard, "lopo": lopo}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(
        f"\nĐã ghi {len(standard)} dòng standard + {len(lopo)} dòng LOPO vào {_OUT_PATH}"
    )
