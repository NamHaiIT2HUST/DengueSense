"""Gộp raster (lưới) về 34 tỉnh bằng zonal statistics — xem PHASE-1-CHECKLIST §A4.

Dùng chung cho 2 nguồn khác nhau:
- Dân số (WorldPop, 1 file .tif = 1 năm, 1 band) -> stat="sum" (tổng số người
  trong ranh giới tỉnh, không phải trung bình).
- Khí hậu (ERA5-Land, 1 file .nc = nhiều tháng) -> stat="mean" (trung bình
  theo diện tích trong ranh giới tỉnh).

v1 = trung bình/tổng theo diện tích đơn thuần (không trọng số). v2 (trọng số
dân số cho khí hậu) là nâng cấp sau, không chặn tiến độ Phase 1.
"""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pandas as pd
import rasterstats

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
PROVINCES_GEOJSON = _DATA_DIR / "external" / "provinces.geojson"


def load_provinces(path: Path = PROVINCES_GEOJSON) -> gpd.GeoDataFrame:
    """Đọc ranh giới 34 tỉnh, đảm bảo CRS là EPSG:4326 (khớp ERA5/WorldPop)."""
    gdf = gpd.read_file(path)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")
    return gdf


def zonal_stat_from_file(
    raster_path: Path,
    provinces_gdf: gpd.GeoDataFrame,
    stat: str = "mean",
    band: int = 1,
    province_id_col: str = "province_id",
) -> pd.DataFrame:
    """Zonal stat cho raster 1 band nằm sẵn trên đĩa (dùng cho WorldPop .tif).

    Trả về DataFrame (province_id, value).
    """
    results = rasterstats.zonal_stats(
        vectors=provinces_gdf,
        raster=str(raster_path),
        stats=[stat],
        band=band,
        nodata=None,
        geojson_out=False,
    )
    return pd.DataFrame(
        {
            "province_id": provinces_gdf[province_id_col].to_numpy(),
            stat: [r[stat] for r in results],
        }
    )


def zonal_stat_from_array(
    array,
    affine,
    provinces_gdf: gpd.GeoDataFrame,
    stat: str = "mean",
    nodata: float | None = None,
    province_id_col: str = "province_id",
) -> pd.DataFrame:
    """Zonal stat cho 1 lát cắt raster đã có sẵn trong bộ nhớ (numpy 2D array
    + affine transform) — dùng cho từng tháng của ERA5 NetCDF sau khi đọc
    bằng rioxarray, không cần ghi file tạm ra đĩa.
    """
    results = rasterstats.zonal_stats(
        vectors=provinces_gdf,
        raster=array,
        affine=affine,
        stats=[stat],
        nodata=nodata,
        geojson_out=False,
    )
    return pd.DataFrame(
        {
            "province_id": provinces_gdf[province_id_col].to_numpy(),
            stat: [r[stat] for r in results],
        }
    )
