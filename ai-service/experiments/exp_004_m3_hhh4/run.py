"""exp_004 — M3 hhh4 (bán cơ giới endemic-epidemic, docs/02 §3) đánh giá
trên cùng giao thức real-only rolling-origin như exp_001/exp_002/exp_003 —
so trực tiếp được với B2/B3 (exp_001) và M1/M2 (exp_002).

Chạy: python experiments/exp_004_m3_hhh4/run.py   (từ ai-service/, cần R +
package surveillance đã cài — xem app/forecast/r_env.py)
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

from app.forecast.metrics import mae, mase
from app.forecast.models_r import fit_hhh4, simulate_forecast
from app.forecast.splits import assert_test_is_real_only, make_splits

TARGET = "incidence_per_100k"
HORIZONS = (1, 2, 3, 6)
N_ORIGINS = 8
EMBARGO_MONTHS = 1
REPORTING_DELAY_MONTHS = 1
NSIM = 200
# 2 lag manh nhat theo EDA (03_eda_panel.ipynb): temp lag~2 thang r=0.565,
# mua lag~1 thang r=0.527 - dua vao hhh4 duoi dang climatology theo tinh,
# xem models_r.py docstring "Covariate khi hau trong end$f" cho ly do khong
# dung gia tri thuc do (tranh ro ri khi mo phong tuong lai).
CLIMATE_COLS = ("temp_mean", "precip_total")

_PANEL_PATH = _ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
_OUT_PATH = Path(__file__).resolve().parent / "results.json"


def load_real_panel() -> pd.DataFrame:
    panel = pd.read_parquet(_PANEL_PATH)
    real = panel[panel["data_source"] == "real"].copy()
    return real.sort_values(["province_id", "month"]).reset_index(drop=True)


def compute_train_naive_errors(train_df: pd.DataFrame) -> np.ndarray:
    errors = []
    for _, g in train_df.groupby("province_id"):
        g = g.set_index("month")[TARGET].sort_index()
        shifted = g.shift(12)
        errors.extend((g - shifted).dropna().abs().tolist())
    return np.array(errors)


def run() -> list[dict]:
    real_panel = load_real_panel()
    splits = make_splits(
        real_panel,
        n_origins=N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=EMBARGO_MONTHS,
        reporting_delay_months=REPORTING_DELAY_MONTHS,
    )
    max_h = max(HORIZONS)

    rows: list[dict] = []
    # 2 bien the: ban goc (khong khi hau, xem lai ket qua cu 1 lan nua cho
    # chac) va ban moi (co climatology khi hau) - chay chung 1 vong lap tren
    # cung origin de so sanh cong bang, khong phai chay 2 lan rieng le.
    variants = [
        ("M3_hhh4_no_climate", None),
        ("M3_hhh4_climate", CLIMATE_COLS),
    ]
    for split in splits:
        train_df = real_panel[real_panel["month"] <= split.train_end]
        train_naive_errors = compute_train_naive_errors(train_df)

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            for model_name, climate_cols in variants:
                province_order, train_end_idx, all_months, pop_wide = fit_hhh4(
                    real_panel,
                    split.train_end,
                    max_horizon=max_h,
                    climate_cols=climate_cols,
                )

                for h in split.usable_horizons:
                    target_month = split.target_month(h)
                    assert_test_is_real_only(real_panel, target_month)

                    pred_cases = simulate_forecast(
                        train_end_idx, horizon=h, nsim=NSIM, seed=42
                    )
                    target_idx = all_months.get_loc(target_month)
                    pop_at_target = pop_wide.iloc[target_idx]

                    pred = {
                        p: float(pred_cases[i] / pop_at_target[p] * 100_000)
                        for i, p in enumerate(province_order)
                        if pop_at_target[p] > 0
                    }

                    test_rows = real_panel[real_panel["month"] == target_month]
                    y_true = test_rows.set_index("province_id")[TARGET]
                    y_pred = pd.Series(pred).reindex(y_true.index)
                    valid = y_pred.notna() & y_true.notna()
                    if valid.sum() == 0:
                        continue

                    rows.append(
                        {
                            "origin": split.origin,
                            "train_end": str(split.train_end.date()),
                            "horizon": h,
                            "target_month": str(target_month.date()),
                            "model": model_name,
                            "n_provinces": int(valid.sum()),
                            "mae": mae(y_true[valid], y_pred[valid]),
                            "mase": mase(
                                y_true[valid], y_pred[valid], train_naive_errors
                            ),
                        }
                    )
        print(f"[origin {split.origin}/{N_ORIGINS - 1}] xong.")
    return rows


def summarize(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    return (
        df.groupby(["model", "horizon"])
        .agg(
            mase_mean=("mase", "mean"),
            mase_std=("mase", "std"),
            mae_mean=("mae", "mean"),
        )
        .reset_index()
    )


if __name__ == "__main__":
    _rows = run()
    _OUT_PATH.write_text(
        json.dumps(_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print()
    print(summarize(_rows).round(3).to_string(index=False))
    print(f"\nĐã ghi {len(_rows)} dòng kết quả chi tiết vào {_OUT_PATH}")
