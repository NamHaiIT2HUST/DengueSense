"""Test cho app/data/crosswalk.py — xem docs/01-chien-luoc-du-lieu.md §3, §9.

Yêu cầu bắt buộc từ docs/01 §3: "Unit test: tổng số ca trước và sau khi
ánh xạ phải bằng nhau (bảo toàn tổng)".
"""

import pandas as pd
import pytest

from app.data.crosswalk import (
    EXPECTED_NEW_PROVINCE_COUNT,
    EXPECTED_OLD_PROVINCE_COUNT,
    load_crosswalk,
    load_province_metadata,
    to_canonical_unit,
)


class TestCrosswalkIntegrity:
    """Bảng crosswalk tự nó phải đúng trước khi dùng để map bất kỳ thứ gì."""

    def test_covers_all_63_old_provinces_exactly_once(self):
        cw = load_crosswalk()
        assert len(cw) == EXPECTED_OLD_PROVINCE_COUNT
        assert cw[
            "old_province_name"
        ].is_unique, "Mỗi tỉnh cũ chỉ được xuất hiện đúng 1 lần trong crosswalk"

    def test_maps_to_exactly_34_new_provinces(self):
        cw = load_crosswalk()
        assert cw["new_province_code"].nunique() == EXPECTED_NEW_PROVINCE_COUNT

    def test_merge_type_counts_match_official_split(self):
        # Theo Nghị quyết 202/2025/QH15: 52 tỉnh cũ gộp thành 23 tỉnh mới,
        # 11 tỉnh giữ nguyên -> 52 + 11 = 63.
        cw = load_crosswalk()
        merged = cw[cw["merge_type"] == "merged"]
        unchanged = cw[cw["merge_type"] == "unchanged"]
        assert len(merged) == 52
        assert len(unchanged) == 11
        assert merged["new_province_code"].nunique() == 23
        assert unchanged["new_province_code"].nunique() == 11

    def test_no_null_values(self):
        cw = load_crosswalk()
        assert cw["old_province_name"].notna().all()
        assert cw["new_province_code"].notna().all()
        assert cw["new_province_name"].notna().all()

    def test_metadata_covers_all_34_new_provinces(self):
        cw = load_crosswalk()
        meta = load_province_metadata()
        assert len(meta) == EXPECTED_NEW_PROVINCE_COUNT
        assert meta["new_province_code"].is_unique
        assert set(cw["new_province_code"]) == set(meta["new_province_code"])

    def test_metadata_region_is_one_of_three(self):
        meta = load_province_metadata()
        assert set(meta["region"]) <= {"Bắc", "Trung", "Nam"}

    def test_exactly_6_centrally_governed_cities(self):
        # Hà Nội, Hải Phòng, Đà Nẵng, Hồ Chí Minh, Cần Thơ, Huế
        meta = load_province_metadata()
        cities = meta[meta["is_centrally_governed_city"]]
        assert len(cities) == 6


class TestToCanonicalUnit:
    """to_canonical_unit() là hàm mọi dataset khác phải đi qua — test kỹ."""

    def test_sum_is_preserved_after_mapping(self):
        """Yêu cầu bắt buộc ở docs/01 §3: bảo toàn tổng."""
        df = pd.DataFrame(
            {
                "province": ["Hà Giang", "Tuyên Quang", "Cao Bằng"],
                "month": ["2024-01", "2024-01", "2024-01"],
                "cases": [100, 50, 30],
            }
        )
        result = to_canonical_unit(df, province_col="province", value_cols=["cases"])
        assert result["cases"].sum() == df["cases"].sum() == 180

    def test_merges_multiple_old_provinces_into_one_new(self):
        # Hà Giang + Tuyên Quang -> cùng gộp vào "tuyen_quang"
        df = pd.DataFrame(
            {
                "province": ["Hà Giang", "Tuyên Quang"],
                "month": ["2024-01", "2024-01"],
                "cases": [100, 50],
            }
        )
        result = to_canonical_unit(df, province_col="province", value_cols=["cases"])
        assert len(result) == 1
        row = result.iloc[0]
        assert row["province_id"] == "tuyen_quang"
        assert row["cases"] == 150

    def test_keeps_unchanged_province_as_is(self):
        df = pd.DataFrame(
            {"province": ["Cao Bằng"], "month": ["2024-01"], "cases": [42]}
        )
        result = to_canonical_unit(df, province_col="province", value_cols=["cases"])
        assert result.iloc[0]["province_id"] == "cao_bang"
        assert result.iloc[0]["cases"] == 42

    def test_preserves_other_columns_as_group_keys(self):
        # 2 tháng khác nhau của cùng 1 tỉnh cũ KHÔNG được gộp vào nhau
        df = pd.DataFrame(
            {
                "province": ["Hà Giang", "Hà Giang"],
                "month": ["2024-01", "2024-02"],
                "cases": [100, 200],
            }
        )
        result = to_canonical_unit(df, province_col="province", value_cols=["cases"])
        assert len(result) == 2
        assert result["cases"].sum() == 300

    def test_unknown_province_name_raises(self):
        df = pd.DataFrame(
            {"province": ["Tỉnh Không Tồn Tại"], "month": ["2024-01"], "cases": [1]}
        )
        with pytest.raises(ValueError, match="không khớp crosswalk"):
            to_canonical_unit(df, province_col="province", value_cols=["cases"])

    def test_all_63_old_provinces_are_mappable(self):
        """Toàn bộ 63 tỉnh cũ đều map được, không có tên nào lọt lưới."""
        cw = load_crosswalk()
        df = pd.DataFrame(
            {
                "province": cw["old_province_name"].tolist(),
                "month": ["2024-01"] * len(cw),
                "cases": [1] * len(cw),
            }
        )
        result = to_canonical_unit(df, province_col="province", value_cols=["cases"])
        assert result["cases"].sum() == len(cw)
        assert result["province_id"].nunique() == EXPECTED_NEW_PROVINCE_COUNT

    def test_mean_aggregation_for_rate_columns(self):
        # Với chỉ số đã chuẩn hoá (vd incidence_per_100k), gộp bằng "sum"
        # là SAI — phải dùng "mean" (hoặc gộp lại từ số tuyệt đối gốc).
        df = pd.DataFrame(
            {
                "province": ["Hà Giang", "Tuyên Quang"],
                "month": ["2024-01", "2024-01"],
                "incidence_per_100k": [10.0, 20.0],
            }
        )
        result = to_canonical_unit(
            df,
            province_col="province",
            value_cols=["incidence_per_100k"],
            agg="mean",
        )
        assert result.iloc[0]["incidence_per_100k"] == 15.0
