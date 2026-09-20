"""Tải và làm sạch dữ liệu OpenDengue cho Việt Nam.

Đã kiểm chứng thật (20/09/2026):
- adm_1_name (cấp tỉnh) chỉ có dữ liệu 1994-02 -> 2010-12 (T_res="Month").
- adm_0_name (cấp quốc gia) có dữ liệu 2011 -> 2025 theo tháng/tuần, KHÔNG
  có breakdown theo tỉnh cho giai đoạn này.
- Tên tỉnh trong OpenDengue là ASCII viết hoa, không dấu -> phải qua
  data/external/opendengue_province_alias.csv trước khi vào crosswalk.py.

Xem docs/01-chien-luoc-du-lieu.md §2 và docs/00 §C.0 để biết bối cảnh.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import pandas as pd
import requests

_SOURCE_URL = (
    "https://raw.githubusercontent.com/OpenDengue/master-repo/"
    "main/data/releases/V1.3/Spatial_extract_V1_3.zip"
)
_ZIP_ENTRY_NAME = "Spatial_extract_V1_3.csv"

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_RAW_DIR = _DATA_DIR / "raw" / "opendengue"
_EXTERNAL_DIR = _DATA_DIR / "external"
_ALIAS_PATH = _EXTERNAL_DIR / "opendengue_province_alias.csv"

ADMIN1_COVERAGE = ("1994-02-01", "2010-12-01")


def download(dest_dir: Path = _RAW_DIR, force: bool = False) -> Path:
    """Tải file zip OpenDengue V1.3 về data/raw/opendengue/ (raw, không sửa).

    Idempotent: nếu file đã tồn tại và force=False thì không tải lại.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    zip_path = dest_dir / "Spatial_extract_V1_3.zip"
    if zip_path.exists() and not force:
        return zip_path

    resp = requests.get(_SOURCE_URL, timeout=120)
    resp.raise_for_status()
    zip_path.write_bytes(resp.content)
    return zip_path


def _load_raw_vietnam(zip_path: Path) -> pd.DataFrame:
    """Đọc CSV trong zip, lọc riêng Việt Nam (ISO_A0 == 'VNM')."""
    chunks: list[pd.DataFrame] = []
    with zipfile.ZipFile(zip_path) as z, z.open(_ZIP_ENTRY_NAME) as f:
        for chunk in pd.read_csv(f, chunksize=300_000, low_memory=False):
            vn = chunk[chunk["ISO_A0"] == "VNM"]
            if len(vn):
                chunks.append(vn)
    if not chunks:
        raise ValueError(
            "Không tìm thấy dòng nào có ISO_A0='VNM' — kiểm tra lại file nguồn, "
            "có thể format đã đổi."
        )
    return pd.concat(chunks, ignore_index=True)


def load_admin0_national(zip_path: Path) -> pd.DataFrame:
    """Chuỗi thời gian cấp QUỐC GIA — dữ liệu thật, phủ 2011-2025.

    Returns:
        DataFrame cột: month (Timestamp, đầu tháng), t_res ("Month"/"Week"/
        "Year"), dengue_total (float).
    """
    vn = _load_raw_vietnam(zip_path)
    adm0 = vn[vn["S_res"] == "Admin0"].copy()
    adm0["month"] = (
        pd.to_datetime(adm0["calendar_start_date"]).dt.to_period("M").dt.to_timestamp()
    )
    return (
        adm0[["month", "T_res", "dengue_total"]]
        .rename(columns={"T_res": "t_res"})
        .sort_values("month")
        .reset_index(drop=True)
    )


def load_admin1_provincial(zip_path: Path) -> pd.DataFrame:
    """Chuỗi thời gian cấp TỈNH (đơn vị cũ) — dữ liệu thật, CHỈ 1994-2010.

    Returns:
        DataFrame cột: old_province_name (đã ánh xạ qua alias, tên có dấu
        khớp crosswalk.py), month (Timestamp), dengue_total (float).

    Raises:
        ValueError: nếu có tên tỉnh trong dữ liệu không khớp file alias —
            không lặng lẽ bỏ qua.
    """
    vn = _load_raw_vietnam(zip_path)
    adm1 = vn[vn["S_res"] == "Admin1"].copy()

    alias = pd.read_csv(_ALIAS_PATH, encoding="utf-8")
    alias_map = dict(zip(alias["opendengue_adm1_name"], alias["old_province_name"]))

    unknown = set(adm1["adm_1_name"].dropna().unique()) - set(alias_map)
    if unknown:
        raise ValueError(
            f"Tên tỉnh OpenDengue không có trong alias: {sorted(unknown)}. "
            "Bổ sung vào data/external/opendengue_province_alias.csv"
        )

    adm1["old_province_name"] = adm1["adm_1_name"].map(alias_map)
    adm1["month"] = (
        pd.to_datetime(adm1["calendar_start_date"]).dt.to_period("M").dt.to_timestamp()
    )

    return (
        adm1[["old_province_name", "month", "dengue_total"]]
        .dropna(subset=["old_province_name"])
        .sort_values(["old_province_name", "month"])
        .reset_index(drop=True)
    )
