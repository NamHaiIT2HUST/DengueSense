"""exp_014 — SHAP (docs/02 §5): tín hiệu nào dẫn dắt dự báo, và thay đổi thế nào theo
horizon? Giải thích (1) hồi quy M2b LightGBM Poisson + M2a XGBoost, (2) classifier
cảnh báo (LightGBM nhị phân, exp_012) — TreeSHAP chính xác (`app/forecast/explain.py`).

Với mỗi horizon và MỖI origin outer: fit model trên dữ liệu ≤ train_end (đúng như
lúc đánh giá), tính SHAP trên 34 dòng test của origin đó, gộp 8 origin (272 dòng).
Báo cáo: mean|SHAP| theo NHÓM tín hiệu (chia tổng = 100%), top đặc trưng, CHIỀU
tác động (Spearman giữa giá trị đặc trưng và SHAP của nó), và 1 ví dụ giải thích
từng dự báo (tỉnh rủi ro cao nhất ở origin cuối, h=1).

Chạy: python -u experiments/exp_014_shap/run.py  (từ ai-service/)
"""

from __future__ import annotations

import importlib.util
import json
import sys
import warnings
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from app.forecast.backtest import FEATURE_COLS_T1, build_horizon_pairs
from app.forecast.explain import (
    feature_family,
    fit_lightgbm_model,
    fit_xgboost_model,
    tree_shap,
)
from app.forecast.splits import make_splits

_spec = importlib.util.spec_from_file_location(
    "exp012_run", _ROOT / "experiments" / "exp_012_direct_classifier" / "run.py"
)
e12 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(e12)

HORIZONS = (1, 2, 3, 6)
_HERE = Path(__file__).resolve().parent
FAMILY_ORDER = [
    "Ca bệnh gần đây (lag, đà tăng)",
    "Chuẩn mùa vụ của tỉnh",
    "Quy mô / ngưỡng của tỉnh",
    "Khí hậu (nhiệt/mưa/ẩm)",
    "ONI (El Niño)",
    "Mùa vụ",
]


def _train_test(hp, split, label_col):
    train = hp[
        (hp["month"] <= split.train_end) & (hp["_target_month"] <= split.train_end)
    ].dropna(subset=[label_col])
    test = hp[hp["month"] == split.train_end].dropna(subset=[label_col])
    return train, test


def collect(panel, splits, kind: str, model_name: str) -> dict[int, dict]:
    """kind: 'regression' | 'classifier'. Trả về {h: {contrib, X, base, meta}}."""
    out: dict[int, dict] = {}
    for h in HORIZONS:
        hp = (
            e12.build_pairs(panel, h)
            if kind == "classifier"
            else build_horizon_pairs(panel, h)
        )
        cols = e12.CLF_COLS if kind == "classifier" else FEATURE_COLS_T1
        label = "label" if kind == "classifier" else "y_target"
        contribs, xs, bases, meta = [], [], [], []
        for split in splits:
            if h not in split.usable_horizons:
                continue
            train, test = _train_test(hp, split, label)
            if test.empty or train.empty:
                continue
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                if kind == "classifier":
                    model = fit_lightgbm_model(train, cols, label, objective="binary")
                elif model_name == "xgboost":
                    model = fit_xgboost_model(train, cols, label)
                else:
                    model = fit_lightgbm_model(train, cols, label)
            c, b = tree_shap(model, test[cols])
            contribs.append(pd.DataFrame(c, columns=cols))
            xs.append(test[cols].reset_index(drop=True))
            bases.append(b)
            meta.append(
                test[["province_id"]].assign(origin=split.origin).reset_index(drop=True)
            )
        out[h] = {
            "contrib": pd.concat(contribs, ignore_index=True),
            "X": pd.concat(xs, ignore_index=True),
            "base": np.concatenate(bases),
            "meta": pd.concat(meta, ignore_index=True),
        }
    return out


def family_shares(contrib: pd.DataFrame) -> dict[str, float]:
    imp = contrib.abs().mean()
    fam = imp.groupby([feature_family(c) for c in imp.index]).sum()
    return (fam / fam.sum()).to_dict()


def top_features(d: dict, k: int = 8) -> list[dict]:
    imp = d["contrib"].abs().mean().sort_values(ascending=False)
    rows = []
    for name in imp.index[:k]:
        x, s = d["X"][name], d["contrib"][name]
        ok = x.notna()
        rho = spearmanr(x[ok], s[ok]).statistic if ok.sum() > 5 else float("nan")
        rows.append(
            {
                "feature": name,
                "family": feature_family(name),
                "mean_abs_shap": float(imp[name]),
                "direction_spearman": float(rho),
            }
        )
    return rows


def local_example(d: dict, h: int) -> dict:
    """Giải thích 1 dự báo: tỉnh có dự báo cao nhất ở origin cuối cùng."""
    last = d["meta"]["origin"].max()
    idx = np.where(d["meta"]["origin"].to_numpy() == last)[0]
    total = d["contrib"].iloc[idx].sum(axis=1).to_numpy() + d["base"][idx]
    i = idx[int(np.argmax(total))]
    c = d["contrib"].iloc[i].sort_values(key=np.abs, ascending=False)
    return {
        "province_id": d["meta"].iloc[i]["province_id"],
        "origin": int(last),
        "horizon": h,
        "raw_score": float(d["contrib"].iloc[i].sum() + d["base"][i]),
        "base": float(d["base"][i]),
        "top_contributions": [
            {
                "feature": f,
                "value": float(d["X"].iloc[i][f]),
                "shap": float(c[f]),
                "family": feature_family(f),
            }
            for f in c.index[:6]
        ],
    }


def plot_shares(results: dict) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2), dpi=150, sharey=True)
    for ax, key, title in (
        (axes[0], "regression_lgbm", "Hồi quy (M2b LightGBM)"),
        (axes[1], "classifier_lgbm", "Cảnh báo (classifier)"),
    ):
        left = np.zeros(len(HORIZONS))
        for fam in FAMILY_ORDER:
            vals = np.array(
                [results[key]["family_share"][str(h)].get(fam, 0.0) for h in HORIZONS]
            )
            ax.barh([f"h={h}" for h in HORIZONS], vals, left=left, label=fam)
            left += vals
        ax.set_title(title)
        ax.set_xlabel("Tỉ trọng mean|SHAP|")
        ax.invert_yaxis()
    axes[1].legend(loc="center left", bbox_to_anchor=(1.0, 0.5), fontsize=8)
    fig.tight_layout()
    fig.savefig(_HERE / "shap_families.png")


def main() -> None:
    panel = e12.with_thresholds(e12.load_real_panel_with_features())
    splits = make_splits(
        panel,
        n_origins=e12.OUTER_N_ORIGINS,
        horizons=HORIZONS,
        embargo_months=e12.EMBARGO_MONTHS,
        reporting_delay_months=e12.REPORTING_DELAY_MONTHS,
    )
    results: dict = {}
    for key, kind, mname in (
        ("regression_lgbm", "regression", "lightgbm"),
        ("regression_xgb", "regression", "xgboost"),
        ("classifier_lgbm", "classifier", "lightgbm"),
    ):
        data = collect(panel, splits, kind, mname)
        results[key] = {
            "family_share": {
                str(h): family_shares(d["contrib"]) for h, d in data.items()
            },
            "top_features": {str(h): top_features(d) for h, d in data.items()},
            "n_rows": {str(h): len(d["contrib"]) for h, d in data.items()},
        }
        if key != "regression_xgb":
            results[key]["local_example_h1"] = local_example(data[1], 1)
        print(f"[{key}] xong.")
    (_HERE / "results.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    plot_shares(results)
    print("Đã ghi results.json và shap_families.png")


if __name__ == "__main__":
    main()
