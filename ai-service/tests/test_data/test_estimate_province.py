"""Test cho app/data/estimate_province.py.

Property quan trọng nhất (docs/01 nguyên tắc "bảo toàn tổng", áp dụng cho
bước ước lượng): tổng ước lượng 34 tỉnh của 1 tháng phải khớp ĐÚNG tổng
quốc gia thật của tháng đó — nếu không thì bước "chia" đã sai toán học.
"""

import pandas as pd
import pytest

from app.data.estimate_province import (
    compute_province_month_shares,
    disaggregate_national_to_province,
)


def _toy_admin1_df() -> pd.DataFrame:
    """2 tỉnh cũ (khác new_province_code), 2 năm, đủ 12 tháng."""
    rows = []
    for year in (2008, 2009):
        for month in range(1, 13):
            # Cao Bằng: dịch cao điểm giữa năm; Hà Giang: khá đều quanh năm
            cao_bang_val = 100 if 5 <= month <= 9 else 10
            ha_giang_val = 20
            rows.append(
                {
                    "old_province_name": "Cao Bằng",
                    "month": pd.Timestamp(year, month, 1),
                    "dengue_total": cao_bang_val,
                }
            )
            rows.append(
                {
                    "old_province_name": "Hà Giang",  # -> gộp vào tuyen_quang
                    "month": pd.Timestamp(year, month, 1),
                    "dengue_total": ha_giang_val,
                }
            )
    return pd.DataFrame(rows)


class TestComputeShares:
    def test_shares_sum_to_one_per_month_of_year(self):
        shares = compute_province_month_shares(_toy_admin1_df())
        totals = shares.groupby("month_of_year")["share"].sum()
        assert (totals.round(9) == 1.0).all()

    def test_seasonal_pattern_is_captured(self):
        # Cao Bang cao diem thang 5-9 -> share thang 7 phai > share thang 1
        shares = compute_province_month_shares(_toy_admin1_df())
        cb = shares[shares["province_id"] == "cao_bang"].set_index("month_of_year")
        assert cb.loc[7, "share"] > cb.loc[1, "share"]


class TestDisaggregate:
    def test_conservation_of_total_per_month(self):
        """Bảo toàn tổng: tổng ước lượng các tỉnh == tổng quốc gia thật."""
        shares = compute_province_month_shares(_toy_admin1_df())

        national = pd.DataFrame(
            {
                "month": [pd.Timestamp(2023, 7, 1), pd.Timestamp(2023, 1, 1)],
                "t_res": ["Month", "Month"],
                "dengue_total": [50_000.0, 10_000.0],
            }
        )

        result = disaggregate_national_to_province(national, shares)

        by_month = result.groupby("month")["dengue_total_estimated"].sum()
        assert by_month.loc[pd.Timestamp(2023, 7, 1)] == pytest.approx(50_000.0)
        assert by_month.loc[pd.Timestamp(2023, 1, 1)] == pytest.approx(10_000.0)

    def test_output_flagged_as_estimated(self):
        shares = compute_province_month_shares(_toy_admin1_df())
        national = pd.DataFrame(
            {
                "month": [pd.Timestamp(2023, 7, 1)],
                "t_res": ["Month"],
                "dengue_total": [1000.0],
            }
        )
        result = disaggregate_national_to_province(national, shares)
        assert (result["data_source"] == "estimated").all()

    def test_missing_month_of_year_raises(self):
        # shares chỉ có thang 7, thieu 11 thang con lai
        partial_shares = pd.DataFrame(
            {"province_id": ["cao_bang"], "month_of_year": [7], "share": [1.0]}
        )
        national = pd.DataFrame(
            {
                "month": [pd.Timestamp(2023, 1, 1)],  # thang 1 -> khong co share
                "t_res": ["Month"],
                "dengue_total": [1000.0],
            }
        )
        with pytest.raises(ValueError, match="Thiếu tỉ trọng"):
            disaggregate_national_to_province(national, partial_shares)

    def test_seasonal_reallocation_reflects_shares(self):
        """Tháng cao điểm của Cao Bằng thì tỉnh đó nhận tỉ lệ lớn hơn."""
        shares = compute_province_month_shares(_toy_admin1_df())
        national = pd.DataFrame(
            {
                "month": [pd.Timestamp(2023, 7, 1)],
                "t_res": ["Month"],
                "dengue_total": [1000.0],
            }
        )
        result = disaggregate_national_to_province(national, shares)
        cb_val = result[result["province_id"] == "cao_bang"][
            "dengue_total_estimated"
        ].iloc[0]
        tq_val = result[result["province_id"] == "tuyen_quang"][
            "dengue_total_estimated"
        ].iloc[0]
        # thang 7 la cao diem Cao Bang (100) vs Ha Giang deu (20)
        assert cb_val > tq_val
