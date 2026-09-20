"""Ánh xạ đơn vị hành chính cấp tỉnh cũ (trước 07/2025) sang 34 tỉnh mới.

Xem docs/01-chien-luoc-du-lieu.md §3 — mọi dataset dịch tễ/khí hậu/dân số
phải đi qua to_canonical_unit() trước khi vào data/processed/. Đây là bước
BẮT BUỘC LÀM TRƯỚC, không phải bước dọn dẹp phụ.
"""

from pathlib import Path

import pandas as pd

_EXTERNAL_DIR = Path(__file__).resolve().parents[2] / "data" / "external"
_CROSSWALK_PATH = _EXTERNAL_DIR / "crosswalk_province.csv"
_METADATA_PATH = _EXTERNAL_DIR / "province_metadata.csv"

EXPECTED_OLD_PROVINCE_COUNT = 63
EXPECTED_NEW_PROVINCE_COUNT = 34


def load_crosswalk() -> pd.DataFrame:
    """Trả bảng ánh xạ 63 tỉnh cũ -> 34 tỉnh mới (theo Nghị quyết 202/2025/QH15)."""
    return pd.read_csv(_CROSSWALK_PATH, encoding="utf-8")


def load_province_metadata() -> pd.DataFrame:
    """Trả metadata (vùng miền, có phải TP trực thuộc TW) của 34 tỉnh mới."""
    return pd.read_csv(_METADATA_PATH, encoding="utf-8")


def to_canonical_unit(
    df: pd.DataFrame,
    province_col: str,
    value_cols: list[str],
    agg: str = "sum",
) -> pd.DataFrame:
    """Quy đổi df có cột tên tỉnh CŨ về 34 tỉnh MỚI (province_id chuẩn).

    Args:
        df: dữ liệu đầu vào, có 1 cột tên tỉnh cũ (`province_col`) và
            1+ cột số cần gộp (`value_cols`).
        province_col: tên cột chứa tên tỉnh cũ trong df.
        value_cols: các cột số (ca bệnh, dân số...) cần cộng dồn khi
            nhiều tỉnh cũ gộp vào 1 tỉnh mới.
        agg: cách gộp value_cols khi nhiều dòng map vào cùng 1 tỉnh mới +
            cùng kỳ thời gian ("sum" mặc định — đúng cho ca bệnh/dân số;
            dùng "mean" nếu value_col là tỉ lệ/chỉ số đã chuẩn hoá sẵn).

    Returns:
        DataFrame với cột `province_id` (mã 34 tỉnh mới) thay cho
        `province_col`; các cột khác của df (vd cột tháng/năm) được giữ
        nguyên và dùng làm khoá gộp cùng province_id.

    Raises:
        ValueError: nếu có tên tỉnh trong df không khớp crosswalk (khả
            năng cao là lỗi chính tả/viết tắt khác chuẩn) — cố tình
            không lặng lẽ bỏ qua dữ liệu không khớp được.
    """
    crosswalk = load_crosswalk()
    valid_names = set(crosswalk["old_province_name"])
    input_names = set(df[province_col].dropna().unique())
    unknown = input_names - valid_names
    if unknown:
        raise ValueError(
            f"Tên tỉnh không khớp crosswalk: {sorted(unknown)}. "
            "Kiểm tra chính tả, hoặc bổ sung dòng tương ứng vào "
            "data/external/crosswalk_province.csv"
        )

    merged = df.merge(
        crosswalk[["old_province_name", "new_province_code"]],
        left_on=province_col,
        right_on="old_province_name",
        how="left",
    )

    other_cols = [c for c in df.columns if c not in {province_col, *value_cols}]
    group_cols = ["new_province_code", *other_cols]

    result = (
        merged.groupby(group_cols, as_index=False)[value_cols]
        .agg(agg)
        .rename(columns={"new_province_code": "province_id"})
    )
    return result
