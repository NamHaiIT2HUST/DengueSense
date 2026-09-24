"""Phân tích exp_008: (1) quy tắc chấp nhận toàn cục (validation); (2) định
tuyến theo vùng — mỗi vùng dùng đòn bẩy có MASE vùng (mẫu số riêng vùng) tốt
nhất trên VALIDATION nếu cải thiện >10% so với C0, ngược lại giữ C0 — rồi
xác nhận trên outer.

Chạy: python experiments/exp_008_outbreak_north/analyze.py  (từ ai-service/)
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

_HERE = Path(__file__).resolve().parent
MIN_IMPROVEMENT = 0.10


def report(g: pd.DataFrame, name: str) -> None:
    g = g.assign(
        ep=(g.y_true - g.pred).abs() / g.pooled_scale,
        er=(g.y_true - g.pred).abs() / g.region_scale,
    )
    ob = g[g.is_outbreak]
    print(
        f"{name:34s} h:{g.groupby('horizon').ep.mean().round(3).to_dict()} "
        f"all {g.ep.mean():.4f} | region {g.groupby('region').er.mean().round(3).to_dict()} "
        f"| outbreak MASE {ob.ep.mean():.3f} bias {(ob.pred - ob.y_true).mean():.2f}"
    )


def main() -> None:
    rows = pd.DataFrame(json.loads((_HERE / "results.json").read_text("utf-8")))
    val, out = rows[rows.window == "validation"], rows[rows.window == "outer"]
    val = val.assign(e=(val.y_true - val.pred).abs() / val.region_scale)
    vr = val.groupby(["variant", "region"]).e.mean().unstack(0)
    print("Validation MASE theo vùng x đòn bẩy:\n", vr.round(3))
    choice = {}
    for region, r in vr.iterrows():
        best = r.drop("C0_control").idxmin()
        gain = (r["C0_control"] - r[best]) / r["C0_control"]
        choice[region] = best if gain > MIN_IMPROVEMENT else "C0_control"
        print(
            f"  {region}: tốt nhất {best} ({100 * gain:+.1f}% vs C0) -> {choice[region]}"
        )
    print("\n=== OUTER ===")
    for v in sorted(out.variant.unique()):
        report(out[out.variant == v], v)
    routed = pd.concat(
        [out[(out.variant == v) & (out.region == r)] for r, v in choice.items()]
    )
    report(routed, f"ĐỊNH TUYẾN {choice}")


if __name__ == "__main__":
    main()
