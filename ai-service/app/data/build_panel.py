"""Ghép toàn bộ nguồn thành panel_monthly.parquet — xem docs/01 §4, §5.

Chạy: python -m app.data.build_panel

Kết quả: data/processed/vX.Y.Z/panel_monthly.parquet + manifest.json.

VERSION tự động: "0.2.0" nếu cả 3 file interim của Luồng A (dân số, khí
hậu, ONI) đã có ở `data/interim/` (sinh ra bởi notebooks/00-02, xem
PHASE-1-CHECKLIST.md), ngược lại giữ "0.1.0" (chỉ có OpenDengue) như cũ —
không cần sửa code khi Luồng A xong, chỉ cần chạy notebook rồi chạy lại
lệnh này.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from app.data.crosswalk import to_canonical_unit
from app.data.estimate_province import (
    compute_province_month_shares,
    disaggregate_national_to_province,
)
from app.data.ingest_opendengue import (
    ADMIN1_COVERAGE,
    download,
    load_admin0_national,
    load_admin1_provincial,
)

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_INTERIM_DIR = _DATA_DIR / "interim"

_POPULATION_PATH = _INTERIM_DIR / "population_by_province_year.parquet"
_CLIMATE_PATH = _INTERIM_DIR / "climate_by_province_month.parquet"
_ONI_PATH = _INTERIM_DIR / "oni_monthly.parquet"


def _load_interim(path: Path) -> pd.DataFrame | None:
    return pd.read_parquet(path) if path.exists() else None


def build() -> tuple[pd.DataFrame, str]:
    """Chạy toàn bộ pipeline, trả về (panel đã ghép, version suy ra được)."""
    zip_path = download()

    admin1_real = load_admin1_provincial(zip_path)
    admin0 = load_admin0_national(zip_path)

    # --- Phần THẬT: 1994-2010, cấp tỉnh trực tiếp từ OpenDengue Admin1 ---
    real_panel = to_canonical_unit(
        admin1_real, province_col="old_province_name", value_cols=["dengue_total"]
    )
    real_panel = real_panel.rename(columns={"dengue_total": "cases"})
    real_panel["data_source"] = "real"

    # --- Phần ƯỚC LƯỢNG: sau giai đoạn Admin1 thật, dùng small-area estimation ---
    admin1_end = pd.Timestamp(ADMIN1_COVERAGE[1])
    national_monthly = admin0[
        (admin0["t_res"] == "Month") & (admin0["month"] > admin1_end)
    ].copy()

    shares = compute_province_month_shares(admin1_real)
    estimated_panel = disaggregate_national_to_province(national_monthly, shares)
    estimated_panel = estimated_panel.rename(
        columns={"dengue_total_estimated": "cases"}
    )

    panel = pd.concat(
        [
            real_panel[["province_id", "month", "cases", "data_source"]],
            estimated_panel[["province_id", "month", "cases", "data_source"]],
        ],
        ignore_index=True,
    ).sort_values(["province_id", "month"])
    panel = panel.reset_index(drop=True)

    population = _load_interim(_POPULATION_PATH)
    climate = _load_interim(_CLIMATE_PATH)
    oni = _load_interim(_ONI_PATH)

    if population is not None:
        panel["year"] = panel["month"].dt.year
        panel = panel.merge(population, on=["province_id", "year"], how="left")
        # data_source của incidence phải LAN TRUYỀN từ cases, không tự "rửa"
        # thành real chỉ vì đi qua 1 phép chia — xem docs/01 §2.1c.
        panel["incidence_per_100k"] = panel["cases"] / panel["population"] * 100_000
        panel = panel.drop(columns=["year"])

    if climate is not None:
        panel = panel.merge(climate, on=["province_id", "month"], how="left")

    if oni is not None:
        panel["_year"] = panel["month"].dt.year
        panel["_month_num"] = panel["month"].dt.month
        panel = panel.merge(
            oni,
            left_on=["_year", "_month_num"],
            right_on=["year", "month"],
            how="left",
            suffixes=("", "_oni_key"),
        )
        panel = panel.drop(
            columns=["_year", "_month_num", "year", "month_oni_key"],
            errors="ignore",
        )

    version = (
        "0.2.0"
        if (population is not None and climate is not None and oni is not None)
        else "0.1.0"
    )
    return panel, version


def write(panel: pd.DataFrame, version: str) -> dict:
    """Ghi panel + manifest.json vào data/processed/vX.Y.Z/. Trả về manifest."""
    processed_dir = _DATA_DIR / "processed" / f"v{version}"
    processed_dir.mkdir(parents=True, exist_ok=True)
    out_path = processed_dir / "panel_monthly.parquet"
    panel.to_parquet(out_path, index=False)

    real_pct = (panel["data_source"] == "real").mean() * 100
    has_climate = "temp_mean" in panel.columns
    has_population = "population" in panel.columns
    has_oni = "oni" in panel.columns

    known_issues = []
    if not has_climate:
        known_issues.append(
            "Cột khí hậu (ERA5) chưa có ở version này — chạy "
            "notebooks/02_ingest_era5.ipynb rồi build lại."
        )
    if not has_population:
        known_issues.append(
            "Cột dân số/incidence_per_100k chưa có ở version này — chạy "
            "notebooks/00_ingest_population.ipynb rồi build lại."
        )
    if not has_oni:
        known_issues.append(
            "Cột ONI chưa có ở version này — chạy "
            "notebooks/01_ingest_oni.ipynb rồi build lại."
        )
    known_issues.append(
        "Cột HCDC/NSO cấp tỉnh gần đây chưa có — đang khảo sát (xem "
        "docs/01 §2.1b, §2.1c)."
    )
    known_issues.append(
        "Phần 'estimated' dùng tỉ trọng lịch sử 1994-2010, giả định phân bố "
        "dịch theo tỉnh không đổi qua thời gian — CÓ THỂ SAI ở năm bất "
        "thường (vd 2023 Hà Nội). Xem docs/00 §C.0."
    )
    if has_population:
        known_issues.append(
            "Dân số 2000-2020 tính từ WorldPop (zonal sum raster) -> "
            "population_source='estimated'; ngoài khoảng đó là carry-forward/"
            "backward năm gần nhất -> 'imputed'. Xem app/data/ingest_population.py."
        )

    manifest = {
        "version": version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sources": [
            {
                "name": "opendengue_admin1",
                "role": "real (province-month ground truth)",
                "coverage": f"{ADMIN1_COVERAGE[0]} .. {ADMIN1_COVERAGE[1]}",
                "n_rows": int((panel["data_source"] == "real").sum()),
            },
            {
                "name": "opendengue_admin0 + small-area estimation",
                "role": "estimated (KHÔNG PHẢI số đo thật — xem docs/04 §2.2)",
                "coverage": f"sau {ADMIN1_COVERAGE[1]}",
                "n_rows": int((panel["data_source"] == "estimated").sum()),
            },
        ],
        "spatial_unit": "province_34_2025",
        "temporal_range": [
            str(panel["month"].min().date()),
            str(panel["month"].max().date()),
        ],
        "n_rows": len(panel),
        "n_provinces": int(panel["province_id"].nunique()),
        "real_data_pct": round(float(real_pct), 1),
        "has_climate": has_climate,
        "has_population": has_population,
        "has_oni": has_oni,
        "known_issues": known_issues,
    }

    manifest_path = processed_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return manifest


if __name__ == "__main__":
    _panel, _version = build()
    _manifest = write(_panel, _version)
    print(json.dumps(_manifest, ensure_ascii=False, indent=2))
