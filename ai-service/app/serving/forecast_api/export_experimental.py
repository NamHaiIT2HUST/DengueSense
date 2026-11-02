"""Xuất phép chiếu M4-R2 năm 2026 cho demo tĩnh từ panel v0.2.0.

Chạy từ ai-service/: python -m app.serving.forecast_api.export_experimental
Không sửa panel nguồn. Các tháng 04–12/2025 được điền khuyết khi dựng PanelContext.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

from app.serving.forecast_api import engine, policy

ROOT = Path(__file__).resolve().parents[3]
DEMO = ROOT.parent / "dashboard" / "public" / "demo"
ORIGIN = "2025-12"
RUN_ID = str(
    uuid.uuid5(uuid.NAMESPACE_URL, f"denguesense:experimental:{ORIGIN}:v0.2.0")
)


def main() -> None:
    panel = pd.read_parquet(ROOT / "data/processed/v0.2.0/panel_monthly.parquet")
    meta = pd.read_csv(ROOT / "data/external/province_metadata.csv")
    regions = dict(zip(meta["new_province_code"], meta["region"], strict=True))
    ctx = engine.PanelContext(panel, regions)
    result = engine.compute_experimental_run(ctx, ORIGIN)
    generated = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    run = {
        "run_id": RUN_ID,
        "run_mode": "live_experimental",
        "status": "completed",
        "origin_month": ORIGIN,
        "model_version": policy.MODEL_VERSION,
        "data_version": policy.DATA_VERSION,
        "created_at": generated,
        "completed_at": generated,
        "error_code": None,
    }
    snapshot = {
        "run": run,
        "as_of": ctx.latest_input_month.strftime("%Y-%m-%dT00:00:00Z"),
        "legend_exceed_prob": policy.exceed_prob_legend(),
        "legend_cases_per_100k": result.legend_cases_per_100k,
        "items": result.items,
        "explanations": result.explanations,
    }
    (DEMO / f"run-{ORIGIN}.json").write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    index_path = DEMO / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    index["runs"] = [r for r in index["runs"] if r["run_id"] != RUN_ID]
    index["runs"].append(run)
    index_path.write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Xuất {len(result.items)} dự báo thử nghiệm năm 2026; nguồn cuối {snapshot['as_of']}"
    )


if __name__ == "__main__":
    main()
