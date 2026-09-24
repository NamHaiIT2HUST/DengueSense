"""Phân tích exp_009: áp quy tắc chấp nhận KHAI BÁO TRƯỚC trên VALIDATION, rồi
báo cáo outer cho mọi biến thể (xác nhận, không dùng để chọn).

Quy tắc (xem run.py): S1/S2/S3 nhận nếu MASE gộp không tệ hơn S0 >1% VÀ (MASE
bùng dịch hoặc trung bình MASE 3 vùng giảm ≥5%); Bắc dùng S4 thay S5 nếu MASE
vùng Bắc trên validation giảm >10%.

Chạy: python experiments/exp_009_spatial_signal/analyze.py  (từ ai-service/)
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

_HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 200)


def main() -> None:
    s = pd.read_csv(_HERE / "summary.csv")
    print(s.round(3).to_string(index=False))
    v = s[s.window == "validation"].set_index("variant")
    o = s[s.window == "outer"].set_index("variant")

    print("\n=== Quy tắc trên VALIDATION (so với S0) ===")
    c0 = v.loc["S0_baseline"]
    for k in ("S1_neighbors", "S2_national", "S3_all_spatial"):
        r = v.loc[k]
        pooled = (r.mase_pooled - c0.mase_pooled) / c0.mase_pooled
        ob = (r.outbreak_mase - c0.outbreak_mase) / c0.outbreak_mase
        rg = (r.reg_avg - c0.reg_avg) / c0.reg_avg
        ok = pooled <= 0.01 and (ob <= -0.05 or rg <= -0.05)
        print(
            f"{k:16s} gộp {100 * pooled:+.1f}% | bùng dịch {100 * ob:+.1f}% | "
            f"reg_avg {100 * rg:+.1f}% -> {'NHẬN' if ok else 'không nhận'}"
        )
    bac = (v.loc["S4_v3_spatial"].reg_Bac - v.loc["S5_v3"].reg_Bac) / v.loc[
        "S5_v3"
    ].reg_Bac
    print(
        f"Bắc: S4 vs S5 trên validation {100 * bac:+.1f}% -> {'DÙNG S4' if bac < -0.10 else 'giữ S5'}"
    )

    print("\n=== OUTER (xác nhận) — thay đổi so với S0 / (Bắc: so với S5) ===")
    b0 = o.loc["S0_baseline"]
    for k in ("S1_neighbors", "S2_national", "S3_all_spatial"):
        r = o.loc[k]
        print(
            f"{k:16s} gộp {100 * (r.mase_pooled / b0.mase_pooled - 1):+.1f}% | "
            f"bùng dịch MASE {100 * (r.outbreak_mase / b0.outbreak_mase - 1):+.1f}% "
            f"(bias {b0.outbreak_bias:.1f}->{r.outbreak_bias:.1f}) | reg_avg "
            f"{100 * (r.reg_avg / b0.reg_avg - 1):+.1f}% | Bắc {b0.reg_Bac:.3f}->{r.reg_Bac:.3f}"
        )
    r5, r4 = o.loc["S5_v3"], o.loc["S4_v3_spatial"]
    print(
        f"Bắc V3: S5 {r5.reg_Bac:.3f} -> S4 (+không gian) {r4.reg_Bac:.3f} "
        f"({100 * (r4.reg_Bac / r5.reg_Bac - 1):+.1f}%)"
    )


if __name__ == "__main__":
    main()


def m4_with_spatial_north() -> None:
    """M4-R3: giữ M4-R2 (exp_008: Trung C0, Nam C3 pha B3) nhưng Bắc dùng S4
    (V3 + đặc trưng không gian, Poisson) theo quy tắc exp_009; ghép M1 từ
    exp_006 như các bước trước. So với M4-R2."""
    import json

    import numpy as np

    key = ["origin", "horizon", "province_id"]
    r9 = pd.DataFrame(json.loads((_HERE / "results.json").read_text("utf-8")))
    r9 = r9[r9.window == "outer"]
    r8 = pd.DataFrame(
        json.loads(
            (_HERE.parent / "exp_008_outbreak_north" / "results.json").read_text(
                "utf-8"
            )
        )
    )
    r8 = r8[r8.window == "outer"]
    m1 = pd.DataFrame(
        json.loads(
            (_HERE.parent / "exp_006_lopo_breakdown" / "results.json").read_text(
                "utf-8"
            )
        )["standard"]
    )[key + ["M1_glm_negbin"]]

    def build(bac_rows: pd.DataFrame) -> pd.DataFrame:
        parts = [
            bac_rows,
            r8[(r8.variant == "C0_control") & (r8.region == "Trung")],
            r8[(r8.variant == "C3_blend_B3") & (r8.region == "Nam")],
        ]
        g = pd.concat(parts).merge(m1, on=key)
        g["pred"] = np.where(
            g.M1_glm_negbin.notna(),
            (g.M1_glm_negbin.fillna(0) + 2 * g.pred) / 3,
            g.pred,
        )
        return g

    def rep(g: pd.DataFrame, name: str) -> None:
        g = g.assign(
            ep=(g.y_true - g.pred).abs() / g.pooled_scale,
            er=(g.y_true - g.pred).abs() / g.region_scale,
        )
        ob = g[g.is_outbreak]
        by = g.groupby("horizon").ep.mean()
        reg = g.groupby("region").er.mean()
        print(
            f"{name:22s} h1 {by[1]:.3f} h2 {by[2]:.3f} h3 {by[3]:.3f} h6 {by[6]:.3f} "
            f"all {g.ep.mean():.4f} | Bắc {reg['Bắc']:.3f} Trung {reg['Trung']:.3f} "
            f"Nam {reg['Nam']:.3f} | bùng dịch {ob.ep.mean():.3f} bias {(ob.pred - ob.y_true).mean():.2f}"
        )

    print("\n=== M4 đầy đủ (M1 + 2*GBM)/3, outer ===")
    a = build(r8[(r8.variant == "C1_tweedie") & (r8.region == "Bắc")])
    b = build(r9[(r9.variant == "S4_v3_spatial") & (r9.region == "Bắc")])
    rep(a, "M4-R2 (Bắc V3+Tweedie)")
    rep(b, "M4-R3 (Bắc V3+không gian)")
    ea = (
        a.assign(e=(a.y_true - a.pred).abs() / a.pooled_scale).groupby(key[:2]).e.mean()
    )
    eb = (
        b.assign(e=(b.y_true - b.pred).abs() / b.pooled_scale).groupby(key[:2]).e.mean()
    )
    print(f"fold M4-R3 tốt hơn M4-R2: {int((eb < ea).sum())}/{len(ea)}")


if __name__ == "__main__":
    m4_with_spatial_north()
