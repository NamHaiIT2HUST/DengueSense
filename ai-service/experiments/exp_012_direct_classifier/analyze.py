"""Phân tích exp_012: classifier trực tiếp vs suy từ hồi quy (exp_011) trên CÙNG
tập dòng. Quy tắc chọn khai báo trước: cách nào có PR-AUC (điểm thô) CAO HƠN trên
VALIDATION thì được chọn; outer chỉ để xác nhận. Cả hai được hiệu chỉnh isotonic
TRỰC TUYẾN (chỉ dùng kết quả đã trưởng thành ≤ train_end) để so xác suất công bằng.

Chạy: python experiments/exp_012_direct_classifier/analyze.py  (từ ai-service/)
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
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import precision_recall_curve, roc_auc_score

from app.forecast.alerting import expected_calibration_error
from app.forecast.metrics import brier_score, pr_auc, recall_at_precision

_HERE = Path(__file__).resolve().parent
pd.set_option("display.width", 200)
KEY = ["window", "origin", "horizon", "province_id"]


def prec_at_recall(y, s, r):
    p, rc, _ = precision_recall_curve(y, s)
    ok = p[rc >= r]
    return float(ok.max()) if ok.size else float("nan")


def online_isotonic(df: pd.DataFrame, score_col: str) -> np.ndarray:
    """Isotonic theo từng (origin, horizon), fit chỉ trên dòng đã trưởng thành."""
    tmonth = pd.to_datetime(df["target_month"])
    out = np.full(len(df), np.nan)
    for (win, _o, h), idx in df.groupby(["window", "origin", "horizon"]).groups.items():
        if win != "outer":  # validation dung diem tho; chua co ket qua truong thanh
            continue
        te = pd.Timestamp(df.loc[idx[0], "train_end"])
        fit = df[(df.horizon == h) & (tmonth <= te)]
        ir = IsotonicRegression(y_min=0.0, y_max=1.0, out_of_bounds="clip")
        ir.fit(fit[score_col], fit["label"])
        out[df.index.get_indexer(idx)] = ir.predict(df.loc[idx, score_col])
    return out


def metrics(y, s, p=None) -> dict:
    d = {
        "PR_AUC": pr_auc(y, s),
        "ROC_AUC": roc_auc_score(y, s),
        "Recall@P0.8": recall_at_precision(y, s, 0.8),
        "Prec@R0.8": prec_at_recall(y, s, 0.8),
    }
    if p is not None:
        d["Brier"] = brier_score(y, p)
        d["ECE"] = expected_calibration_error(y, p)
    return d


def main() -> None:
    clf = pd.DataFrame(json.loads((_HERE / "predictions.json").read_text("utf-8")))
    der = pd.DataFrame(
        json.loads(
            (_HERE.parent / "exp_011_alerting" / "predictions.json").read_text("utf-8")
        )
    )
    df = clf.merge(der[KEY + ["pred", "thr"]], on=KEY, how="inner")
    agree = ((df["y_true"] > df["thr"]).astype(int) == df["label"]).mean()
    print(
        f"dòng khớp: {len(df)} / clf {len(clf)} / derived {len(der)}; nhãn khớp {agree:.4f}"
    )
    df["score_derived"] = np.log((df["pred"] + 1.0) / (df["thr"] + 1.0))
    df = df.reset_index(drop=True)
    df["p_clf_iso"] = online_isotonic(df, "p_clf")
    df["p_der_iso"] = online_isotonic(df, "score_derived")

    val = df[df.window == "validation"]
    out = df[df.window == "outer"]
    print("\n=== VALIDATION (điểm thô; quy tắc chọn = PR-AUC cao hơn) ===")
    mv = {
        "classifier": metrics(val.label, val.p_clf),
        "derived(reg)": metrics(val.label, val.score_derived),
    }
    print(pd.DataFrame(mv).T.round(3))
    pick = (
        "classifier"
        if mv["classifier"]["PR_AUC"] > mv["derived(reg)"]["PR_AUC"]
        else "derived(reg)"
    )
    print("=> chọn theo validation:", pick)

    print("\n=== OUTER (xác nhận) ===")
    rows = []
    for h in (*(1, 2, 3, 6), "all"):
        g = out if h == "all" else out[out.horizon == h]
        y = g.label.to_numpy()
        for name, s, p in (
            ("classifier", g.p_clf, g.p_clf_iso),
            ("derived(reg)", g.score_derived, g.p_der_iso),
        ):
            rows.append(
                {
                    "horizon": h,
                    "base": y.mean(),
                    "method": name,
                    **metrics(y, s.to_numpy(), p.to_numpy()),
                }
            )
    res = pd.DataFrame(rows)
    print(res.round(3).to_string(index=False))
    res.round(4).to_csv(_HERE / "summary.csv", index=False)

    print("\n=== OUTER theo vùng (PR-AUC / ROC-AUC) ===")
    for r, g in out.groupby("region"):
        y = g.label.to_numpy()
        print(
            f"{r:6s} base {y.mean():.3f} | classifier PR {pr_auc(y, g.p_clf):.3f} ROC {roc_auc_score(y, g.p_clf):.3f}"
            f" | derived PR {pr_auc(y, g.score_derived):.3f} ROC {roc_auc_score(y, g.score_derived):.3f}"
        )

    print("\n=== Ensemble điểm: trung bình hạng (classifier + derived) ===")
    both = out.assign(
        s=out.groupby("horizon")["p_clf"].rank(pct=True)
        + out.groupby("horizon")["score_derived"].rank(pct=True)
    )
    y = both.label.to_numpy()
    print({k: round(v, 3) for k, v in metrics(y, both.s.to_numpy()).items()})


if __name__ == "__main__":
    main()
