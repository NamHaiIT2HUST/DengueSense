"""exp_003 — T2 tuning (Optuna TPE, docs/02 §6) cho M2a XGBoost + M2b
LightGBM — 2 model duy nhất còn cạnh tranh thật ở exp_002 (M1 thua rõ, xem
RESULTS.md exp_002 "Quyết định": không tune M1).

⚠️ Lệch so với docs/02 §6.3 "chỉ tune model THẮNG": ở exp_002, XGBoost và
LightGBM gần như hoà nhau (mỗi model thắng ở 2/4 horizon, chênh lệch <1%)
— không có 1 model thắng rõ để chỉ tune riêng nó. Tune CẢ HAI vì chi phí
rẻ ở quy mô dữ liệu này (vài nghìn dòng, mỗi lần fit ~1s).

⚠️ Đơn giản hoá so với docs/02 §6.1 đầy đủ: dùng Optuna TPE sampler (bắt
buộc), KHÔNG dùng ASHA pruner — ở quy mô dữ liệu này mỗi trial đã rẻ
(~1-3s), lợi ích cắt sớm không đáng kể so với công sức cài đặt pruning
đúng cách (cần callback báo cáo theo từng vòng boosting).

⚠️ Đơn giản hoá nested CV (docs/01 §7.3): tune 1 LẦN trên 1 cửa sổ inner
rolling-origin (dữ liệu <= 2008-12, tách biệt hoàn toàn khỏi 8 outer origin
của exp_001/exp_002 vốn nằm ở 2009-11..2010-06 — không chồng lấn, không rò
rỉ), KHÔNG tune riêng cho từng outer origin (sẽ tốn gấp 8 lần compute, không
tương xứng lợi ích ở quy mô dự án này). Bộ tham số tốt nhất từ inner CV
được áp dụng CỐ ĐỊNH cho cả 8 outer origin khi đánh giá cuối.

📌 **INNER_N_ORIGINS = 15 (tăng từ 5 sau lần chạy 100-trial đầu tiên)** — lần
chạy đầu (5 origin) cho kết quả T2 TỆ HƠN T1 cho XGBoost (xem RESULTS.md
"Kết quả" phần lịch sử), chẩn đoán nguyên nhân là cửa sổ inner quá nhỏ
(~20 điểm origin×horizon) không đủ ổn định cho không gian tìm kiếm 7 chiều
— tăng lên 15 origin (~60 điểm, dữ liệu vẫn dư dả vì real-only trải dài
1994-02→2008-12, ~179 tháng) để kiểm tra lại giả thuyết đó trước khi kết
luận "T2 không giúp được gì ở bài toán này". Vẫn tách biệt hoàn toàn khỏi 8
outer origin (không đổi).

Chạy: python experiments/exp_003_tuning_m2/run.py [--trials N]  (từ ai-service/)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import optuna
import pandas as pd

from app.forecast.features import build_feature_matrix
from app.forecast.metrics import mase
from app.forecast.models import fit_predict_m2_lightgbm, fit_predict_m2_xgboost
from app.forecast.splits import assert_test_is_real_only, make_splits

optuna.logging.set_verbosity(optuna.logging.WARNING)

TARGET = "incidence_per_100k"
HORIZONS = (1, 2, 3, 6)
REPORTING_DELAY_MONTHS = 1
SEED = 42

# Inner tuning: chi dung du lieu <= cutoff nay -> tach biet hoan toan khoi
# 8 outer origin cua exp_001/exp_002 (train_end 2009-11..2010-06).
INNER_CUTOFF = pd.Timestamp("2008-12-01")
INNER_N_ORIGINS = 15
INNER_EMBARGO_MONTHS = 1

OUTER_N_ORIGINS = 8
OUTER_EMBARGO_MONTHS = 1

FEATURE_COLS = [
    "sin_month",
    "cos_month",
    "temp_mean_lag_1",
    "temp_mean_lag_2",
    "precip_total_lag_1",
    "precip_total_lag_2",
    "humidity_mean_lag_1",
    "temp_mean_roll_mean_3",
    "precip_total_roll_mean_3",
    "incidence_per_100k_lag_2",
    "incidence_per_100k_lag_3",
    "momentum",
    "acceleration",
    "oni_lag_3",
    "oni_lag_6",
    "incidence_per_100k_same_month_last_year",
    "incidence_per_100k_deviation_from_median",
]

_PANEL_PATH = _ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
_OUT_DIR = Path(__file__).resolve().parent


def load_real_panel_with_features() -> pd.DataFrame:
    panel = pd.read_parquet(_PANEL_PATH)
    real = panel[panel["data_source"] == "real"].copy()
    real = real.sort_values(["province_id", "month"]).reset_index(drop=True)
    return build_feature_matrix(real, reporting_delay_months=REPORTING_DELAY_MONTHS)


def build_horizon_pairs(feat_panel: pd.DataFrame, horizon: int) -> pd.DataFrame:
    incidence_lookup = feat_panel.set_index(["province_id", "month"])[
        "incidence_per_100k"
    ]
    df = feat_panel.copy()
    target_months = df["month"] + pd.DateOffset(months=horizon)
    idx = pd.MultiIndex.from_arrays([df["province_id"], target_months])
    df["y_target"] = incidence_lookup.reindex(idx).to_numpy(
        dtype="float64", na_value=np.nan
    )
    df["_target_month"] = target_months
    return df


def compute_train_naive_errors(train_df: pd.DataFrame) -> np.ndarray:
    errors = []
    for _, g in train_df.groupby("province_id"):
        g = g.set_index("month")[TARGET].sort_index()
        shifted = g.shift(12)
        errors.extend((g - shifted).dropna().abs().tolist())
    return np.array(errors)


def _suggest_params(trial: optuna.Trial) -> dict:
    """Không gian tìm kiếm ĐÚNG docs/02 §6.3."""
    return {
        "n_estimators": trial.suggest_int("n_estimators", 100, 2000, log=True),
        "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.3, log=True),
        "max_depth": trial.suggest_int("max_depth", 3, 10),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 10.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 1e-4, 10.0, log=True),
    }


def evaluate_params(
    fit_fn, params: dict, feat_panel: pd.DataFrame, splits, horizon_cache: dict
) -> float:
    """Trung bình MASE qua mọi (origin, horizon) — hàm dùng chung cho cả
    Optuna objective (inner) lẫn đánh giá cuối (outer)."""
    mases = []
    for split in splits:
        raw_train_for_naive = feat_panel[feat_panel["month"] <= split.train_end]
        train_naive_errors = compute_train_naive_errors(raw_train_for_naive)

        for h in split.usable_horizons:
            target_month = split.target_month(h)
            assert_test_is_real_only(feat_panel, target_month)

            hp = horizon_cache[h]
            train_pairs = hp[
                (hp["month"] <= split.train_end)
                & (hp["_target_month"] <= split.train_end)
            ].dropna(subset=["y_target"])
            test_rows = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
            if test_rows.empty or train_pairs.empty:
                continue
            y_true = test_rows.set_index("province_id")["y_target"]

            pred = fit_fn(
                train_pairs,
                test_rows,
                FEATURE_COLS,
                target_col="y_target",
                params=params,
            )
            y_pred = pd.Series(pred, index=test_rows["province_id"].to_numpy())
            y_pred = y_pred.reindex(y_true.index)
            valid = y_pred.notna() & y_true.notna()
            if valid.sum() == 0:
                continue
            mases.append(mase(y_true[valid], y_pred[valid], train_naive_errors))
    return float(np.mean(mases)) if mases else float("inf")


def tune(
    fit_fn,
    feat_panel: pd.DataFrame,
    inner_splits,
    inner_cache: dict,
    n_trials: int,
    seed: int = SEED,
):
    def objective(trial: optuna.Trial) -> float:
        params = _suggest_params(trial)
        return evaluate_params(fit_fn, params, feat_panel, inner_splits, inner_cache)

    sampler = optuna.samplers.TPESampler(seed=seed)
    study = optuna.create_study(direction="minimize", sampler=sampler)
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study


def run(n_trials: int) -> dict:
    feat_panel = load_real_panel_with_features()

    inner_panel = feat_panel[feat_panel["month"] <= INNER_CUTOFF]
    inner_splits = make_splits(
        inner_panel,
        n_origins=INNER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=INNER_EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    inner_cache = {h: build_horizon_pairs(inner_panel, h) for h in HORIZONS}

    outer_splits = make_splits(
        feat_panel,
        n_origins=OUTER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=OUTER_EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    outer_cache = {h: build_horizon_pairs(feat_panel, h) for h in HORIZONS}

    results = {}
    for name, fit_fn in [
        ("M2a_xgboost", fit_predict_m2_xgboost),
        ("M2b_lightgbm", fit_predict_m2_lightgbm),
    ]:
        print(f"=== Tuning {name} ({n_trials} trial) ===")
        t0 = time.time()
        study = tune(fit_fn, inner_panel, inner_splits, inner_cache, n_trials)
        tune_seconds = time.time() - t0
        print(
            f"  xong sau {tune_seconds:.1f}s, best inner MASE = {study.best_value:.4f}"
        )
        print(f"  best params: {study.best_params}")

        t1_default_mase = evaluate_params(
            fit_fn, None, feat_panel, outer_splits, outer_cache
        )
        t2_tuned_mase = evaluate_params(
            fit_fn, study.best_params, feat_panel, outer_splits, outer_cache
        )
        print(f"  outer (8 origin) T1 default avg MASE = {t1_default_mase:.4f}")
        print(f"  outer (8 origin) T2 tuned   avg MASE = {t2_tuned_mase:.4f}")

        results[name] = {
            "n_trials": n_trials,
            "tune_seconds": tune_seconds,
            "best_inner_mase": study.best_value,
            "best_params": study.best_params,
            "outer_t1_default_avg_mase": t1_default_mase,
            "outer_t2_tuned_avg_mase": t2_tuned_mase,
            "convergence": [t.value for t in study.trials],
        }
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--trials", type=int, default=100)
    args = parser.parse_args()

    _results = run(args.trials)
    out_path = _OUT_DIR / f"results_trials{args.trials}.json"
    out_path.write_text(
        json.dumps(_results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nĐã ghi kết quả vào {out_path}")
