from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from app.data.ingest_oni import SEASON_TO_MONTH, parse

_SAMPLE = """SEAS  YR   TOTAL   ANOM
DJF 1950  25.01  -1.32
JFM 1950  25.36  -1.20
FMA 1950  25.88  -1.12
NDJ 1951  26.20   0.45
"""


@pytest.fixture
def sample_file():
    # tempfile.TemporaryDirectory() thay vì fixture tmp_path — tránh pytest
    # đụng vào thư mục basetemp mặc định (đã gặp PermissionError riêng ở
    # máy dev Windows, không liên quan tới code, xem test_zonal_stats.py).
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "oni.ascii.txt"
        p.write_text(_SAMPLE, encoding="utf-8")
        yield p


def test_parse_maps_season_code_to_middle_month(sample_file: Path):
    df = parse(sample_file)

    assert list(df["month"]) == [1, 2, 3, 12]
    assert list(df["year"]) == [1950, 1950, 1950, 1951]


def test_parse_uses_anom_column_not_total(sample_file: Path):
    df = parse(sample_file)

    # oni phải là ANOM (độ lệch), không phải TOTAL (nhiệt độ tuyệt đối)
    assert df["oni"].tolist() == [-1.32, -1.20, -1.12, 0.45]


def test_all_12_season_codes_map_to_distinct_months():
    months = set(SEASON_TO_MONTH.values())
    assert months == set(range(1, 13))
    assert len(SEASON_TO_MONTH) == 12


def test_parse_raises_on_unknown_season_code():
    with tempfile.TemporaryDirectory() as d:
        bad = Path(d) / "bad.txt"
        bad.write_text(
            "SEAS  YR   TOTAL   ANOM\nXXX 1950  25.01  -1.32\n", encoding="utf-8"
        )
        with pytest.raises(ValueError, match="Mã mùa"):
            parse(bad)
