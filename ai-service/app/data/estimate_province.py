"""Ước lượng số ca cấp tỉnh cho giai đoạn không có dữ liệu thật (2011+).

QUAN TRỌNG: giá trị sinh ra ở đây là ƯỚC LƯỢNG SUY DIỄN (data_source=
"estimated"), KHÔNG PHẢI số đo thật. Xem docs/01 §8 và docs/04 §2.2 —
mọi nơi dùng cột này phải biết rõ nó không phải ground truth.

Phương pháp: small-area estimation kiểu benchmarking — lấy tổng quốc gia
THẬT (OpenDengue Admin0, có tới 2025) nhân với tỉ trọng theo tỉnh học từ
giai đoạn có dữ liệu thật cấp tỉnh (Admin1, 1994-2010), tính riêng theo
TỪNG THÁNG TRONG NĂM (không phải 1 tỉ trọng cố định cả năm) để giữ được
khác biệt mùa vụ giữa các tỉnh (vd dịch ở Hà Nội đỉnh điểm khác miền Nam).

Property bắt buộc: tổng các tỉnh ước lượng của 1 tháng PHẢI khớp đúng
tổng quốc gia thật của tháng đó (bảo toàn tổng) — có unit test riêng
trong tests/test_data/test_estimate_province.py.

Hạn chế đã biết (ghi vào model card khi dùng):
- Tỉ trọng học từ 1994-2010, áp cho 2011-2025 -> giả định phân bố dịch
  theo tỉnh không đổi qua thời gian. Giả định này CÓ THỂ SAI ở những năm
  dịch bất thường (vd 2023: dịch bùng ở Hà Nội thay vì tập trung miền Nam
  như thông lệ) — xem docs/00 §C.0.
- Nên thay tỉ trọng lịch sử bằng tỉ trọng gần đây hơn (vd từ nguồn NSO
  cấp tỉnh, nếu khảo sát xác nhận dùng được) ngay khi có thể.
"""

from __future__ import annotations

import pandas as pd

from app.data.crosswalk import to_canonical_unit


def compute_province_month_shares(admin1_df: pd.DataFrame) -> pd.DataFrame:
    """Tính tỉ trọng mỗi tỉnh (mới) trong tổng cả nước, theo TỪNG THÁNG TRONG NĂM.

    Args:
        admin1_df: output của ingest_opendengue.load_admin1_provincial()
            (cột old_province_name, month, dengue_total; giai đoạn thật
            1994-2010).

    Returns:
        DataFrame cột: province_id, month_of_year (1-12), share (0-1).
        Với mỗi month_of_year, tổng share qua 34 tỉnh = 1.0 (có sai số
        làm tròn float rất nhỏ).
    """
    canonical = to_canonical_unit(
        admin1_df, province_col="old_province_name", value_cols=["dengue_total"]
    )
    canonical["month_of_year"] = pd.to_datetime(canonical["month"]).dt.month

    avg = (
        canonical.groupby(["province_id", "month_of_year"])["dengue_total"]
        .mean()
        .reset_index()
    )

    totals = avg.groupby("month_of_year")["dengue_total"].transform("sum")
    avg["share"] = avg["dengue_total"] / totals

    return avg[["province_id", "month_of_year", "share"]]


def disaggregate_national_to_province(
    national_df: pd.DataFrame,
    shares_df: pd.DataFrame,
) -> pd.DataFrame:
    """Chia tổng quốc gia THẬT về 34 tỉnh theo tỉ trọng lịch sử.

    Args:
        national_df: output của ingest_opendengue.load_admin0_national(),
            NÊN lọc trước chỉ giữ t_res == "Month" (tránh trộn Week/Year).
        shares_df: output của compute_province_month_shares().

    Returns:
        DataFrame cột: province_id, month, dengue_total_estimated,
        data_source (luôn = "estimated").

    Raises:
        ValueError: nếu thiếu tỉ trọng cho tháng nào đó trong năm (phải
            đủ 12 tháng x 34 tỉnh từ shares_df).
    """
    df = national_df.copy()
    df["month_of_year"] = pd.to_datetime(df["month"]).dt.month

    merged = df.merge(shares_df, on="month_of_year", how="left")
    if merged["share"].isna().any():
        missing = sorted(merged[merged["share"].isna()]["month_of_year"].unique())
        raise ValueError(
            f"Thiếu tỉ trọng lịch sử cho month_of_year={missing} — "
            "kiểm tra shares_df có đủ 12 tháng x 34 tỉnh không."
        )

    merged["dengue_total_estimated"] = merged["dengue_total"] * merged["share"]
    merged["data_source"] = "estimated"

    return (
        merged[["province_id", "month", "dengue_total_estimated", "data_source"]]
        .sort_values(["province_id", "month"])
        .reset_index(drop=True)
    )
