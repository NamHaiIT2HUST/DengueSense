"""Test zonal_stats bằng raster tổng hợp trong bộ nhớ — không cần mạng."""

from __future__ import annotations

import tempfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from app.data.zonal_stats import (
    load_provinces,
    zonal_stat_from_array,
    zonal_stat_from_file,
)

# Độ phân giải thô (0.05 độ) đủ để mỗi tỉnh có nhiều pixel nhưng file vẫn
# nhỏ, chạy test nhanh.
_RES = 0.05


def _raster_bounds_covering_all_provinces(provinces) -> tuple[float, float, int, int]:
    """Suy ra bbox raster TỪ chính ranh giới 34 tỉnh, có biên (margin), để
    đảm bảo phủ hết mọi tỉnh kể cả tỉnh có đảo xa (Hoàng Sa, Trường Sa) —
    tránh raster hẹp hơn ranh giới, khiến rasterstats phải đọc "boundless"
    và làm sai lệch mean/sum ở tỉnh đó (đã từng gặp bug này khi hard-code
    bbox cố định [102, 23.6, 113, 6.6])."""
    min_x, min_y, max_x, max_y = provinces.total_bounds
    margin = _RES * 4
    west, north = min_x - margin, max_y + margin
    width = int(np.ceil((max_x - min_x + 2 * margin) / _RES))
    height = int(np.ceil((max_y - min_y + 2 * margin) / _RES))
    return west, north, width, height


def _make_constant_raster(value: float, provinces) -> tuple[np.ndarray, object]:
    west, north, width, height = _raster_bounds_covering_all_provinces(provinces)
    array = np.full((height, width), value, dtype="float32")
    affine = from_origin(west, north, _RES, _RES)
    return array, affine


def test_zonal_mean_of_constant_raster_equals_constant():
    provinces = load_provinces()
    array, affine = _make_constant_raster(27.5, provinces)

    result = zonal_stat_from_array(array, affine, provinces, stat="mean")

    assert len(result) == 34
    # Raster hằng số, phủ hết ranh giới -> mọi tỉnh phải ra đúng giá trị đó.
    means = result["mean"].dropna()
    assert len(means) == 34
    np.testing.assert_allclose(means.to_numpy(), 27.5, rtol=1e-5)


def _write_constant_tif(dest_dir: Path, name: str, value: float, provinces) -> Path:
    array, affine = _make_constant_raster(value, provinces)
    tif_path = dest_dir / name
    with rasterio.open(
        tif_path,
        "w",
        driver="GTiff",
        height=array.shape[0],
        width=array.shape[1],
        count=1,
        dtype=array.dtype,
        crs="EPSG:4326",
        transform=affine,
    ) as dst:
        dst.write(array, 1)
    return tif_path


def test_zonal_sum_from_file_matches_pixel_count_times_value():
    provinces = load_provinces()
    value = 10.0

    with tempfile.TemporaryDirectory() as tmp_dir:
        tif_path = _write_constant_tif(Path(tmp_dir), "constant.tif", value, provinces)
        result = zonal_stat_from_file(tif_path, provinces, stat="sum")

    assert len(result) == 34
    sums = result["sum"].dropna()
    assert len(sums) == 34
    # sum = value * số pixel trong ranh giới -> phải chia hết cho value
    assert all(s % value < 1e-6 for s in sums)


def test_zonal_stat_from_array_and_from_file_agree():
    provinces = load_provinces()
    array, affine = _make_constant_raster(5.0, provinces)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tif_path = _write_constant_tif(Path(tmp_dir), "same.tif", 5.0, provinces)
        from_file = zonal_stat_from_file(tif_path, provinces, stat="mean")

    from_array = zonal_stat_from_array(array, affine, provinces, stat="mean")

    merged = from_array.merge(from_file, on="province_id", suffixes=("_array", "_file"))
    np.testing.assert_allclose(
        merged["mean_array"].to_numpy(), merged["mean_file"].to_numpy()
    )
