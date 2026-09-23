"""Ma trận kề (adjacency) giữa 34 tỉnh, suy từ ranh giới `provinces.geojson`
— dùng cho thành phần lan truyền không gian của M3 hhh4 (docs/02 §3: "Bắt
được thành phần lan truyền không gian mà GBM không có") và cho đặc trưng
"Lân cận" còn hoãn trong `features.py` (docs/02 §2.1).

2 tỉnh được coi là kề nhau nếu ranh giới GIAO NHAU (`intersects`, không chỉ
`touches`) — `provinces.geojson` đã qua đơn giản hoá (mapshaper, 15MB→599KB,
xem lịch sử dự án), ranh giới sau đơn giản hoá có thể không chạm khít tuyệt
đối như dữ liệu gốc, `touches()` (yêu cầu biên chạm CHÍNH XÁC) dễ bỏ sót
cặp tỉnh kề thật.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.data.zonal_stats import load_provinces


def build_adjacency_matrix(provinces_gdf=None) -> pd.DataFrame:
    """Trả về DataFrame vuông (34×34), index/columns = `province_id`, giá
    trị 1.0 nếu 2 tỉnh kề nhau, 0.0 nếu không (đường chéo = 0.0)."""
    if provinces_gdf is None:
        provinces_gdf = load_provinces()
    ids = provinces_gdf["province_id"].tolist()
    n = len(ids)
    mat = np.zeros((n, n))
    geoms = provinces_gdf.geometry.to_numpy()
    for i in range(n):
        for j in range(i + 1, n):
            if geoms[i].intersects(geoms[j]):
                mat[i, j] = 1.0
                mat[j, i] = 1.0
    return pd.DataFrame(mat, index=ids, columns=ids)
