"""Chạy động cơ THẬT trong một tiến trình SẠCH và in kết quả (JSON) ra stdout.

Vì sao tách tiến trình: nạp R/rpy2 (test_models_r) trong cùng tiến trình làm đổi nhẹ kết quả số của các mô hình fit sau đó
(~0,03% — khác thư viện BLAS/luồng). Service `forecast` thật không nạp R, nên kiểm "khớp exp_016" phải chạy trong điều kiện
giống service: một tiến trình sạch.
"""

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from app.serving.forecast_api import engine

meta = pd.read_csv(ROOT / "data" / "external" / "province_metadata.csv")
regions = dict(zip(meta["new_province_code"], meta["region"], strict=True))
panel = pd.read_parquet(
    ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
)
run = engine.compute_backtest_run(engine.PanelContext(panel, regions), sys.argv[1])
print(
    json.dumps(
        {
            "origin_month": run.origin_month,
            "items": run.items,
            "explanations": run.explanations,
            "legend_cases_per_100k": run.legend_cases_per_100k,
        }
    )
)
