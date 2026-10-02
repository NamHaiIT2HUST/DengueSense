"""Tái hiện (replay) các lượt dự báo `backtest` mùa 2010 từ kết quả ĐÃ LƯU của exp_016.

Vì sao có module này: dashboard cần dữ liệu THẬT để demo trải nghiệm trước khi service `forecast` chạy được. Ở đây
KHÔNG fit lại M4-R2 — số dự báo (`m4`) và xác suất cảnh báo (`p_clf`) lấy nguyên từ `experiments/exp_016_multiseason/
results.json` (seed cố định, đã công bố trong model card). Phần còn lại là dữ liệu dẫn xuất TỪ PANEL, có nhân quả:
ngưỡng P75, tỉ lệ nền của cửa sổ huấn luyện, nguồn dữ liệu đầu vào, dân số; và giải thích SHAP của thành phần LightGBM
(fit lại đúng như exp_014). Mọi luật trình bày (cờ, độ tin cậy, lớp màu) đến từ `policy` — cùng bản service thật dùng.

Service `forecast` thật (chạy M4-R2 trong job) phải cho CÙNG số này ở cùng origin: test đối chiếu tự động nằm ở
`tests/test_serving/test_replay.py`.

Chạy:  python -m app.serving.forecast_api.replay --out ../dashboard/public/demo   (từ ai-service/)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import uuid
import warnings
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.forecast.alert_classifier import build_pairs as clf_pairs
from app.forecast.alert_classifier import with_thresholds
from app.forecast.backtest import (
    FEATURE_COLS_T1,
    build_horizon_pairs,
    load_real_panel_with_features,
)
from app.forecast.explain import fit_lightgbm_model, tree_shap
from app.forecast.multiseason import season_splits
from app.serving.forecast_api import policy

_ROOT = Path(__file__).resolve().parents[3]  # ai-service/
RESULTS_PATH = _ROOT / "experiments" / "exp_016_multiseason" / "results.json"
PANEL_PATH = _ROOT / "data" / "processed" / "v0.2.0" / "panel_monthly.parquet"
METADATA_PATH = _ROOT / "data" / "external" / "province_metadata.csv"

SEASON = 2010
HORIZONS = (1, 2, 3, 6)
TOP_K = 5
EXPLAINED_COMPONENT = "m2b_lightgbm_poisson"
OBSERVATIONS_FROM = "2006-01"
_NAMESPACE = uuid.UUID("6f1c2b0e-8a41-4a3e-9b5d-2f6c7d1e9a10")


def month_str(ts: pd.Timestamp) -> str:
    return f"{ts.year:04d}-{ts.month:02d}"


def run_id_for(origin_month: str) -> str:
    """Định danh xác định (cùng origin → cùng id): file sinh ra ổn định, không đổi mỗi lần chạy."""
    return str(
        uuid.uuid5(
            _NAMESPACE,
            f"backtest:{origin_month}:{policy.MODEL_VERSION}:{policy.DATA_VERSION}",
        )
    )


def _finite(x: float | None) -> float | None:
    return None if x is None or not math.isfinite(x) else float(x)


class Context:
    """Dữ liệu nạp một lần: panel đặc trưng (real-only), panel đầy đủ, kết quả exp_016."""

    def __init__(self) -> None:
        self.panel = pd.read_parquet(PANEL_PATH)
        self.feat = with_thresholds(load_real_panel_with_features(calendarize=True))
        meta = pd.read_csv(METADATA_PATH)
        self.regions: dict[str, str] = dict(
            zip(meta["new_province_code"], meta["region"], strict=True)
        )
        self.names: dict[str, str] = dict(
            zip(meta["new_province_code"], meta["new_province_name"], strict=True)
        )
        raw = json.loads(RESULTS_PATH.read_text("utf-8"))
        self.m4: dict[tuple[int, int, str], float] = {}
        self.y_true: dict[tuple[int, int, str], float] = {}
        for r in raw["forecast"]:
            if r["season"] == SEASON:
                key = (r["origin"], r["horizon"], r["province_id"])
                self.m4[key] = float(r["m4"])
                self.y_true[key] = float(r["y_true"])
        self.p_clf: dict[tuple[int, int, str], float] = {
            (r["origin"], r["horizon"], r["province_id"]): float(r["p_clf"])
            for r in raw["alert"]
            if r["season"] == SEASON
        }
        self.generated_at = dt.datetime.fromtimestamp(
            RESULTS_PATH.stat().st_mtime, dt.UTC
        )
        panel_s = self.feat[
            self.feat["month"] <= pd.Timestamp(year=SEASON, month=12, day=1)
        ]
        self.panel_s = panel_s
        self.splits = season_splits(self.feat, [SEASON])[SEASON]
        self._reg_pairs = {h: build_horizon_pairs(panel_s, h) for h in HORIZONS}
        self._clf_pairs = {h: clf_pairs(panel_s, h) for h in HORIZONS}
        self._pop = self.panel.set_index(["province_id", "month"])["population"]
        self._src = self.panel.set_index(["province_id", "month"])["data_source"]

    def population(self, province: str, month: pd.Timestamp) -> float:
        v = self._pop.get((province, month))
        if v is None or pd.isna(v):
            raise ValueError(f"Thiếu dân số {province} {month:%Y-%m}")
        return float(v)

    def input_window_sources(self, province: str, origin: pd.Timestamp) -> list[str]:
        months = pd.date_range(end=origin, periods=12, freq="MS")
        return [str(self._src.get((province, m), "missing")) for m in months]


def _base_rate(ctx: Context, split: Any, h: int) -> float:
    cp = ctx._clf_pairs[h]
    train = cp[
        (cp["month"] <= split.train_end) & (cp["_target_month"] <= split.train_end)
    ].dropna(subset=["label"])
    if train.empty:
        raise ValueError(
            f"Không có mẫu huấn luyện để tính tỉ lệ nền (h={h}, origin={split.train_end:%Y-%m})"
        )
    return float(train["label"].mean())


def _legend_incidence(
    ctx: Context, train_end: pd.Timestamp
) -> list[policy.LegendClass]:
    v = (
        ctx.feat.loc[ctx.feat["month"] <= train_end, "incidence_per_100k"]
        .dropna()
        .to_numpy(dtype=float)
    )
    v = v[
        v > 0
    ]  # nhiều tháng bằng 0 (nhất là miền Bắc đầu kỳ) sẽ làm các cận trùng nhau
    edges = [round(float(q), 1) for q in np.quantile(v, [0.2, 0.4, 0.6, 0.8])]
    return policy.incidence_legend(edges, float(math.ceil(v.max())))


def _explanations(ctx: Context, split: Any, h: int) -> dict[str, dict[str, Any]]:
    hp = ctx._reg_pairs[h]
    train = hp[
        (hp["month"] <= split.train_end) & (hp["_target_month"] <= split.train_end)
    ].dropna(subset=["y_target"])
    test = hp[hp["month"] == split.train_end].dropna(subset=["y_target"])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = fit_lightgbm_model(train, FEATURE_COLS_T1, "y_target")
    contrib, base = tree_shap(model, test[FEATURE_COLS_T1])
    out: dict[str, dict[str, Any]] = {}
    for i, (_, row) in enumerate(test.iterrows()):
        order = np.argsort(-np.abs(contrib[i]))[:TOP_K]
        out[str(row["province_id"])] = {
            "base_value": float(base[i]),
            "factors": [
                {
                    "feature": FEATURE_COLS_T1[j],
                    "family": policy.feature_family(FEATURE_COLS_T1[j]),
                    "value": _finite(float(row[FEATURE_COLS_T1[j]])),
                    "contribution": float(contrib[i][j]),
                }
                for j in order
            ],
        }
    return out


def build_run(ctx: Context, split: Any) -> dict[str, Any]:
    origin = split.train_end
    origin_month = month_str(origin)
    items: list[dict[str, Any]] = []
    explanations: dict[str, dict[str, Any]] = {}
    actuals: list[dict[str, Any]] = []
    for h in HORIZONS:
        base_rate = _base_rate(ctx, split, h)
        target = split.target_month(h)
        for pid, expl in _explanations(ctx, split, h).items():
            explanations[f"{pid}|{h}"] = expl
        for pid in sorted(ctx.regions):
            key = (split.origin, h, pid)
            if key not in ctx.m4 or key not in ctx.p_clf:
                continue  # tỉnh không có nhãn/ngưỡng ở tầm này → không có dự báo (bản đồ hiện xám)
            pop = ctx.population(pid, origin)
            thr_row = ctx.feat[
                (ctx.feat["province_id"] == pid) & (ctx.feat["month"] == target)
            ]
            thr_inc = float(thr_row["thr_month"].iloc[0])
            inc = ctx.m4[key]
            sources = policy.input_sources(ctx.input_window_sources(pid, origin))
            prob = ctx.p_clf[key]
            items.append(
                {
                    "province_id": pid,
                    "region": ctx.regions[pid],
                    "target_month": month_str(target),
                    "horizon": h,
                    "cases_pred": inc * pop / 100_000,
                    "incidence_pred_per_100k": inc,
                    "cases_pred_interval": None,  # CHƯA có khoảng đã kiểm chứng độ phủ (docs/09 §10.2)
                    "exceed_prob": prob,
                    "threshold_p75": thr_inc * pop / 100_000,
                    "base_rate": base_rate,
                    "input_data_sources": sources,
                    "reliability": policy.reliability_for(ctx.regions[pid]),
                    "flags": policy.forecast_flags(
                        exceed_prob=prob,
                        estimated_share=sources["estimated"] + sources["imputed"],
                        origin_month=origin_month,
                    ),
                }
            )
            actuals.append(
                {
                    "province_id": pid,
                    "horizon": h,
                    "cases": ctx.y_true[key] * pop / 100_000,
                    "incidence_per_100k": ctx.y_true[key],
                    "exceeded": bool(ctx.y_true[key] > thr_inc),
                }
            )
    return {
        "run": {
            "run_id": run_id_for(origin_month),
            "run_mode": "backtest",
            "status": "completed",
            "origin_month": origin_month,
            "model_version": policy.MODEL_VERSION,
            "data_version": policy.DATA_VERSION,
            "created_at": ctx.generated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "completed_at": ctx.generated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "error_code": None,
        },
        "as_of": f"{month_str(origin)}-01T00:00:00Z",
        "legend_exceed_prob": policy.exceed_prob_legend(),
        "legend_cases_per_100k": _legend_incidence(ctx, origin),
        "items": items,
        "explanations": explanations,
        # Chỉ có ở tái hiện lịch sử: thực tế đã xảy ra ở tháng đích (KHÔNG có trong lượt live — chưa xảy ra).
        "actuals": actuals,
    }


def build_observations(ctx: Context) -> dict[str, dict[str, Any]]:
    """Chuỗi quan sát theo tỉnh, dạng cột (gọn): tháng bắt đầu + mảng song song."""
    p = ctx.panel
    p = p[
        (p["month"] >= pd.Timestamp(OBSERVATIONS_FROM + "-01"))
        & (p["month"] <= f"{SEASON}-12-01")
    ]
    out: dict[str, dict[str, Any]] = {}
    for pid, g in p.sort_values("month").groupby("province_id"):
        months = pd.date_range(g["month"].min(), g["month"].max(), freq="MS")
        g = g.set_index("month").reindex(months)
        out[str(pid)] = {
            "start": month_str(months[0]),
            "cases": [None if pd.isna(x) else float(x) for x in g["cases"]],
            "incidence_per_100k": [
                None if pd.isna(x) else round(float(x), 3)
                for x in g["incidence_per_100k"]
            ],
            "data_source": [None if pd.isna(x) else str(x) for x in g["data_source"]],
        }
    return out


def build_index(ctx: Context, runs: list[dict[str, Any]]) -> dict[str, Any]:
    last = pd.Timestamp(year=SEASON, month=12, day=1)
    provinces = []
    for pid in sorted(ctx.regions):
        pop = ctx._pop.get((pid, last))
        provinces.append(
            {
                "province_id": pid,
                "name": ctx.names[pid],
                "region": ctx.regions[pid],
                "population": None if pop is None or pd.isna(pop) else int(pop),
            }
        )
    panel = ctx.panel
    return {
        "provinces": provinces,
        "runs": [r["run"] for r in runs],
        "data_versions": [
            {
                "version": policy.DATA_VERSION,
                "published_at": ctx.generated_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "first_month": month_str(panel["month"].min()),
                "last_month": month_str(panel["month"].max()),
                "real_share": float((panel["data_source"] == "real").mean()),
            }
        ],
    }


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # separators gọn, ensure_ascii=False (tiếng Việt), LF — file này được commit và phục vụ tĩnh.
    path.write_bytes(
        json.dumps(
            payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False
        ).encode("utf-8")
    )


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--out",
        type=Path,
        required=True,
        help="thư mục xuất (vd ../dashboard/public/demo)",
    )
    args = ap.parse_args(argv)

    ctx = Context()
    runs = []
    for split in ctx.splits:
        run = build_run(ctx, split)
        runs.append(run)
        _write(args.out / f"run-{run['run']['origin_month']}.json", run)
        print(
            f"origin {run['run']['origin_month']}: {len(run['items'])} dự báo, {len(run['explanations'])} giải thích"
        )
    _write(args.out / "index.json", build_index(ctx, runs))
    _write(args.out / "observations.json", build_observations(ctx))


if __name__ == "__main__":
    main()
