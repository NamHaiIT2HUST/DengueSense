"""Phân tích exp_013: áp quy tắc chấp nhận KHAI BÁO TRƯỚC trên VALIDATION
(PR-AUC gộp tăng ≥5% tương đối VÀ ROC-AUC gộp không giảm, so với A0), rồi báo
cáo outer cho mọi đòn bẩy (xác nhận, không dùng để chọn). A3 = trung bình hạng
(theo từng horizon) của A0 và điểm suy từ hồi quy M4-R2 (exp_011).

Chạy: python experiments/exp_013_alert_levers/analyze.py  (từ ai-service/)
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
from sklearn.metrics import precision_recall_curve, roc_auc_score

from app.forecast.metrics import pr_auc, recall_at_precision

_HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 200)
KEY = ["window", "origin", "horizon", "province_id"]
LEVERS = ["A0", "A1", "A2", "A3"]


def prec_at_recall(y, s, r):
    p, rc, _ = precision_recall_curve(y, s)
    ok = p[rc >= r]
    return float(ok.max()) if ok.size else float("nan")


def metrics(y, s) -> dict:
    return {
        "PR_AUC": pr_auc(y, s),
        "ROC_AUC": roc_auc_score(y, s),
        "Recall@P0.8": recall_at_precision(y, s, 0.8),
        "Prec@R0.8": prec_at_recall(y, s, 0.8),
    }


def main() -> None:
    a = pd.DataFrame(json.loads((_HERE / "predictions.json").read_text("utf-8")))
    d = pd.DataFrame(
        json.loads(
            (_HERE.parent / "exp_011_alerting" / "predictions.json").read_text("utf-8")
        )
    )
    df = a.merge(d[KEY + ["pred", "thr"]], on=KEY, how="inner")
    df["score_derived"] = np.log((df["pred"] + 1.0) / (df["thr"] + 1.0))
    # A3: trung binh hang trong tung (window, horizon)
    g = df.groupby(["window", "horizon"])
    df["p_A3"] = g["p_A0"].rank(pct=True) + g["score_derived"].rank(pct=True)
    for c in ("A0", "A1", "A2", "A3"):
        assert f"p_{c}" in df.columns

    val = df[df.window == "validation"]
    out = df[df.window == "outer"]

    print(f"dòng: validation {len(val)}, outer {len(out)}")
    print(
        "\n=== VALIDATION (quy tắc: PR-AUC +5% tương đối VÀ ROC-AUC không giảm so với A0) ==="
    )
    mv = {k: metrics(val.label.to_numpy(), val[f"p_{k}"].to_numpy()) for k in LEVERS}
    print(pd.DataFrame(mv).T.round(3))
    a0 = mv["A0"]
    accepted = []
    for k in ("A1", "A2", "A3"):
        gain = mv[k]["PR_AUC"] / a0["PR_AUC"] - 1
        ok = gain >= 0.05 and mv[k]["ROC_AUC"] >= a0["ROC_AUC"]
        print(
            f"{k}: PR-AUC {100 * gain:+.1f}%, ROC {mv[k]['ROC_AUC'] - a0['ROC_AUC']:+.3f} -> "
            f"{'NHẬN' if ok else 'không nhận'}"
        )
        if ok:
            accepted.append(k)

    print(f"\n=== OUTER (xác nhận; base rate {out.label.mean():.3f}) ===")
    rows = []
    for h in (*(1, 2, 3, 6), "all"):
        gsub = out if h == "all" else out[out.horizon == h]
        for k in LEVERS:
            rows.append(
                {
                    "horizon": h,
                    "lever": k,
                    **metrics(gsub.label.to_numpy(), gsub[f"p_{k}"].to_numpy()),
                }
            )
    res = pd.DataFrame(rows)
    print(res.round(3).to_string(index=False))
    res.round(4).to_csv(_HERE / "summary.csv", index=False)

    print("\n=== OUTER theo vùng (ROC-AUC / PR-AUC) ===")
    for r, gsub in out.groupby("region"):
        y = gsub.label.to_numpy()
        line = " | ".join(
            f"{k} {roc_auc_score(y, gsub[f'p_{k}']):.3f}/{pr_auc(y, gsub[f'p_{k}']):.3f}"
            for k in LEVERS
        )
        print(f"{r:6s} base {y.mean():.3f} | {line}")
    print("\nĐòn bẩy được nhận theo quy tắc:", accepted or "không có")


if __name__ == "__main__":
    main()
