"""Chỉ số ENSO (ONI) từ NOAA CPC — xem PHASE-1-CHECKLIST §A2.

Nguồn thật, công khai, không cần đăng ký gì:
https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt

Định dạng file (đã kiểm chứng 21/09/2026): whitespace-delimited, 4 cột
`SEAS YR TOTAL ANOM`, SEAS là mã mùa 3 tháng trượt (DJF, JFM, FMA, ...),
YR là năm của tháng GIỮA mùa đó (vd DJF 1950 = Dec 1949-Jan-Feb 1950, gắn
năm 1950 vì tháng giữa là tháng 1/1950).
"""

from __future__ import annotations

from io import StringIO
from pathlib import Path

import pandas as pd
import requests

ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_PATH = _DATA_DIR / "raw" / "oni" / "oni.ascii.txt"
FALLBACK_PATH = _DATA_DIR / "external" / "oni_raw.txt"

# Mã mùa 3 tháng trượt -> tháng giữa mùa. Xem docstring module.
SEASON_TO_MONTH = {
    "DJF": 1,
    "JFM": 2,
    "FMA": 3,
    "MAM": 4,
    "AMJ": 5,
    "MJJ": 6,
    "JJA": 7,
    "JAS": 8,
    "ASO": 9,
    "SON": 10,
    "OND": 11,
    "NDJ": 12,
}


def download(dest: Path = RAW_PATH) -> Path:
    """Tải file ONI. NOAA có lúc chặn request không có User-Agent -> luôn
    gửi kèm header. Nếu request lỗi (mạng, bị chặn), fallback đọc bản đã
    tải sẵn commit ở data/external/oni_raw.txt (nếu có)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        resp = requests.get(
            ONI_URL,
            headers={"User-Agent": "Mozilla/5.0 (DengueSense research pipeline)"},
            timeout=30,
        )
        resp.raise_for_status()
        dest.write_text(resp.text, encoding="utf-8")
        return dest
    except requests.RequestException:
        if FALLBACK_PATH.exists():
            return FALLBACK_PATH
        raise


def parse(path: Path) -> pd.DataFrame:
    """Parse file ONI thô -> (year, month, oni). `oni` = cột ANOM (độ lệch
    nhiệt độ mặt biển so với chuẩn — đây là chỉ số ENSO thật sự, không phải
    TOTAL)."""
    text = path.read_text(encoding="utf-8")
    raw = pd.read_csv(StringIO(text), sep=r"\s+")
    raw.columns = [c.strip().upper() for c in raw.columns]

    df = pd.DataFrame(
        {
            "year": raw["YR"].astype(int),
            "month": raw["SEAS"].map(SEASON_TO_MONTH),
            "oni": raw["ANOM"].astype(float),
        }
    )
    if df["month"].isna().any():
        bad = raw.loc[df["month"].isna(), "SEAS"].unique()
        raise ValueError(f"Mã mùa không nhận dạng được trong file ONI: {bad}")
    return df.sort_values(["year", "month"]).reset_index(drop=True)


def load_oni_monthly() -> pd.DataFrame:
    """Entry point chính: tải (nếu cần) + parse -> (year, month, oni)."""
    path = download()
    return parse(path)


if __name__ == "__main__":
    _df = load_oni_monthly()
    print(_df.head())
    print(f"{len(_df)} dòng, phủ {_df['year'].min()}-{_df['year'].max()}")
