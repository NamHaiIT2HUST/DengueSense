"""Sinh đặc trưng cho Layer 1 (forecast) — xem docs/02 §2.

Mọi hàm PHẢI nhân quả: đặc trưng tại tháng `t` (dòng panel) chỉ được dùng dữ
liệu có thật *tại thời điểm t*, tôn trọng độ trễ báo cáo `D`
(`reporting_delay_months`) cho các đặc trưng suy từ `cases`/`incidence_per_
100k`. Khí hậu/ONI cho phép `D_climate=0` (docs/01 §6 Bẫy 3 — có cơ sở vì
ERA5-Land/ONI công bố nhanh hơn số ca dịch tễ nhiều).

Panel đầu vào phải đã sort theo (province_id, month) — mọi hàm ở đây
`groupby("province_id")` rồi `shift`/`rolling` nên thứ tự trong mỗi nhóm
quan trọng, thứ tự giữa các nhóm thì không.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

CASE_COLS = ("incidence_per_100k", "cases")
CLIMATE_COLS = ("temp_mean", "precip_total", "humidity_mean")


def _sorted(panel: pd.DataFrame) -> pd.DataFrame:
    return panel.sort_values(["province_id", "month"]).reset_index(drop=True)


def add_seasonal_features(panel: pd.DataFrame) -> pd.DataFrame:
    """sin/cos(2π·tháng/12) — mã hoá lượng giác để tháng 12 và tháng 1 gần
    nhau (mã số thứ tự thường 1..12 không nắm được tính tuần hoàn này)."""
    df = panel.copy()
    angle = 2 * np.pi * df["month"].dt.month / 12
    df["sin_month"] = np.sin(angle)
    df["cos_month"] = np.cos(angle)
    return df


def add_climate_lag_features(
    panel: pd.DataFrame, max_lag: int = 6, reporting_delay_months: int = 0
) -> pd.DataFrame:
    """`{var}_lag_{i}` = giá trị khí hậu tại `t - i - D_climate`, i=1..max_lag.
    Mặc định `reporting_delay_months=0` (khí hậu công bố nhanh hơn ca dịch
    tễ, xem docstring module)."""
    df = _sorted(panel)
    for col in CLIMATE_COLS:
        for i in range(1, max_lag + 1):
            shift = i + reporting_delay_months
            df[f"{col}_lag_{i}"] = df.groupby("province_id")[col].shift(shift)
    return df


def add_climate_rolling_features(
    panel: pd.DataFrame, windows: tuple[int, ...] = (2, 3, 6)
) -> pd.DataFrame:
    """Trung bình/tổng trượt của khí hậu, tính trên cửa sổ KẾT THÚC ở `t-1`
    (không bao gồm tháng `t` — nhân quả). Mưa dồn nhiều tháng có ý nghĩa
    sinh học hơn mưa 1 tháng đơn lẻ (docs/02 §2.1)."""
    df = _sorted(panel)
    for w in windows:
        for col in CLIMATE_COLS:
            shifted = df.groupby("province_id")[col].shift(1)
            df[f"{col}_roll_mean_{w}"] = shifted.groupby(df["province_id"]).transform(
                lambda s, w=w: s.rolling(w, min_periods=w).mean()
            )
    return df


def add_disease_lag_features(
    panel: pd.DataFrame,
    target_col: str = "incidence_per_100k",
    max_lag: int = 12,
    reporting_delay_months: int = 1,
) -> pd.DataFrame:
    """`{target_col}_lag_{D+i}` = giá trị dịch tễ tại `t - i - D`, i=1..max_lag
    — LÙI THÊM D tháng độ trễ báo cáo so với lag thường (docs/02 §2.1)."""
    df = _sorted(panel)
    for i in range(1, max_lag + 1):
        shift = i + reporting_delay_months
        df[f"{target_col}_lag_{shift}"] = df.groupby("province_id")[target_col].shift(
            shift
        )
    return df


def add_momentum_features(
    panel: pd.DataFrame,
    target_col: str = "incidence_per_100k",
    reporting_delay_months: int = 1,
) -> pd.DataFrame:
    """`momentum = y[t-D] - y[t-D-1]`, `acceleration` = sai phân bậc 2 —
    bắt điểm chuyển pha sớm (docs/02 §2.1)."""
    df = _sorted(panel)
    D = reporting_delay_months
    lag_d = df.groupby("province_id")[target_col].shift(D)
    lag_d1 = df.groupby("province_id")[target_col].shift(D + 1)
    lag_d2 = df.groupby("province_id")[target_col].shift(D + 2)
    df["momentum"] = lag_d - lag_d1
    df["acceleration"] = (lag_d - lag_d1) - (lag_d1 - lag_d2)
    return df


def add_oni_features(
    panel: pd.DataFrame, lags: tuple[int, ...] = (3, 6)
) -> pd.DataFrame:
    """`oni` đã có sẵn trong panel (tại đúng tháng `t`, cho phép D=0 như
    khí hậu). Thêm `oni_lag_{L}` — El Niño ảnh hưởng có độ trễ dài
    (docs/02 §2.1)."""
    df = _sorted(panel)
    for lag in lags:
        df[f"oni_lag_{lag}"] = df.groupby("province_id")["oni"].shift(lag)
    return df


def add_seasonal_norm_features(
    panel: pd.DataFrame,
    target_col: str = "incidence_per_100k",
    reporting_delay_months: int = 1,
) -> pd.DataFrame:
    """`{target_col}_same_month_last_year` = giá trị đúng 12 tháng trước
    (không cần D vì đã đủ xa trong quá khứ). `{target_col}_deviation_from_
    median` = độ lệch của giá trị tại `t-D` so với TRUNG VỊ LỊCH SỬ (chỉ
    tính trên các năm TRƯỚC `t-D`) của đúng tháng dương lịch của chính
    `t-D` tại cùng tỉnh — kênh nội sinh (endemic channel, docs/02 §2.1).

    Nhóm theo tháng của `t-D` để code đọc đúng ý nghĩa ("so với lịch sử
    của chính tháng đang xét", không phải tháng `t`) — về mặt số học, vì
    `D` là hằng số áp dụng đều cho cả chuỗi, nhóm theo tháng của `t-D` hay
    theo tháng của `t` cho ra **cùng một phép chia nhóm** (chỉ khác nhãn),
    nên kết quả số không đổi dù nhóm theo cách nào; giữ cách này vì rõ
    nghĩa hơn khi đọc lại code."""
    df = _sorted(panel)
    df[f"{target_col}_same_month_last_year"] = df.groupby("province_id")[
        target_col
    ].shift(12)

    D = reporting_delay_months
    df["_lag_d_tmp"] = df.groupby("province_id")[target_col].shift(D)
    # thang duong lich CUA CHINH t-D (khong phai cua t) — so hoc truc tiep,
    # khong dung shift tren cot datetime de tranh phu thuoc panel lien tuc.
    df["_lag_d_month"] = ((df["month"].dt.month - D - 1) % 12) + 1

    def _expanding_median_excl_current(group: pd.DataFrame) -> pd.Series:
        # median lịch sử tính TRÊN CÁC NĂM TRƯỚC — dùng shift(1) theo thứ tự
        # năm trong nhóm (cùng tỉnh, cùng tháng-của-lag) trước khi expanding
        # để loại chính điểm hiện tại ra khỏi median (tránh nhìn vào chính nó).
        s = group["_lag_d_tmp"].shift(1)
        return s.expanding(min_periods=1).median()

    df["_hist_median"] = df.groupby(
        ["province_id", "_lag_d_month"], group_keys=False
    ).apply(_expanding_median_excl_current)
    df[f"{target_col}_deviation_from_median"] = df["_lag_d_tmp"] - df["_hist_median"]

    df = df.drop(columns=["_lag_d_tmp", "_lag_d_month", "_hist_median"])
    return df


def build_feature_matrix(
    panel: pd.DataFrame, reporting_delay_months: int = 1
) -> pd.DataFrame:
    """Ghép toàn bộ nhóm đặc trưng — thứ tự áp dụng không quan trọng vì mỗi
    hàm chỉ đọc cột gốc trong `panel`, không phụ thuộc cột do hàm khác sinh
    ra (trừ `momentum`/`seasonal_norm` đều tự shift lại từ panel gốc, không
    chồng lên nhau)."""
    df = panel.copy()
    df = add_seasonal_features(df)
    df = add_climate_lag_features(df, reporting_delay_months=0)
    df = add_climate_rolling_features(df)
    df = add_disease_lag_features(df, reporting_delay_months=reporting_delay_months)
    df = add_momentum_features(df, reporting_delay_months=reporting_delay_months)
    df = add_oni_features(df)
    df = add_seasonal_norm_features(df, reporting_delay_months=reporting_delay_months)
    return df
