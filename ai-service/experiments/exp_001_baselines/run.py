"""exp_001 — 4 baseline Tier 0 (docs/02 §3): Persistence, Seasonal naive,
Climatology, GLM Poisson. Xem config.yaml cho tham số, RESULTS.md cho kết quả
+ diễn giải.

Chạy: python experiments/exp_001_baselines/run.py   (từ ai-service/)

Input: data/processed/v0.2.0/panel_monthly.parquet — cần Luồng A đã xong.
Output: in bảng MASE/MAE ra console + ghi results.json cạnh file này.

⚠️ Tập test bị giới hạn ở 1994-2010 (data_source == "real") — xem docs/03 §8.
`assert_test_is_real_only()` chạy trước mỗi lần tính metric để đảm bảo không
bao giờ vô tình đánh giá trên dữ liệu 'estimated'.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import pandas as pd
import statsmodels.api as sm

from app.forecast.metrics import mae, mase
from app.forecast.splits import assert_test_is_real_only, make_splits

TARGET = "incidence_per_100k"
HORIZONS = (1, 2, 3, 6)
N_ORIGINS = 8
EMBARGO_MONTHS = 1
REPORTING_DELAY_MONTHS = 1

_PANEL_PATH = _ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
_OUT_PATH = Path(__file__).resolve().parent / "results.json"


def load_real_panel() -> pd.DataFrame:
    panel = pd.read_parquet(_PANEL_PATH)
    real = panel[panel["data_source"] == "real"].copy()
    return real.sort_values(["province_id", "month"]).reset_index(drop=True)


def _province_series(df: pd.DataFrame, province_id: str) -> pd.Series:
    g = df[df["province_id"] == province_id].set_index("month")[TARGET]
    return g.sort_index()


# --------------------------------------------------------------- B1-B3 -----


def predict_persistence(
    series: pd.Series, train_end: pd.Timestamp, reporting_delay_months: int
) -> float:
    known_as_of = train_end - pd.DateOffset(months=reporting_delay_months)
    return series.get(known_as_of, np.nan)


def predict_seasonal_naive(series: pd.Series, target_month: pd.Timestamp) -> float:
    prev_year = target_month - pd.DateOffset(years=1)
    return series.get(prev_year, np.nan)


def predict_climatology(
    series: pd.Series, train_end: pd.Timestamp, target_month: pd.Timestamp
) -> float:
    history = series[series.index <= train_end]
    same_month = history[history.index.month == target_month.month]
    return float(same_month.mean()) if len(same_month) > 0 else np.nan


# ------------------------------------------------------------------ B4 -----


def _design_matrix(df: pd.DataFrame) -> pd.DataFrame:
    angle = 2 * np.pi * df["month"].dt.month / 12
    X = pd.DataFrame(
        {
            "sin_month": np.sin(angle),
            "cos_month": np.cos(angle),
            "temp_mean": df["temp_mean"].to_numpy(),
            "precip_total": df["precip_total"].to_numpy(),
        },
        index=df.index,
    )
    return sm.add_constant(X, has_constant="add")


def fit_and_predict_glm_poisson(
    train_df: pd.DataFrame, predict_rows: pd.DataFrame
) -> np.ndarray:
    """GLM Poisson pooled qua mọi tỉnh: `cases` là response, `offset =
    log(population)` để hệ số ước lượng đúng TỶ LỆ mắc/dân số (chuẩn thống
    kê cho biến đếm chuẩn hoá theo dân số — không nhét thẳng
    incidence_per_100k liên tục vào Poisson, vốn giả định biến đếm).
    Predictor: mùa vụ (sin/cos tháng) + temp_mean + precip_total CỦA CHÍNH
    THÁNG DỰ BÁO (dùng giá trị khí hậu thật đã biết trong backtest — baseline
    tham chiếu "nếu biết trước khí hậu tháng đó", không phải model triển
    khai thật; xem giới hạn ghi trong RESULTS.md)."""
    X_train = _design_matrix(train_df)
    y_train = train_df["cases"].to_numpy()
    offset_train = np.log(train_df["population"].to_numpy())

    model = sm.GLM(
        y_train, X_train, family=sm.families.Poisson(), offset=offset_train
    ).fit()

    X_pred = _design_matrix(predict_rows)
    offset_pred = np.log(predict_rows["population"].to_numpy())
    pred_cases = model.predict(X_pred, offset=offset_pred)
    pred_incidence = pred_cases / predict_rows["population"].to_numpy() * 100_000
    return np.asarray(pred_incidence)


# --------------------------------------------------------------- runner ----


def compute_train_naive_errors(train_df: pd.DataFrame) -> np.ndarray:
    """Sai số tuyệt đối seasonal-naive TÍNH TRÊN TRAIN (mẫu số MASE) — xem
    cảnh báo rò rỉ trong app/forecast/metrics.py::mase."""
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

    rows: list[dict] = []
    for split in splits:
        train_df = real_panel[real_panel["month"] <= split.train_end]
        train_naive_errors = compute_train_naive_errors(train_df)

        for h in split.usable_horizons:
            target_month = split.target_month(h)
            assert_test_is_real_only(real_panel, target_month)

            test_rows = real_panel[real_panel["month"] == target_month]
            if test_rows.empty:
                continue
            y_true = test_rows.set_index("province_id")[TARGET]

            persistence_preds, seasonal_preds, climatology_preds = {}, {}, {}
            for province_id in y_true.index:
                series = _province_series(train_df, province_id)
                persistence_preds[province_id] = predict_persistence(
                    series, split.train_end, REPORTING_DELAY_MONTHS
                )
                seasonal_preds[province_id] = predict_seasonal_naive(
                    series, target_month
                )
                climatology_preds[province_id] = predict_climatology(
                    series, split.train_end, target_month
                )

            glm_pred_arr = fit_and_predict_glm_poisson(train_df, test_rows)
            glm_preds = dict(zip(test_rows["province_id"], glm_pred_arr))

            for model_name, preds in [
                ("B1_persistence", persistence_preds),
                ("B2_seasonal_naive", seasonal_preds),
                ("B3_climatology", climatology_preds),
                ("B4_glm_poisson", glm_preds),
            ]:
                y_pred = pd.Series(preds).reindex(y_true.index)
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
                        "mase": mase(y_true[valid], y_pred[valid], train_naive_errors),
                    }
                )
    return rows


def summarize(rows: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(rows)
    summary = (
        df.groupby(["model", "horizon"])
        .agg(
            mase_mean=("mase", "mean"),
            mase_std=("mase", "std"),
            mae_mean=("mae", "mean"),
            n_origins=("origin", "nunique"),
        )
        .reset_index()
    )
    return summary


if __name__ == "__main__":
    _rows = run()
    _OUT_PATH.write_text(
        json.dumps(_rows, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    _summary = summarize(_rows)
    pd.set_option("display.width", 120)
    print(_summary.pivot(index="model", columns="horizon", values="mase_mean").round(3))
    print()
    print(f"Đã ghi {len(_rows)} dòng kết quả chi tiết vào {_OUT_PATH}")
