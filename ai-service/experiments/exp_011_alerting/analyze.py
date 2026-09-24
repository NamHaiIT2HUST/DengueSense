"""Phân tích exp_011 — cảnh báo vượt ngưỡng P75 từ M4-R2 (docs/02 §5.2-5.3).

Quy trình (khai báo trước): (1) 4 cách ra xác suất — Poisson thô (không hiệu
chỉnh), Platt, Isotonic, Residual (phân phối thực nghiệm); bộ hiệu chỉnh fit
theo TỪNG horizon trên validation. (2) CHỌN cách tốt nhất bằng Brier
leave-one-origin-out TRÊN VALIDATION (không dùng outer để chọn). (3) Báo cáo
outer cho mọi cách: PR-AUC, Brier, ECE, Recall@P=0.8, Precision@R=0.8, base
rate; reliability diagram; lead time xấp xỉ.

Chạy: python experiments/exp_011_alerting/analyze.py  (từ ai-service/)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import precision_recall_curve, roc_auc_score

from app.forecast.alerting import (
    IsotonicCalibrator,
    PlattCalibrator,
    ResidualCalibrator,
    expected_calibration_error,
    poisson_exceed_prob,
    reliability_table,
)
from app.forecast.metrics import brier_score, pr_auc, recall_at_precision

_HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 200)
HORIZONS = (1, 2, 3, 6)
METHODS = ("poisson_raw", "platt", "isotonic", "residual")
CAL = {
    "platt": PlattCalibrator,
    "isotonic": IsotonicCalibrator,
    "residual": ResidualCalibrator,
}


def precision_at_recall(
    y: np.ndarray, score: np.ndarray, target_recall: float
) -> float:
    precision, recall, _ = precision_recall_curve(y, score)
    ok = precision[recall >= target_recall]
    return float(ok.max()) if ok.size else float("nan")


def fit_apply(method: str, fit_df: pd.DataFrame, apply_df: pd.DataFrame) -> np.ndarray:
    """Xác suất cho apply_df; bộ hiệu chỉnh fit trên fit_df (theo từng horizon)."""
    out = np.full(len(apply_df), np.nan)
    for h in HORIZONS:
        mask = (apply_df["horizon"] == h).to_numpy()
        if not mask.any():
            continue
        a = apply_df[mask]
        if method == "poisson_raw":
            out[mask] = poisson_exceed_prob(a["pred"], a["population"], a["thr"])
            continue
        f = fit_df[fit_df["horizon"] == h]
        cal = CAL[method]()
        target = f["y_true"] if method == "residual" else f["label"]
        cal.fit(f["pred"], f["thr"], target)
        out[mask] = cal.predict_proba(a["pred"], a["thr"])
    return out


def main() -> None:
    df = pd.DataFrame(json.loads((_HERE / "predictions.json").read_text("utf-8")))
    df["label"] = (df["y_true"] > df["thr"]).astype(int)
    val = df[df.window == "validation"].reset_index(drop=True)
    out = df[df.window == "outer"].reset_index(drop=True)

    print("=== Base rate (tỉ lệ vượt ngưỡng P75) ===")
    print(
        pd.DataFrame(
            {
                "validation": val.groupby("horizon").label.mean(),
                "outer": out.groupby("horizon").label.mean(),
            }
        ).round(3)
    )
    print("outer theo vùng:", out.groupby("region").label.mean().round(3).to_dict())
    print(
        "tỉnh có ngưỡng = 0 (nhãn = 'có ca'):",
        f"{(out.thr == 0).mean():.1%} của quan sát outer",
    )

    print("\n=== CHỌN cách hiệu chỉnh: Brier leave-one-origin-out trên VALIDATION ===")
    loo = {}
    for m in ("platt", "isotonic", "residual"):
        p = np.full(len(val), np.nan)
        for o in sorted(val.origin.unique()):
            te = (val.origin == o).to_numpy()
            p[te] = fit_apply(m, val[~te], val[te])
        loo[m] = brier_score(val.label, p)
    loo["poisson_raw"] = brier_score(
        val.label, poisson_exceed_prob(val.pred, val.population, val.thr)
    )
    for k, v in sorted(loo.items(), key=lambda kv: kv[1]):
        print(f"  {k:12s} Brier(LOO validation) = {v:.4f}")
    best = min(loo, key=loo.get)
    print("=> chọn:", best)

    probs = {m: fit_apply(m, val, out) for m in METHODS}
    # Hieu chinh TRUC TUYEN: moi (origin, horizon) chi fit tren cac ket qua da
    # "truong thanh" (target_month <= train_end cua origin do) — dung nhu van hanh
    # that, khi bo hieu chinh duoc fit lai theo thoi gian (base rate doi qua nam).
    tmonth = pd.to_datetime(df["target_month"])
    for m in ("platt", "isotonic"):
        p_on = np.full(len(out), np.nan)
        for idx in out.groupby(["origin", "horizon"]).groups.values():
            grp = out.loc[idx]
            te = pd.Timestamp(grp["train_end"].iloc[0])
            p_on[out.index.get_indexer(idx)] = fit_apply(m, df[tmonth <= te], grp)
        probs[f"{m}_online"] = p_on
    methods_all = tuple(probs)
    out = out.assign(**{f"p_{m}": probs[m] for m in methods_all})
    out["score_ratio"] = out["pred"] / (out["thr"] + 1.0)

    print("\n=== OUTER: chỉ số cảnh báo (fit hiệu chỉnh trên validation) ===")
    rows = []
    for h in (*HORIZONS, "all"):
        g = out if h == "all" else out[out.horizon == h]
        y = g.label.to_numpy()
        base = {"horizon": h, "base_rate": y.mean(), "n": len(g)}
        for m in methods_all:
            p = g[f"p_{m}"].to_numpy()
            rows.append(
                {
                    **base,
                    "method": m,
                    "PR_AUC": pr_auc(y, p),
                    "ROC_AUC": roc_auc_score(y, p),
                    "Brier": brier_score(y, p),
                    "ECE": expected_calibration_error(y, p),
                    "Recall@P0.8": recall_at_precision(y, p, 0.8),
                    "Prec@R0.8": precision_at_recall(y, p, 0.8),
                }
            )
        rows.append(
            {
                **base,
                "method": "score_ratio(pred/thr)",
                "PR_AUC": pr_auc(y, g.score_ratio.to_numpy()),
                "ROC_AUC": roc_auc_score(y, g.score_ratio.to_numpy()),
                "Recall@P0.8": recall_at_precision(y, g.score_ratio.to_numpy(), 0.8),
                "Prec@R0.8": precision_at_recall(y, g.score_ratio.to_numpy(), 0.8),
            }
        )
    res = pd.DataFrame(rows)
    print(res.round(3).to_string(index=False))
    res.round(4).to_csv(_HERE / "summary.csv", index=False)

    print("\n=== OUTER theo vùng (cách được chọn) ===")
    for r, g in out.groupby("region"):
        y, p = g.label.to_numpy(), g[f"p_{best}"].to_numpy()
        print(
            f"{r:6s} base {y.mean():.3f} | PR-AUC {pr_auc(y, p):.3f} | Brier {brier_score(y, p):.3f} "
            f"| Recall@P0.8 {recall_at_precision(y, p, 0.8):.3f} | n={len(g)}"
        )

    # reliability diagram: poisson_raw vs cach duoc chon
    fig, ax = plt.subplots(figsize=(5.5, 5), dpi=150)
    ax.plot([0, 1], [0, 1], "k:", lw=1)
    for m, style in (("poisson_raw", "o--"), (best, "s-")):
        t = reliability_table(out.label.to_numpy(), out[f"p_{m}"].to_numpy(), 10)
        ax.plot(
            t.p_mean,
            t.observed,
            style,
            label=f"{m} (ECE {expected_calibration_error(out.label.to_numpy(), out[f'p_{m}'].to_numpy()):.3f})",
        )
    ax.set_xlabel("Xác suất dự báo")
    ax.set_ylabel("Tỉ lệ thực tế vượt ngưỡng")
    ax.set_title("Reliability diagram — M4-R2, outer, mọi horizon")
    ax.legend()
    fig.tight_layout()
    fig.savefig(_HERE / "reliability.png")

    print("\n=== Lead time xấp xỉ (tháng) ===")
    # tau: nguong xac suat nho nhat dat precision >= 0.8 tren VALIDATION (cach duoc chon)
    pv = np.full(len(val), np.nan)
    for o in sorted(val.origin.unique()):
        te = (val.origin == o).to_numpy()
        pv[te] = fit_apply(best, val[~te], val[te])
    prec, _rec, thr_curve = precision_recall_curve(val.label, pv)
    ok = np.where(prec[:-1] >= 0.8)[0]
    tau = float(thr_curve[ok].min()) if ok.size else 0.5
    print(f"tau (precision>=0.8 trên validation LOO) = {tau:.3f}")
    out["alert"] = out[f"p_{best}"] >= tau
    ev = out[out.label == 1]
    per_event = (
        ev[ev.alert]
        .groupby(["province_id", "target_month"])
        .horizon.max()
        .rename("lead_months")
    )
    n_events = ev.groupby(["province_id", "target_month"]).ngroups
    multi = ev.groupby(["province_id", "target_month"]).horizon.nunique()
    print(
        f"sự kiện vượt ngưỡng (tỉnh×tháng): {n_events}; có báo trước ≥1 horizon: {len(per_event)} "
        f"({len(per_event) / n_events:.1%})"
    )
    print(
        f"lead time trung vị = {per_event.median():.1f} tháng "
        f"(≈ {per_event.median() * 4.35:.0f} tuần); phân bố: "
        f"{per_event.value_counts().sort_index().to_dict()}"
    )
    print(
        f"(chỉ {int((multi >= 2).sum())} sự kiện có ≥2 horizon dự báo; 1 mùa dịch 2009-11..2010-12)"
    )
    print("\nRecall theo horizon tại tau:")
    print(out[out.label == 1].groupby("horizon").alert.mean().round(3).to_dict())
    print("Precision theo horizon tại tau:")
    print(out[out.alert].groupby("horizon").label.mean().round(3).to_dict())


if __name__ == "__main__":
    main()
