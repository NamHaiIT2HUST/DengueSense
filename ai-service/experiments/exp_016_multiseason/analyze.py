"""Phân tích exp_016 — đánh giá nhiều mùa (2005–2010).

In: (0) sanity mùa 2010 khớp exp_015; (1) MASE M4-R2 vs B3/B2 theo mùa và horizon;
(2) biến thiên giữa mùa; (3) khoảng tin cậy bootstrap (theo origin) + kiểm định dấu;
(4) theo vùng; (5) bùng dịch; (6) cảnh báo theo mùa (ROC/PR-AUC, base rate).

⚠️ Bootstrap theo origin còn LẠC QUAN (origin liền kề cùng mùa tự tương quan) — đọc
cùng biến thiên giữa mùa. Không mùa nào là "sạch tuyệt đối" cho M4-R2 (xem
`app/forecast/multiseason.py`).

Chạy: python experiments/exp_016_multiseason/analyze.py  (từ ai-service/)
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
from sklearn.metrics import average_precision_score, roc_auc_score

from app.forecast.multiseason import cluster_bootstrap_ci, sign_test_pvalue

_HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 200)
HZ = (1, 2, 3, 6)


def mase_by(df: pd.DataFrame, col: str, by: list[str], scale: str = "pooled_scale"):
    d = df.dropna(subset=[col])
    e = (d["y_true"] - d[col]).abs() / d[scale]
    return e.groupby([d[b] for b in by]).mean()


def main() -> None:
    state = json.loads((_HERE / "results.json").read_text("utf-8"))
    f = pd.DataFrame(state["forecast"])
    a = pd.DataFrame(state["alert"])
    seasons = sorted(f.season.unique())
    print(f"mùa đã chạy: {seasons}; dòng dự báo {len(f)}, dòng cảnh báo {len(a)}")

    # (0) sanity 2010 vs exp_015
    p15 = pd.DataFrame(
        json.loads(
            (_HERE.parent / "exp_015_calendar_lags" / "predictions.json").read_text(
                "utf-8"
            )
        )
    )
    s10 = f[f.season == 2010].merge(
        p15[["origin", "horizon", "province_id", "pred"]],
        on=["origin", "horizon", "province_id"],
    )
    if len(s10):
        print(
            f"\n[SANITY] mùa 2010: {len(s10)} dòng khớp exp_015; sai lệch tuyệt đối tối đa "
            f"M4 = {float((s10.m4 - s10.pred).abs().max()):.2e} (kỳ vọng ~0)"
        )

    # (1) MASE theo mùa x horizon
    print("\n=== (1) MASE theo mùa (mẫu số gộp toàn quốc của từng origin) ===")
    tab = {}
    for name, col in (("M4-R2", "m4"), ("B3", "b3"), ("B2", "b2")):
        m = mase_by(f, col, ["season", "horizon"]).unstack()
        m["gộp"] = mase_by(f, col, ["season"])
        tab[name] = m
        print(f"\n{name}:\n{m.round(3)}")
    imp = (1 - tab["M4-R2"] / tab["B3"]) * 100
    print("\nCải thiện M4-R2 so với B3 (%; dương = tốt hơn):")
    print(imp.round(1))

    # (2) biến thiên giữa mùa
    print("\n=== (2) Biến thiên giữa các mùa (M4-R2) ===")
    m4t = tab["M4-R2"]
    print(
        pd.DataFrame(
            {
                "trung bình": m4t.mean(),
                "độ lệch chuẩn": m4t.std(),
                "min": m4t.min(),
                "max": m4t.max(),
            }
        ).round(3)
    )
    wins = (tab["M4-R2"] < tab["B3"]).sum()
    print(
        f"\nSố mùa (trên {len(seasons)}) M4-R2 thắng B3 theo horizon:", wins.to_dict()
    )

    # (3) bootstrap theo origin + kiểm định dấu
    print(
        "\n=== (3) Khoảng tin cậy 95% (bootstrap theo origin) cho cải thiện M4-R2 vs B3 ==="
    )
    rows = []
    for h in (*HZ, "gộp"):
        g = f if h == "gộp" else f[f.horizon == h]
        per = []
        for (_, _), o in g.groupby(["season", "origin"]):
            m = (o.y_true - o.m4).abs().mean() / o.pooled_scale.iloc[0]
            b = (o.y_true - o.b3).abs().mean() / o.pooled_scale.iloc[0]
            per.append(1 - m / b)
        per = np.array(per)
        mean, lo, hi = cluster_bootstrap_ci(per)
        rows.append(
            {
                "horizon": h,
                "cải thiện TB %": 100 * mean,
                "CI95 dưới %": 100 * lo,
                "CI95 trên %": 100 * hi,
                "origin thắng B3": f"{int((per > 0).sum())}/{len(per)}",
                "p (kiểm định dấu)": sign_test_pvalue(per),
            }
        )
    print(pd.DataFrame(rows).round(4).to_string(index=False))

    # (4) theo vùng
    print("\n=== (4) MASE theo vùng, mẫu số riêng từng vùng (M4-R2 | B3) ===")
    rm = mase_by(f, "m4", ["season", "region"], "region_scale").unstack()
    rb = mase_by(f, "b3", ["season", "region"], "region_scale").unstack()
    print("M4-R2:\n", rm.round(3))
    print("B3:\n", rb.round(3))
    print(
        "TB ± sd giữa mùa (M4-R2):",
        {r: f"{rm[r].mean():.3f}±{rm[r].std():.3f}" for r in rm.columns},
    )
    print("Số mùa M4-R2 < 1 (thắng seasonal-naive):", (rm < 1).sum().to_dict())
    print("Số mùa M4-R2 thắng B3 theo vùng:", (rm < rb).sum().to_dict())

    # (5) bùng dịch
    print("\n=== (5) Tháng bùng dịch (p90 theo tỉnh) — M4-R2 ===")
    ob = f[f.is_outbreak]
    bias = (ob.m4 - ob.y_true).groupby(ob.season).mean().rename("bias (ca/100k)")
    share = (
        (ob.m4 < 0.5 * ob.y_true)
        .groupby(ob.season)
        .mean()
        .rename("tỉ lệ dự báo <50% thực tế")
    )
    print(pd.concat([bias, share], axis=1).round(2))

    # (6) cảnh báo
    print("\n=== (6) Cảnh báo (classifier) theo mùa ===")
    rows = []
    for s, g in a.groupby("season"):
        y, p = g.label.to_numpy(), g.p_clf.to_numpy()
        rows.append(
            {
                "mùa": s,
                "base rate": y.mean(),
                "ROC-AUC": roc_auc_score(y, p),
                "PR-AUC": average_precision_score(y, p),
                "n": len(g),
            }
        )
    at = pd.DataFrame(rows).set_index("mùa")
    print(at.round(3))
    print(
        f"ROC-AUC TB {at['ROC-AUC'].mean():.3f} ± {at['ROC-AUC'].std():.3f} "
        f"(min {at['ROC-AUC'].min():.3f}, max {at['ROC-AUC'].max():.3f}); "
        f"số mùa ROC ≥ 0.83: {(at['ROC-AUC'] >= 0.83).sum()}/{len(at)}"
    )
    print("\nROC-AUC theo horizon x mùa:")
    hz = {}
    for (s, h), g in a.groupby(["season", "horizon"]):
        hz[(s, h)] = roc_auc_score(g.label, g.p_clf)
    print(pd.Series(hz).unstack().round(3))
    print("\nROC-AUC theo vùng x mùa:")
    rg = {}
    for (s, r), g in a.groupby(["season", "region"]):
        rg[(s, r)] = roc_auc_score(g.label, g.p_clf)
    rgt = pd.Series(rg).unstack()
    print(rgt.round(3))
    print(
        "TB ± sd:", {r: f"{rgt[r].mean():.3f}±{rgt[r].std():.3f}" for r in rgt.columns}
    )


if __name__ == "__main__":
    main()
