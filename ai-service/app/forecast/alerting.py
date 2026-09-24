"""Bài toán B — Cảnh báo: xác suất tháng dự báo VƯỢT NGƯỠNG bùng dịch (docs/02
§1, §5.2, §5.3). Ngưỡng = bách phân vị 75 lịch sử của CHÍNH tỉnh đó cho CHÍNH
tháng dương lịch đó (kênh nội sinh), chỉ tính từ dữ liệu ≤ train_end.

Cách làm khuyến nghị của docs/02 §1: suy xác suất từ dự báo hồi quy (A) thay
vì train classifier riêng. Ở đây từ điểm dự báo `pred` (M4) ta có 4 cách ra xác
suất, để so sánh (§5.3: không hiệu chỉnh / Platt / Isotonic + 1 cách phân phối):
  - `poisson_exceed_prob`  : KHÔNG hiệu chỉnh — đuôi Poisson quanh số ca dự báo
    (bỏ qua quá tán → thường quá tự tin);
  - `PlattCalibrator`      : logistic trên x = log((pred+1)/(thr+1));
  - `IsotonicCalibrator`   : hồi quy đẳng điệu trên cùng x;
  - `ResidualCalibrator`   : phân phối sai số log thực nghiệm (pred+1)→(y+1).
Mọi bộ hiệu chỉnh phải được fit trên fold VALIDATION, không phải fold train/test.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import poisson
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

TARGET = "incidence_per_100k"


def exceedance_thresholds(
    hist: pd.DataFrame, target_month: pd.Timestamp, quantile: float = 0.75
) -> dict[str, float]:
    """Bách phân vị `quantile` của incidence lịch sử (≤ train_end) theo tỉnh, chỉ
    trên các tháng cùng tháng dương lịch với `target_month`."""
    sub = hist[hist["month"].dt.month == target_month.month]
    return sub.groupby("province_id")[TARGET].quantile(quantile).to_dict()


def poisson_exceed_prob(
    pred_incidence: np.ndarray, population: np.ndarray, thr_incidence: np.ndarray
) -> np.ndarray:
    """P(N > ngưỡng) với N ~ Poisson(số ca dự báo). Số ca = incidence*pop/1e5;
    N nguyên nên N > thr ⇔ N > floor(thr) (scipy `sf` tự làm điều này)."""
    pred = np.clip(np.asarray(pred_incidence, dtype=float), 1e-9, None)
    pop = np.asarray(population, dtype=float)
    mu = pred * pop / 100_000
    k = np.asarray(thr_incidence, dtype=float) * pop / 100_000
    return poisson.sf(k, mu)


def _x(pred: np.ndarray, thr: np.ndarray) -> np.ndarray:
    return np.log((np.asarray(pred, float) + 1.0) / (np.asarray(thr, float) + 1.0))


class PlattCalibrator:
    """Logistic 1 biến trên x = log((pred+1)/(thr+1))."""

    def fit(self, pred, thr, y) -> PlattCalibrator:
        self.model_ = LogisticRegression(C=1e6, max_iter=1000).fit(
            _x(pred, thr).reshape(-1, 1), np.asarray(y, dtype=int)
        )
        return self

    def predict_proba(self, pred, thr) -> np.ndarray:
        return self.model_.predict_proba(_x(pred, thr).reshape(-1, 1))[:, 1]


class IsotonicCalibrator:
    """Hồi quy đẳng điệu (tăng) trên x; ngoài miền fit thì kẹp (clip)."""

    def fit(self, pred, thr, y) -> IsotonicCalibrator:
        self.model_ = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
        self.model_.fit(_x(pred, thr), np.asarray(y, dtype=float))
        return self

    def predict_proba(self, pred, thr) -> np.ndarray:
        return self.model_.predict(_x(pred, thr))


class ResidualCalibrator:
    """Phân phối dự báo thực nghiệm: e_j = log((y+1)/(pred+1)) trên validation;
    P(vượt) = tỉ lệ e_j sao cho (pred+1)·exp(e_j) − 1 > thr."""

    def fit(self, pred, thr, y) -> ResidualCalibrator:
        self.residuals_ = np.sort(
            np.log((np.asarray(y, float) + 1.0) / (np.asarray(pred, float) + 1.0))
        )
        return self

    def predict_proba(self, pred, thr) -> np.ndarray:
        pred = np.asarray(pred, float)
        thr = np.asarray(thr, float)
        # dieu kien e > log((thr+1)/(pred+1)) -> dem so residual lon hon
        cut = np.log((thr + 1.0) / (pred + 1.0))
        idx = np.searchsorted(self.residuals_, cut, side="right")
        return (len(self.residuals_) - idx) / len(self.residuals_)


def reliability_table(y: np.ndarray, p: np.ndarray, n_bins: int = 10) -> pd.DataFrame:
    """Bảng độ tin cậy: theo khoảng xác suất dự báo, tỉ lệ thực tế xảy ra."""
    y = np.asarray(y, dtype=float)
    p = np.asarray(p, dtype=float)
    bins = np.clip((p * n_bins).astype(int), 0, n_bins - 1)
    rows = []
    for b in range(n_bins):
        m = bins == b
        if m.any():
            rows.append(
                {
                    "bin": b,
                    "p_mean": p[m].mean(),
                    "observed": y[m].mean(),
                    "n": int(m.sum()),
                }
            )
    return pd.DataFrame(rows)


def expected_calibration_error(y: np.ndarray, p: np.ndarray, n_bins: int = 10) -> float:
    t = reliability_table(y, p, n_bins)
    return float((t["n"] * (t["p_mean"] - t["observed"]).abs()).sum() / t["n"].sum())


def add_expanding_exceedance_threshold(
    panel: pd.DataFrame, quantile: float = 0.75, min_years: int = 3
) -> pd.DataFrame:
    """Thêm cột `thr_month`: với mỗi dòng (tỉnh, tháng T), bách phân vị `quantile`
    của incidence các năm TRƯỚC cùng tháng dương lịch (mở rộng, KHÔNG gồm chính
    T). Nhân quả: giá trị dùng đều ≤ T-12 nên biết được tại mọi origin t ≥ T-12
    (horizon ≤ 12). Khớp `exceedance_thresholds` (dùng lịch sử ≤ train_end) khi
    horizon ≤ 12. NaN nếu chưa đủ `min_years` năm lịch sử. Dùng cho classifier
    trực tiếp (nhãn cho dòng huấn luyện)."""
    df = panel.sort_values(["province_id", "month"]).reset_index(drop=True)
    x = df[TARGET].astype("float64")
    grp = x.groupby([df["province_id"], df["month"].dt.month])
    df["thr_month"] = grp.transform(
        lambda s: s.shift(1).expanding(min_periods=min_years).quantile(quantile)
    )
    return df
