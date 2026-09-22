"""Dân số theo tỉnh theo năm, từ WorldPop — xem PHASE-1-CHECKLIST §A1.

Nguồn thật, tải trực tiếp không cần đăng ký (đã kiểm chứng 21/09/2026, HTTP
200, ~150-200MB/năm):
https://data.worldpop.org/GIS/Population/Global_2000_2020/{year}/VNM/vnm_ppp_{year}.tif

Đây là raster ước tính số người/pixel (~100m), không phải số đếm hành chính
-> `population_source = "estimated"` cho năm có raster (2000-2020).

Phạm vi WorldPop "Global_2000_2020" chỉ tới 2020. Năm 1994-1999 và 2021-2025
KHÔNG có raster -> lấy giá trị năm gần nhất đã biết (carry-forward/backward),
gắn `population_source = "imputed"` — không giả vờ đó là số đo/ước lượng cho
đúng năm đó.

⚠️ Bẫy đã phát hiện khi viết `zonal_stats.py`: Khánh Hòa và Đà Nẵng có ranh
giới (theo geojson dự án) vươn ra biển Đông tới ~117.8E/112.7E (Trường Sa,
Hoàng Sa). WorldPop raster nếu không phủ hết bbox đó, tổng dân số 2 tỉnh này
qua zonal sum có thể sụt do đọc "boundless". Vì raster WorldPop là theo toàn
quốc gia (đã cắt theo ranh giới VNM chính thức của WorldPop, không phải theo
bbox tự đặt), rủi ro này thấp hơn ERA5 (xem ingest_era5.py) nhưng vẫn nên
kiểm tra tổng dân số ra số hợp lý (~90-100 triệu) trước khi tin dùng.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import requests

from app.data._retry import retry_with_backoff
from app.data.zonal_stats import load_provinces, zonal_stat_from_file

WORLDPOP_URL_TEMPLATE = (
    "https://data.worldpop.org/GIS/Population/Global_2000_2020/"
    "{year}/VNM/vnm_ppp_{year}.tif"
)
WORLDPOP_COVERAGE = (2000, 2020)  # (năm đầu, năm cuối) có raster thật

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = _DATA_DIR / "raw" / "population"


def _download_once(year: int, dest_dir: Path) -> Path:
    dest = dest_dir / f"vnm_ppp_{year}.tif"
    url = WORLDPOP_URL_TEMPLATE.format(year=year)
    with requests.get(url, stream=True, timeout=300) as resp:
        resp.raise_for_status()
        tmp = dest.with_suffix(".tif.part")
        with open(tmp, "wb") as f:
            f.writelines(resp.iter_content(chunk_size=1 << 20))
        tmp.rename(dest)
    return dest


def download_year(year: int, dest_dir: Path = RAW_DIR, attempts: int = 4) -> Path:
    """Tải raster WorldPop 1 năm. File ~150-200MB — chỉ tải nếu chưa có.

    Tự retry (exponential backoff) tới `attempts` lần nếu mạng chập chờn —
    quan trọng khi chạy không giám sát nhiều giờ (xem run_luong_a.py). File
    tải dở luôn ở dạng `.tif.part`, chỉ đổi tên thành `.tif` khi tải xong
    trọn vẹn -> lần retry sau không bao giờ dùng nhầm file dở dang.
    """
    if not (WORLDPOP_COVERAGE[0] <= year <= WORLDPOP_COVERAGE[1]):
        raise ValueError(
            f"WorldPop Global_2000_2020 không có năm {year}, "
            f"chỉ phủ {WORLDPOP_COVERAGE[0]}-{WORLDPOP_COVERAGE[1]}"
        )
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"vnm_ppp_{year}.tif"
    if dest.exists():
        return dest

    def on_retry(attempt: int, exc: Exception, delay: float) -> None:
        print(
            f"  [{year}] lỗi tải (lần {attempt}/{attempts}): {exc} — chờ {delay:.0f}s"
        )

    return retry_with_backoff(
        _download_once, year, dest_dir, attempts=attempts, on_retry=on_retry
    )


def population_for_year(tif_path: Path, provinces_gdf=None) -> pd.DataFrame:
    """Zonal sum raster WorldPop 1 năm -> (province_id, population).

    stat='sum' (không phải 'mean') vì mỗi pixel WorldPop là SỐ NGƯỜI trong
    pixel đó — cộng dồn mới ra tổng dân số tỉnh, lấy trung bình là sai đơn vị.
    """
    if provinces_gdf is None:
        provinces_gdf = load_provinces()
    result = zonal_stat_from_file(tif_path, provinces_gdf, stat="sum")
    result = result.rename(columns={"sum": "population"})
    result["population"] = result["population"].round().astype("Int64")
    return result


def build_worldpop_panel(
    years: range = range(WORLDPOP_COVERAGE[0], WORLDPOP_COVERAGE[1] + 1),
    raw_dir: Path = RAW_DIR,
) -> pd.DataFrame:
    """Tải + zonal-sum toàn bộ năm trong `years`. Trả về (province_id, year,
    population, population_source='estimated'). Chạy chậm (mỗi năm tải
    ~150-200MB) — dùng notebooks/00_ingest_population.ipynb để theo dõi
    tiến độ từng năm."""
    provinces_gdf = load_provinces()
    years = list(years)
    rows = []
    failed_years = []
    for i, year in enumerate(years, 1):
        try:
            tif_path = download_year(year, raw_dir)
            yearly = population_for_year(tif_path, provinces_gdf)
        except Exception as exc:  # noqa: BLE001 - 1 năm lỗi không dừng cả loạt
            print(f"[population {i}/{len(years)}] {year}: LỖI HẲN sau retry — {exc}")
            failed_years.append(year)
            continue
        yearly["year"] = year
        rows.append(yearly)
        print(
            f"[population {i}/{len(years)}] {year}: OK "
            f"({int(yearly['population'].sum()):,} người)"
        )
    if not rows:
        raise RuntimeError("Không năm nào tải được — kiểm tra kết nối mạng.")
    if failed_years:
        print(
            f"Năm lỗi hẳn (sẽ được nội suy bù ở extend_to_full_range): {failed_years}"
        )
    panel = pd.concat(rows, ignore_index=True)
    panel["population_source"] = "estimated"
    return panel[["province_id", "year", "population", "population_source"]]


def extend_to_full_range(panel: pd.DataFrame, target_years: range) -> pd.DataFrame:
    """Mở rộng panel WorldPop (2000-2020) ra hết `target_years` bằng cách
    lấy giá trị năm gần nhất đã biết cho mỗi tỉnh (carry-forward/backward).
    Mọi dòng mới sinh ra gắn population_source='imputed'."""
    all_years = pd.DataFrame(
        {"year": list(target_years)},
    )
    out = []
    for province_id, group in panel.groupby("province_id"):
        merged = all_years.merge(group, on="year", how="left")
        merged["province_id"] = province_id
        was_missing = merged["population"].isna()
        merged["population"] = merged["population"].ffill().bfill()
        merged["population_source"] = merged["population_source"].where(
            ~was_missing, "imputed"
        )
        out.append(merged)
    result = pd.concat(out, ignore_index=True)
    return result[["province_id", "year", "population", "population_source"]]


if __name__ == "__main__":
    _panel = build_worldpop_panel()
    _full = extend_to_full_range(_panel, range(1994, 2026))
    print(_full.head())
    print(f"{len(_full)} dòng, tổng dân số năm gần nhất:")
    latest_year = _full["year"].max()
    print(_full[_full["year"] == latest_year]["population"].sum())
