"""Phân tích exp_010: MASE M4-R2 theo điều kiện nhiễu/khuyết, độ suy giảm so với
sạch (trung bình ± độ lệch chuẩn qua REPS lần lặp, tính trên MASE của từng lần).

Kiểm tra sanity: điều kiện `clean` phải khớp M4-R2 (exp_008: 0.404/0.625/0.851/1.394,
gộp 0.8185).

Chạy: python experiments/exp_010_robustness/analyze.py  (từ ai-service/)
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

_HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 200)


def per_rep_metrics(df: pd.DataFrame) -> pd.DataFrame:
    d = df.assign(
        ep=(df.y_true - df.pred).abs() / df.pooled_scale,
        er=(df.y_true - df.pred).abs() / df.region_scale,
    )
    out = []
    for (cond, rep), g in d.groupby(["condition", "rep"]):
        by_h = g.groupby("horizon").ep.mean()
        reg = g.groupby("region").er.mean()
        ob = g[g.is_outbreak]
        out.append(
            {
                "condition": cond,
                "rep": rep,
                "h1": by_h[1],
                "h2": by_h[2],
                "h3": by_h[3],
                "h6": by_h[6],
                "all": g.ep.mean(),
                "Bac": reg["Bắc"],
                "Trung": reg["Trung"],
                "Nam": reg["Nam"],
                "outbreak": ob.ep.mean(),
                "bias_outbreak": (ob.pred - ob.y_true).mean(),
            }
        )
    return pd.DataFrame(out)


def main() -> None:
    df = pd.DataFrame(json.loads((_HERE / "results.json").read_text("utf-8")))
    m = per_rep_metrics(df)
    order = [
        "clean",
        "noise_5",
        "noise_10",
        "missing_10",
        "missing_20",
        "missing_10_imputed",
        "missing_20_imputed",
    ]
    cols = [
        "h1",
        "h2",
        "h3",
        "h6",
        "all",
        "Bac",
        "Trung",
        "Nam",
        "outbreak",
        "bias_outbreak",
    ]
    mean = m.groupby("condition")[cols].mean().loc[order]
    std = m.groupby("condition")[cols].std().loc[order]
    print("=== M4-R2: MASE theo điều kiện (trung bình qua các lần lặp) ===")
    print(mean.round(3))
    print("\n=== độ lệch chuẩn qua các lần lặp ===")
    print(std.round(4))
    clean = mean.loc["clean"]
    print("\n=== Thay đổi tương đối so với sạch (%; dương = tệ hơn) ===")
    rel = (mean / clean - 1) * 100
    print(rel.drop(columns=["bias_outbreak"]).round(1).loc[order[1:]])

    print("\n=== Sanity: clean khớp M4-R2 (exp_008)? ===")
    c = mean.loc["clean"]
    print(
        f"clean: h1 {c.h1:.3f} h2 {c.h2:.3f} h3 {c.h3:.3f} h6 {c.h6:.3f} all {c['all']:.4f} "
        "(kỳ vọng 0.404/0.625/0.851/1.394/0.8185)"
    )

    print("\n=== Độ phủ: số dòng test có đặc trưng NaN (trung bình mỗi fold) ===")
    cov = df.groupby(
        ["condition", "rep", "origin", "horizon"]
    ).rows_with_nan_features.first()
    print(cov.groupby("condition").mean().loc[order].round(1))

    print("\n=== Còn thắng seasonal-naive/B3 không? (all < 1 ; và vs M4-R2 sạch) ===")
    for cond in order:
        print(
            f"{cond:11s} MASE gộp {mean.loc[cond, 'all']:.4f}  < 1: {mean.loc[cond, 'all'] < 1}"
        )


if __name__ == "__main__":
    main()
