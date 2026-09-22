"""Khí hậu ERA5-Land (Copernicus CDS) — xem PHASE-1-CHECKLIST §A3.

Cần tài khoản CDS + file `~/.cdsapirc` (bạn tự tạo, xem README của
notebooks/02_ingest_era5.ipynb) — đây là bước DUY NHẤT trong toàn bộ Luồng A
không tự động hoá được, vì cần đăng nhập bằng tài khoản cá nhân.

Cú pháp request đã đối chiếu với tài liệu CDS hiện hành (21/09/2026, sau đợt
migrate API 02/2025): dataset "reanalysis-era5-land-monthly-means",
product_type "monthly_averaged_reanalysis", format "netcdf".

⚠️ Bẫy bbox (phát hiện khi viết zonal_stats.py, xem test_zonal_stats.py):
Khánh Hòa vươn tới 117.8E (Trường Sa), Đà Nẵng tới 112.7E (Hoàng Sa) theo
ranh giới trong provinces.geojson. Nếu bbox tải ERA5 hẹp hơn ranh giới tỉnh,
zonal stat của riêng 2 tỉnh này sẽ bị "boundless read" làm sai lệch (đã tái
hiện được bug này bằng raster tổng hợp). VN_BBOX dưới đây lấy theo
total_bounds thật của provinces.geojson (+ biên an toàn), KHÔNG dùng bbox
áng chừng cho "đất liền Việt Nam".
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

import numpy as np
import pandas as pd
import rioxarray  # noqa: F401 - side effect: đăng ký accessor .rio trên xarray
import xarray as xr

from app.data._retry import retry_with_backoff

DATASET = "reanalysis-era5-land-monthly-means"
VARIABLES = ["2m_temperature", "total_precipitation", "2m_dewpoint_temperature"]

# [North, West, South, East] — bao trọn total_bounds thật của 34 tỉnh
# (102.145, 7.391, 117.817, 23.392) cộng biên an toàn ~0.3 độ mỗi phía.
VN_BBOX = [23.7, 101.8, 7.0, 118.2]

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
RAW_DIR = _DATA_DIR / "raw" / "era5"


def _fetch_year_once(year: int, dest_dir: Path) -> Path:
    import cdsapi

    dest = dest_dir / f"era5_land_monthly_{year}.nc"
    client = cdsapi.Client()
    request = {
        "product_type": ["monthly_averaged_reanalysis"],
        "variable": VARIABLES,
        "year": [str(year)],
        "month": [f"{m:02d}" for m in range(1, 13)],
        "time": ["00:00"],
        "area": VN_BBOX,
        "data_format": "netcdf",
    }
    client.retrieve(DATASET, request, str(dest))
    return dest


def fetch_year(year: int, dest_dir: Path = RAW_DIR, attempts: int = 3) -> Path:
    """1 request/năm — request nhiều năm 1 lần dễ bị CDS timeout/huỷ hàng
    đợi. Cần `cdsapi.Client()` đọc key từ ~/.cdsapirc, không truyền tay.

    Tự retry nếu request lỗi (hàng đợi CDS timeout, mất mạng) — quan trọng
    khi chạy không giám sát nhiều giờ (xem run_luong_a.py). `attempts` thấp
    hơn WorldPop (3 thay vì 4) vì bản thân 1 request CDS đã tốn nhiều phút
    xếp hàng, không nên retry dồn dập."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"era5_land_monthly_{year}.nc"
    if dest.exists():
        return dest

    def on_retry(attempt: int, exc: Exception, delay: float) -> None:
        print(
            f"  [{year}] lỗi CDS (lần {attempt}/{attempts}): {exc} — chờ {delay:.0f}s"
        )

    return retry_with_backoff(
        _fetch_year_once,
        year,
        dest_dir,
        attempts=attempts,
        base_delay=30.0,
        on_retry=on_retry,
    )


def fetch_all_years(years: Iterable[int], dest_dir: Path = RAW_DIR) -> list[int]:
    """Gọi `fetch_year()` cho từng năm, KHÔNG dừng cả loạt nếu 1 năm lỗi hẳn
    (sau khi đã tự retry bên trong `fetch_year`) — trả về danh sách năm lỗi
    để biết sau cần chạy bù."""
    years = list(years)
    failed = []
    for i, year in enumerate(years, 1):
        try:
            fetch_year(year, dest_dir)
            print(f"[era5 {i}/{len(years)}] {year}: OK")
        except Exception as exc:  # noqa: BLE001 - vòng lặp năm, cố ý không dừng cả loạt
            print(f"[era5 {i}/{len(years)}] {year}: LỖI HẲN sau retry — {exc}")
            failed.append(year)
    return failed


def load_and_convert(nc_path: Path) -> xr.Dataset:
    """Mở file .nc + đổi đơn vị về dạng dùng được trực tiếp.

    - t2m: Kelvin -> Celsius (trừ 273.15)
    - tp: mét/ngày tích luỹ trung bình tháng -> nhân 1000 * số_ngày_trong_tháng
      -> mm/tháng (ERA5-Land monthly-means báo cáo tp là trung bình NGÀY của
      tháng đó, tính bằng mét -> phải nhân lại số ngày để ra tổng lượng mưa
      tháng, không phải chỉ nhân 1000)
    - humidity: KHÔNG có sẵn trong ERA5 -> tính từ (t2m, d2m) qua công thức
      Magnus:
        e_s(T)  = 6.112 * exp(17.62*T / (T+243.12))   [T tính bằng °C]
        e_a(Td) = 6.112 * exp(17.62*Td/(Td+243.12))
        RH(%)   = 100 * e_a / e_s
    """
    ds = xr.open_dataset(nc_path)

    time_dim = "valid_time" if "valid_time" in ds.dims else "time"
    days_in_month = ds[time_dim].dt.days_in_month

    temp_c = ds["t2m"] - 273.15
    dewpoint_c = ds["d2m"] - 273.15
    precip_mm = ds["tp"] * 1000.0 * days_in_month

    e_s = 6.112 * np.exp(17.62 * temp_c / (temp_c + 243.12))
    e_a = 6.112 * np.exp(17.62 * dewpoint_c / (dewpoint_c + 243.12))
    humidity_pct = 100.0 * e_a / e_s

    out = xr.Dataset(
        {
            "temp_c": temp_c,
            "precip_mm": precip_mm,
            "humidity_pct": humidity_pct,
        }
    )
    return out


def build_climate_panel(years: Iterable[int], raw_dir: Path = RAW_DIR) -> pd.DataFrame:
    """Zonal stats (v1, area-mean) cho toàn bộ năm đã tải trong `raw_dir` —
    bỏ qua năm chưa có file .nc (vd năm lỗi hẳn sau `fetch_all_years`) thay
    vì raise, để build panel v0.2.0 được với dữ liệu có sẵn, bù năm thiếu
    sau. Trả về (province_id, month, temp_mean, precip_total, humidity_mean).
    """
    from app.data.zonal_stats import load_provinces, zonal_stat_from_array

    provinces = load_provinces()
    rows = []
    for year in years:
        nc_path = raw_dir / f"era5_land_monthly_{year}.nc"
        if not nc_path.exists():
            continue
        ds = load_and_convert(nc_path)
        time_dim = "valid_time" if "valid_time" in ds.dims else "time"
        for t in ds[time_dim].values:
            month_ds = ds.sel({time_dim: t})
            affine = month_ds["temp_c"].rio.write_crs("EPSG:4326").rio.transform()
            temp = zonal_stat_from_array(
                month_ds["temp_c"].values, affine, provinces, stat="mean"
            )
            precip = zonal_stat_from_array(
                month_ds["precip_mm"].values, affine, provinces, stat="mean"
            )
            humidity = zonal_stat_from_array(
                month_ds["humidity_pct"].values, affine, provinces, stat="mean"
            )
            merged = temp.rename(columns={"mean": "temp_mean"})
            merged["precip_total"] = precip["mean"]
            merged["humidity_mean"] = humidity["mean"]
            merged["month"] = pd.Timestamp(t).replace(day=1)
            rows.append(merged)
        print(f"[zonal era5] {year}: OK")

    if not rows:
        raise RuntimeError(
            f"Không tìm thấy file .nc nào trong {raw_dir} — chạy fetch_all_years() trước."
        )
    return pd.concat(rows, ignore_index=True)


def sanity_check(ds: xr.Dataset) -> pd.DataFrame:
    """In min/mean/max cho từng biến — nhiệt độ VN phải trong khoảng
    5-40°C, độ ẩm 30-100%, mưa >=0. Ra ngoài khoảng này gần như chắc chắn
    là quên đổi đơn vị."""
    rows = []
    for name in ["temp_c", "precip_mm", "humidity_pct"]:
        values = ds[name].values
        rows.append(
            {
                "variable": name,
                "min": float(np.nanmin(values)),
                "mean": float(np.nanmean(values)),
                "max": float(np.nanmax(values)),
            }
        )
    return pd.DataFrame(rows)
