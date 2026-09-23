from __future__ import annotations

from app.data.adjacency import build_adjacency_matrix
from app.data.zonal_stats import load_provinces


def test_matrix_is_square_and_symmetric():
    adj = build_adjacency_matrix()
    assert adj.shape == (34, 34)
    assert (adj.to_numpy() == adj.to_numpy().T).all()


def test_diagonal_is_zero():
    adj = build_adjacency_matrix()
    assert (adj.to_numpy().diagonal() == 0).all()


def test_every_province_has_at_least_one_neighbor():
    adj = build_adjacency_matrix()
    assert (adj.sum(axis=1) > 0).all()


def test_hanoi_neighbors_are_plausible_mainland_provinces():
    """Kiểm tra tránh false-adjacency do polygon đảo xa (Trường Sa/Hoàng Sa,
    xem cảnh báo trong ingest_era5.py) — láng giềng phải là tỉnh liền kề
    thật, không lẫn tỉnh xa do lỗi hình học."""
    adj = build_adjacency_matrix()
    neighbors = set(adj.columns[adj.loc["ha_noi"] == 1])
    assert "ha_giang" not in neighbors  # qua xa, khong giap Ha Noi
    assert len(neighbors) >= 2


def test_khanh_hoa_neighbors_exclude_far_provinces_despite_truong_sa():
    """Khánh Hòa có polygon vươn tới Trường Sa (117.8E) — không được vì thế
    mà bị tính kề với tỉnh xa nào đó do bounding box chồng lấn giả."""
    adj = build_adjacency_matrix()
    neighbors = set(adj.columns[adj.loc["khanh_hoa"] == 1])
    assert len(neighbors) <= 5
    assert "ha_noi" not in neighbors


def test_consistent_with_load_provinces_ids():
    provinces = load_provinces()
    adj = build_adjacency_matrix(provinces)
    assert set(adj.index) == set(provinces["province_id"])
