"""Phân tích sau exp_007: (1) M4 mới = (M1 + M2a' + M2b')/3 với V3 và bản
ĐỊNH TUYẾN THEO VÙNG (vùng nào V3 cải thiện >10% trên VALIDATION thì dùng V3,
còn lại giữ V0) — quy tắc chỉ dựa trên validation; (2) thử hiệu chỉnh
isotonic (fit trên validation, theo horizon) cho bias bùng dịch.

M1 lấy từ exp_006/results.json (cùng 8 origin outer, cùng cấu hình).
Chạy: python experiments/exp_007_scale_aware/analyze.py  (từ ai-service/)
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression

_HERE = Path(__file__).resolve().parent
KEY = ["origin", "horizon", "province_id"]
ROUTE_MIN_VAL_IMPROVEMENT = 0.10


def report(g: pd.DataFrame, col: str, name: str) -> None:
    g = g.copy()
    g["ep"] = (g.y_true - g[col]).abs() / g.pooled_scale
    g["er"] = (g.y_true - g[col]).abs() / g.region_scale
    ob = g[g.is_outbreak]
    print(
        f"{name:24s} h:{g.groupby('horizon').ep.mean().round(3).to_dict()} "
        f"all {g.ep.mean():.4f} | region {g.groupby('region').er.mean().round(3).to_dict()} "
        f"| outbreak MASE {ob.ep.mean():.3f} bias {(ob[col] - ob.y_true).mean():.2f}"
    )


def main() -> None:
    rows = pd.DataFrame(json.loads((_HERE / "results.json").read_text("utf-8")))
    val, out = rows[rows.window == "validation"], rows[rows.window == "outer"]
    m1 = pd.DataFrame(
        json.loads(
            (_HERE.parent / "exp_006_lopo_breakdown" / "results.json").read_text(
                "utf-8"
            )
        )["standard"]
    )[KEY + ["M1_glm_negbin"]]

    def m4(variant: str) -> pd.DataFrame:
        g = out[out.variant == variant].merge(m1, on=KEY)
        # (M1 + a + b)/3 = (M1 + 2*pred)/3; M1 loi hoi tu -> chi con GBM
        g["m4"] = np.where(
            g.M1_glm_negbin.notna(),
            (g.M1_glm_negbin.fillna(0) + 2 * g.pred) / 3,
            g.pred,
        )
        return g

    print("=== Validation: V3 vs V0, MASE theo vùng (mẫu số riêng vùng) ===")
    val = val.assign(e=(val.y_true - val.pred).abs() / val.region_scale)
    vr = val.groupby(["variant", "region"]).e.mean().unstack(0)
    print(vr.round(3))
    imp = (vr["V0_baseline"] - vr["V3_ratio_rel_features"]) / vr["V0_baseline"]
    routed = imp[imp > ROUTE_MIN_VAL_IMPROVEMENT].index.tolist()
    print(
        "Cải thiện V3 vs V0 (validation):",
        imp.round(3).to_dict(),
        "-> định tuyến:",
        routed,
    )

    a, b = m4("V0_baseline"), m4("V3_ratio_rel_features")
    c = a.copy()
    mask = c.region.isin(routed)
    c.loc[mask, "m4"] = (
        b.set_index(KEY).loc[c[mask].set_index(KEY).index, "m4"].to_numpy()
    )
    print("\n=== Outer: M4 = (M1 + M2a + M2b)/3 ===")
    report(a, "m4", "M4 hiện tại (V0)")
    report(b, "m4", "M4 toàn V3")
    report(c, "m4", f"M4 định tuyến {routed}->V3")

    print("\n=== Hiệu chỉnh isotonic (fit validation theo horizon, GBM V0) ===")
    d = out[out.variant == "V0_baseline"].copy()
    d["cal"] = d.pred
    for h in (1, 2, 3, 6):
        v = val[(val.variant == "V0_baseline") & (val.horizon == h)]
        ir = IsotonicRegression(out_of_bounds="clip", increasing=True).fit(
            v.pred, v.y_true
        )
        d.loc[d.horizon == h, "cal"] = ir.predict(d[d.horizon == h].pred)
    report(d, "pred", "GBM V0 thô")
    report(d, "cal", "GBM V0 + isotonic")


if __name__ == "__main__":
    main()
