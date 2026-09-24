"""Phân tích ablation định tuyến (exp_016b): thiết kế định tuyến vùng của M4-R2 có
khái quát qua 6 mùa không? So M4-R2 / no_routing / bac_only / nam_only.

Sanity: cấu hình M4-R2 ở đây phải KHỚP TUYỆT ĐỐI cột `m4` của results.json.
Chạy: python experiments/exp_016_multiseason/analyze_ablation.py  (từ ai-service/)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import numpy as np
import pandas as pd

from app.forecast.multiseason import cluster_bootstrap_ci, sign_test_pvalue

_HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 200)
VARIANTS = ["no_routing", "bac_only", "nam_only", "M4-R2"]


def mase(df, col, by, scale="pooled_scale"):
    e = (df["y_true"] - df[col]).abs() / df[scale]
    return e.groupby([df[b] for b in by]).mean()


def main() -> None:
    ab = pd.DataFrame(
        json.loads((_HERE / "results_ablation.json").read_text("utf-8"))["rows"]
    )
    main_rows = pd.DataFrame(
        json.loads((_HERE / "results.json").read_text("utf-8"))["forecast"]
    )
    key = ["season", "origin", "horizon", "province_id"]
    j = ab.merge(main_rows[key + ["m4"]], on=key)
    print(
        f"[SANITY] {len(j)} dòng khớp; |M4-R2(ablation) − m4(results.json)| tối đa = "
        f"{float((j['M4-R2'] - j['m4']).abs().max()):.2e} (kỳ vọng 0)"
    )

    print("\n=== MASE gộp theo mùa (mẫu số gộp toàn quốc) ===")
    t = pd.DataFrame({v: mase(ab, v, ["season"]) for v in VARIANTS})
    print(t.round(4))
    print("TB:", t.mean().round(4).to_dict())
    print("\nCải thiện so với no_routing (%; dương = tốt hơn):")
    imp = pd.DataFrame(
        {v: (1 - t[v] / t["no_routing"]) * 100 for v in VARIANTS if v != "no_routing"}
    )
    print(imp.round(2))
    print(
        "Số mùa tốt hơn no_routing:",
        {v: int((imp[v] > 0).sum()) for v in imp.columns},
    )

    print("\n=== Theo vùng (mẫu số riêng vùng): MASE mỗi cấu hình ===")
    for region in ("Bắc", "Trung", "Nam"):
        sub = ab[ab.region == region]
        r = pd.DataFrame(
            {v: mase(sub, v, ["season"], "region_scale") for v in VARIANTS}
        )
        print(f"\n{region}:")
        print(r.round(3))
        print(
            "  M4-R2 vs no_routing: số mùa tốt hơn",
            int((r["M4-R2"] < r["no_routing"]).sum()),
            "/",
            len(r),
            "| TB thay đổi %",
            round(float(((r["M4-R2"] / r["no_routing"] - 1) * 100).mean()), 2),
        )

    print("\n=== Bootstrap theo origin: M4-R2 vs no_routing (cải thiện MASE gộp) ===")
    per = []
    for (_, _), o in ab.groupby(["season", "origin"]):
        m = (o.y_true - o["M4-R2"]).abs().mean()
        b = (o.y_true - o["no_routing"]).abs().mean()
        per.append(1 - m / b)
    per = np.array(per)
    mean, lo, hi = cluster_bootstrap_ci(per)
    print(
        f"TB {100 * mean:+.2f}% (CI95 {100 * lo:+.2f}%…{100 * hi:+.2f}%); "
        f"origin thắng: {int((per > 0).sum())}/{len(per)}; p dấu = {sign_test_pvalue(per):.3g}"
    )

    print("\n=== Theo horizon (MASE gộp TB qua mùa) ===")
    print(pd.DataFrame({v: mase(ab, v, ["horizon"]) for v in VARIANTS}).round(4))


if __name__ == "__main__":
    main()
