"""Ghép toàn bộ nguồn thành panel_monthly.parquet — xem docs/01 §4, §5.

Chạy: python -m app.data.build_panel

Kết quả: data/processed/vX.Y.Z/panel_monthly.parquet + manifest.json.

TRẠNG THÁI HIỆN TẠI (v0.1.0): mới ghép OpenDengue (dịch tễ). Chưa có khí
hậu (ERA5, cần đăng ký tài khoản CDS), chưa có HCDC. Cột feature khí hậu
để trống ở version này — xem docs/01 §4 cho schema đầy đủ dự kiến.
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

VERSION = "0.1.0"
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_PROCESSED_DIR = _DATA_DIR / "processed" / f"v{VERSION}"


def build() -> pd.DataFrame:
    """Chạy toàn bộ pipeline, trả về panel đã ghép (chưa ghi file)."""
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

    return panel.reset_index(drop=True)


def write(panel: pd.DataFrame) -> dict:
    """Ghi panel + manifest.json vào data/processed/vX.Y.Z/. Trả về manifest."""
    _PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = _PROCESSED_DIR / "panel_monthly.parquet"
    panel.to_parquet(out_path, index=False)

    real_pct = (panel["data_source"] == "real").mean() * 100

    manifest = {
        "version": VERSION,
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
        "known_issues": [
            "Cột khí hậu (ERA5) chưa có ở version này — cần đăng ký CDS API.",
            (
                "Cột HCDC/NSO cấp tỉnh gần đây chưa có — đang khảo sát (xem "
                "docs/01 §2.1b, §2.1c)."
            ),
            (
                "Phần 'estimated' dùng tỉ trọng lịch sử 1994-2010, giả định "
                "phân bố dịch theo tỉnh không đổi qua thời gian — CÓ THỂ SAI "
                "ở năm bất thường (vd 2023 Hà Nội). Xem docs/00 §C.0."
            ),
        ],
    }

    manifest_path = _PROCESSED_DIR / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return manifest


if __name__ == "__main__":
    _panel = build()
    _manifest = write(_panel)
    print(json.dumps(_manifest, ensure_ascii=False, indent=2))
