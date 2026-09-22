"""Export dữ liệu cho dashboard prototype (dashboard/public/data/).

Chạy: python -m app.data.export_dashboard_data

Đọc panel_monthly.parquet mới nhất (build_panel.py), tổng hợp risk_score
xếp hạng tương đối cho 12 tháng gần nhất, ghi ra
dashboard/public/data/risk_summary.json.

Đây KHÔNG phải kết quả Layer 1 (model dự báo chưa xây — xem docs/02) —
chỉ là xếp hạng thô trên dữ liệu ca bệnh, dùng để demo prototype.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_DASHBOARD_DATA_DIR = (
    Path(__file__).resolve().parents[3] / "dashboard" / "public" / "data"
)
_METADATA_PATH = _DATA_DIR / "external" / "province_metadata.csv"


def _latest_processed_dir() -> Path:
    """version có thể là 0.1.0 hoặc 0.2.0 tuỳ Luồng A đã xong chưa (xem
    build_panel.py) — luôn lấy bản mới nhất theo tên thư mục vX.Y.Z."""
    candidates = sorted((_DATA_DIR / "processed").glob("v*"))
    if not candidates:
        raise FileNotFoundError(
            "Chưa có data/processed/vX.Y.Z nào — chạy `python -m app.data.build_panel` trước."
        )
    return candidates[-1]


def export(window_months: int = 12) -> dict:
    panel = pd.read_parquet(_latest_processed_dir() / "panel_monthly.parquet")
    meta = pd.read_csv(_METADATA_PATH, encoding="utf-8")

    last_month = panel["month"].max()
    window_start = last_month - pd.DateOffset(months=window_months - 1)
    recent = panel[panel["month"] >= window_start]

    agg = (
        recent.groupby("province_id")
        .agg(
            cases_last_12m=("cases", "sum"),
            data_source=(
                "data_source",
                lambda s: "estimated" if (s == "estimated").any() else "real",
            ),
        )
        .reset_index()
    )
    agg["risk_score"] = (agg["cases_last_12m"].rank(pct=True) * 100).round(1)
    agg["cases_last_12m"] = agg["cases_last_12m"].round(0).astype(int)

    out = agg.merge(meta, left_on="province_id", right_on="new_province_code")
    out = out.rename(columns={"new_province_name": "name"})
    out = out[
        ["province_id", "name", "region", "cases_last_12m", "risk_score", "data_source"]
    ].sort_values("risk_score", ascending=False)

    result = {
        "meta": {
            "window_start": str(window_start.date()),
            "window_end": str(last_month.date()),
            "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
            "note": (
                "Xep hang tuong doi tu du lieu ca benh thuc te/uoc luong "
                "(panel v0.1.0), CHUA qua model du bao Layer 1 (dang xay dung "
                "o Phase 2)."
            ),
        },
        "provinces": json.loads(out.to_json(orient="records", force_ascii=False)),
    }

    _DASHBOARD_DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path = _DASHBOARD_DATA_DIR / "risk_summary.json"
    out_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return result


if __name__ == "__main__":
    r = export()
    print(
        f"Đã ghi {len(r['provinces'])} tỉnh vào {_DASHBOARD_DATA_DIR / 'risk_summary.json'}"
    )
