"""Khung đánh giá NHIỀU MÙA (multi-season backtest).

Vấn đề: đánh giá chính (exp_001-015) chỉ có 1 "mùa" — 8 origin có train_end
2009-11 → 2010-06, target tới 2010-12. Mọi chênh lệch ±1% là chưa kiểm định.
Ở đây dựng NHIỀU mùa cùng cấu trúc: mùa Y có 8 origin, train_end = (Y-1)-11 …
Y-06, target ≤ Y-12 (mùa 2010 = đúng outer cũ). Mỗi mùa huấn luyện CHỈ trên dữ
liệu ≤ train_end của từng origin (không nhìn tương lai của mùa đó).

⚠️ KHÔNG mùa nào "sạch tuyệt đối" cho M4-R2: các lựa chọn thiết kế (định tuyến
vùng, đòn bẩy, tham số) được quyết định trên validation ≤2008-12 và outer 2010.
Vì vậy khung này dùng để ĐO ĐỘ BIẾN THIÊN và độ ổn định giữa các năm + khoảng tin
cậy, KHÔNG phải để công bố kết quả "chưa từng thấy". Mùa 2009 và 2010 gần nhất với
các quyết định thiết kế; mùa ≤2008 nằm trong cửa sổ validation đã dùng để chọn.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.forecast.splits import Split, make_splits


def season_splits(
    panel: pd.DataFrame,
    years: list[int],
    n_origins: int = 8,
    horizons: tuple[int, ...] = (1, 2, 3, 6),
    embargo_months: int = 1,
    reporting_delay_months: int = 1,
) -> dict[int, list[Split]]:
    """Mỗi mùa Y: `make_splits` trên panel cắt ≤ Y-12 → origin cuối có train_end
    = Y-06 (target h=6 rơi đúng Y-12), origin đầu (Y-1)-11 khi n_origins=8."""
    out: dict[int, list[Split]] = {}
    for y in years:
        cut = pd.Timestamp(year=y, month=12, day=1)
        sub = panel[panel["month"] <= cut]
        out[y] = make_splits(
            sub,
            n_origins=n_origins,
            horizons=horizons,
            embargo_months=embargo_months,
            reporting_delay_months=reporting_delay_months,
        )
    return out


def cluster_bootstrap_ci(
    values: np.ndarray,
    n_boot: int = 5000,
    alpha: float = 0.05,
    seed: int = 42,
) -> tuple[float, float, float]:
    """(trung bình, cận dưới, cận trên) bằng bootstrap có hoàn lại trên các phần
    tử `values` — truyền vào 1 giá trị/CỤM (vd 1 origin) để tôn trọng tương quan
    trong cụm. Lưu ý: origin liền kề cùng mùa vẫn tự tương quan → khoảng tin cậy
    này còn LẠC QUAN; dùng phối hợp với biến thiên giữa các mùa."""
    values = np.asarray(values, dtype=float)
    values = values[~np.isnan(values)]
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(values), size=(n_boot, len(values)))
    means = values[idx].mean(axis=1)
    lo, hi = np.quantile(means, [alpha / 2, 1 - alpha / 2])
    return float(values.mean()), float(lo), float(hi)


def sign_test_pvalue(diffs: np.ndarray) -> float:
    """p-value hai phía của kiểm định dấu (H0: trung vị chênh lệch = 0), bỏ giá trị 0."""
    from scipy.stats import binomtest

    d = np.asarray(diffs, dtype=float)
    d = d[(~np.isnan(d)) & (d != 0)]
    if len(d) == 0:
        return 1.0
    return float(binomtest(int((d > 0).sum()), len(d), 0.5).pvalue)
