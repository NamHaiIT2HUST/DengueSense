"""Động cơ dự báo M4-R2 của service `forecast`: từ MỘT panel + MỘT tháng neo → dự báo cho mọi tầm.

Đây là đường chạy THẬT (fit lại mô hình trong job), khác `replay` (đọc số đã lưu của exp_016). Hai đường phải cho CÙNG số
ở cùng tháng neo — `tests/test_serving/test_engine.py` là bản đối chiếu tự động (cổng Đợt 1: "số khớp exp_016").

Không có logic ML mới ở đây (ADR-0007): mô hình, đặc trưng, ngưỡng, bộ phân loại đều gọi thư viện `app.forecast`; module này
chỉ ghép chúng theo đúng quy trình của exp_016 (`experiments/exp_016_multiseason/run.py::run_season`) cho MỘT origin, và
gắn luật trình bày từ `policy`.

Ràng buộc chống rò rỉ (giữ nguyên như đánh giá): huấn luyện CHỈ trên cặp (X tại t, y tại t+h) có t và t+h ≤ tháng neo.
"""

from __future__ import annotations

import math
import warnings
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from app.forecast.alert_classifier import (
    build_pairs as clf_pairs,
)
from app.forecast.alert_classifier import (
    fit_predict_classifier,
    with_thresholds,
)
from app.forecast.alerting import exceedance_thresholds
from app.forecast.backtest import (
    FEATURE_COLS_T1,
    build_horizon_pairs,
    load_real_panel_with_features,
)
from app.forecast.explain import fit_lightgbm_model, tree_shap
from app.forecast.m4 import predict_m4
from app.serving.forecast_api import policy

HORIZONS = (1, 2, 3, 6)
TOP_K = 5
EXPLAINED_COMPONENT = "m2b_lightgbm_poisson"
# Tháng neo tối đa cho `backtest`: đủ dữ liệu THẬT cho mọi tầm (target h=6 ≤ 2010-12) — docs/09 §10.
MAX_BACKTEST_ORIGIN = policy.LAST_VALIDATED_ORIGIN


class EngineError(Exception):
    """Lỗi nghiệp vụ của động cơ; `code` khớp contracts/errors.md."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def month_str(ts: pd.Timestamp) -> str:
    return f"{ts.year:04d}-{ts.month:02d}"


def parse_month(month: str) -> pd.Timestamp:
    if not policy.is_year_month(month):
        raise EngineError(
            "common.validation_error", f"tháng phải có dạng YYYY-MM: {month!r}"
        )
    return pd.Timestamp(f"{month}-01")


def finite_or_none(x: float) -> float | None:
    return float(x) if math.isfinite(x) else None


class PanelContext:
    """Dữ liệu dẫn xuất từ MỘT panel (nạp một lần, dùng cho nhiều tháng neo)."""

    def __init__(self, panel: pd.DataFrame, regions: dict[str, str]) -> None:
        self.panel = panel
        self.regions = regions
        # Chỉ dữ liệu THẬT được dùng để huấn luyện/đánh giá (docs/01 §8); đặc trưng dựng theo lịch tháng (exp_015).
        self.feat = with_thresholds(
            load_real_panel_with_features(panel, calendarize=True)
        )
        self.last_real_month: pd.Timestamp = self.feat["month"].max()
        self._pop = panel.set_index(["province_id", "month"])["population"]
        self._src = panel.set_index(["province_id", "month"])["data_source"]
        self._reg_pairs: dict[int, pd.DataFrame] = {}
        self._clf_pairs: dict[int, pd.DataFrame] = {}

    def reg_pairs(self, h: int) -> pd.DataFrame:
        if h not in self._reg_pairs:
            self._reg_pairs[h] = build_horizon_pairs(self.feat, h)
        return self._reg_pairs[h]

    def clf_pairs(self, h: int) -> pd.DataFrame:
        if h not in self._clf_pairs:
            self._clf_pairs[h] = clf_pairs(self.feat, h)
        return self._clf_pairs[h]

    def population(self, province: str, month: pd.Timestamp) -> float:
        v = self._pop.get((province, month))
        if v is None or pd.isna(v):
            raise EngineError(
                "common.internal_error", f"thiếu dân số {province} {month_str(month)}"
            )
        return float(v)

    def input_window_sources(self, province: str, origin: pd.Timestamp) -> list[str]:
        months = pd.date_range(end=origin, periods=12, freq="MS")
        return [str(self._src.get((province, m), "missing")) for m in months]

    def legend_incidence(self, origin: pd.Timestamp) -> list[policy.LegendClass]:
        v = (
            self.feat.loc[self.feat["month"] <= origin, "incidence_per_100k"]
            .dropna()
            .to_numpy(dtype=float)
        )
        v = v[
            v > 0
        ]  # nhiều tháng bằng 0 (nhất là miền Bắc đầu kỳ) sẽ làm các cận trùng nhau
        edges = [round(float(q), 1) for q in np.quantile(v, [0.2, 0.4, 0.6, 0.8])]
        return policy.incidence_legend(edges, float(math.ceil(v.max())))


@dataclass
class HorizonResult:
    horizon: int
    target_month: pd.Timestamp
    m4: dict[str, float]  # tỉ suất ca /100k, M4-R2
    p_clf: dict[
        str, float
    ]  # xác suất vượt ngưỡng P75 (bộ phân loại trực tiếp, exp_012)
    base_rate: float  # tỉ lệ nền của cửa sổ huấn luyện (nhân quả)
    thresholds: dict[str, float]  # P75 lịch sử cùng tháng dương lịch (tỉ suất /100k)
    explanations: dict[str, dict[str, Any]] = field(default_factory=dict)


def validate_backtest_origin(ctx: PanelContext, origin_month: str) -> pd.Timestamp:
    """Tháng neo backtest phải nằm trong giai đoạn có dữ liệu THẬT cho MỌI tầm và ≤ 2010-06."""
    if not policy.is_year_month(origin_month):
        raise EngineError(
            "common.validation_error",
            f"origin_month phải có dạng YYYY-MM: {origin_month!r}",
        )
    if origin_month > MAX_BACKTEST_ORIGIN:
        raise EngineError(
            "forecast.origin_out_of_range",
            f"backtest chỉ nhận tháng neo ≤ {MAX_BACKTEST_ORIGIN}",
        )
    origin = parse_month(origin_month)
    last_target = origin + pd.DateOffset(months=max(HORIZONS))
    if last_target > ctx.last_real_month:
        raise EngineError(
            "forecast.origin_out_of_range",
            "không đủ dữ liệu thật cho mọi tầm dự báo ở tháng neo này",
        )
    if origin not in set(ctx.feat["month"]):
        raise EngineError(
            "forecast.origin_out_of_range", "panel không có dữ liệu ở tháng neo này"
        )
    return origin


def _explain(train: pd.DataFrame, test: pd.DataFrame) -> dict[str, dict[str, Any]]:
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
                    "value": finite_or_none(float(row[FEATURE_COLS_T1[j]])),
                    "contribution": float(contrib[i][j]),
                }
                for j in order
            ],
        }
    return out


def predict_horizon(
    ctx: PanelContext,
    origin: pd.Timestamp,
    h: int,
    *,
    require_target: bool,
    explain: bool = True,
) -> HorizonResult:
    """Dự báo một tầm h ở tháng neo `origin` (fit lại toàn bộ mô hình trên dữ liệu ≤ origin)."""
    target = origin + pd.DateOffset(months=h)
    hist = ctx.feat[ctx.feat["month"] <= origin]

    hp = ctx.reg_pairs(h)
    train = hp[(hp["month"] <= origin) & (hp["_target_month"] <= origin)].dropna(
        subset=["y_target"]
    )
    test = hp[hp["month"] == origin]
    if require_target:  # backtest: chỉ tỉnh có số đo thật ở tháng đích (như exp_016)
        test = test.dropna(subset=["y_target"])
    if test.empty or train.empty:
        raise EngineError(
            "forecast.run_failed", f"không đủ dữ liệu huấn luyện/kiểm ở tầm {h}"
        )

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        m4 = predict_m4(train, test, hist, target, ctx.regions)

    cp = ctx.clf_pairs(h)
    ctrain = cp[(cp["month"] <= origin) & (cp["_target_month"] <= origin)].dropna(
        subset=["label"]
    )
    ctest = cp[cp["month"] == origin]
    if require_target:
        ctest = ctest.dropna(subset=["label"])
    if ctrain.empty or ctrain["label"].nunique() != 2 or ctest.empty:
        raise EngineError(
            "forecast.run_failed",
            f"không huấn luyện được bộ phân loại cảnh báo ở tầm {h}",
        )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        probs = fit_predict_classifier(ctrain, ctest)
    p_clf = {
        str(r.province_id): float(p)
        for r, p in zip(ctest.itertuples(), probs, strict=True)
    }

    return HorizonResult(
        horizon=h,
        target_month=target,
        m4={p: float(v) for p, v in m4.items()},
        p_clf=p_clf,
        base_rate=float(ctrain["label"].mean()),
        thresholds={
            str(p): float(v) for p, v in exceedance_thresholds(hist, target).items()
        },
        explanations=_explain(train, test) if explain else {},
    )


def assemble_items(
    ctx: PanelContext,
    origin: pd.Timestamp,
    res: HorizonResult,
    threshold_of: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    """Ghép `ForecastItem` theo hợp đồng từ kết quả một tầm. `threshold_of` (tỉ suất/100k) ghi đè ngưỡng (replay dùng
    ngưỡng đã lưu); mặc định lấy ngưỡng của chính kết quả."""
    origin_month = month_str(origin)
    thr = threshold_of if threshold_of is not None else res.thresholds
    items: list[dict[str, Any]] = []
    for pid in sorted(ctx.regions):
        if pid not in res.m4 or pid not in res.p_clf or pid not in thr:
            continue  # tỉnh không có nhãn/ngưỡng ở tầm này → không có dự báo (bản đồ hiện xám)
        pop = ctx.population(pid, origin)
        inc = res.m4[pid]
        sources = policy.input_sources(ctx.input_window_sources(pid, origin))
        prob = res.p_clf[pid]
        items.append(
            {
                "province_id": pid,
                "region": ctx.regions[pid],
                "target_month": month_str(res.target_month),
                "horizon": res.horizon,
                "cases_pred": inc * pop / 100_000,
                "incidence_pred_per_100k": inc,
                "cases_pred_interval": None,  # CHƯA có khoảng đã kiểm chứng độ phủ (docs/09 §10.2)
                "exceed_prob": prob,
                "threshold_p75": thr[pid] * pop / 100_000,
                "base_rate": res.base_rate,
                "input_data_sources": sources,
                "reliability": policy.reliability_for(ctx.regions[pid]),
                "flags": policy.forecast_flags(
                    exceed_prob=prob,
                    estimated_share=sources["estimated"] + sources["imputed"],
                    origin_month=origin_month,
                ),
            }
        )
    return items


@dataclass
class RunResult:
    origin_month: str
    items: list[dict[str, Any]]
    explanations: dict[str, dict[str, Any]]  # khoá `${province_id}|${horizon}`
    legend_cases_per_100k: list[policy.LegendClass]


def compute_backtest_run(
    ctx: PanelContext,
    origin_month: str,
    on_progress: Callable[[float], None] | None = None,
) -> RunResult:
    """Chạy MỘT lượt backtest: fit lại M4-R2 + bộ phân loại + SHAP cho 4 tầm ở tháng neo `origin_month`."""
    origin = validate_backtest_origin(ctx, origin_month)
    items: list[dict[str, Any]] = []
    explanations: dict[str, dict[str, Any]] = {}
    for k, h in enumerate(HORIZONS):
        res = predict_horizon(ctx, origin, h, require_target=True)
        items.extend(assemble_items(ctx, origin, res))
        for pid, expl in res.explanations.items():
            explanations[f"{pid}|{h}"] = expl
        if on_progress:
            on_progress(0.95 * (k + 1) / len(HORIZONS))
    return RunResult(
        origin_month=month_str(origin),
        items=items,
        explanations=explanations,
        legend_cases_per_100k=ctx.legend_incidence(origin),
    )
