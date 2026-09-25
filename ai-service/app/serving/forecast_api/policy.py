"""Luật trình bày của dự báo — biến model card (docs/07 §12) thành ràng buộc trong code (docs/09 §10).

Hàm THUẦN (không đọc dữ liệu, không fit mô hình) để kiểm thử được từng luật. Dùng chung cho bộ xuất dữ liệu demo
(`replay`) và service `forecast` thật: hai nơi không được có hai bản luật khác nhau.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from itertools import pairwise
from typing import Final, TypedDict

MODEL_VERSION: Final = "m4-r2@1.0.0"
DATA_VERSION: Final = "v0.2.0"

# Origin cuối cùng nằm trong giai đoạn đã kiểm chứng (dữ liệu THẬT tới 2010-12, target h=6 ≤ 2010-12).
LAST_VALIDATED_ORIGIN: Final = "2010-06"

# Ngưỡng lớp màu của xác suất vượt ngưỡng: cố định để màu so sánh được giữa các lượt (docs/10 §11.1).
EXCEED_PROB_EDGES: Final[tuple[float, ...]] = (0.0, 0.2, 0.4, 0.6, 0.8, 1.0)

# Cờ `outbreak_underprediction_risk`: mô hình thiên thấp khi bùng dịch (model card L1, §12.5). Bật khi CHÍNH mô hình cho
# rằng vượt ngưỡng nhiều khả năng hơn không (xác suất từ mức này trở lên) — vùng có nguy cơ bùng dịch, nơi độ thiên thấp
# đo được. Không dùng "điểm dự báo > ngưỡng": ở tỉnh có P75 lịch sử bằng 0 mọi dự báo dương đều vượt ngưỡng, cờ mất nghĩa
# (đo trên origin 2010-03: 78% dự báo bị gắn cờ so với 24% khi dùng xác suất).
UNDERPREDICTION_EXCEED_PROB: Final = 0.5

# vùng → (region_level, note_code) — bảng tĩnh gắn với model version (docs/07 §12.4).
_REGION_RELIABILITY: Final[dict[str, tuple[str, str]]] = {
    "Bắc": ("low_in_outbreak_years", "bac_outbreak_years"),
    "Trung": ("high", "trung_stable"),
    "Nam": ("equal_to_seasonal_baseline", "nam_equals_baseline"),
}


class Reliability(TypedDict):
    region_level: str
    note_code: str


class LegendClass(TypedDict):
    min: float
    max: float
    label: str


class InputSources(TypedDict):
    real: float
    estimated: float
    imputed: float


def reliability_for(region: str) -> Reliability:
    """Độ tin cậy theo vùng. Vùng lạ là LỖI (không đoán): thà dừng còn hơn gắn nhãn tin cậy sai."""
    try:
        level, code = _REGION_RELIABILITY[region]
    except KeyError:
        raise ValueError(f"Vùng không có trong bảng độ tin cậy: {region!r}") from None
    return {"region_level": level, "note_code": code}


_RECENT = ("incidence_per_100k_lag", "momentum", "acceleration")
_SEASONAL = ("sin_month", "cos_month", "same_month_last_year", "deviation_from_median")
_CLIMATE = ("temp_mean", "precip_total", "humidity_mean", "oni_")


def feature_family(feature: str) -> str:
    """Họ đặc trưng theo hợp đồng (`recent_cases | seasonal_norm | climate | other`)."""
    if feature.startswith(_SEASONAL[:2]) or any(k in feature for k in _SEASONAL[2:]):
        return "seasonal_norm"
    if any(feature.startswith(k) for k in _RECENT):
        return "recent_cases"
    if any(feature.startswith(k) for k in _CLIMATE):
        return "climate"
    return "other"


def is_after_validated_period(origin_month: str) -> bool:
    """`YYYY-MM` so sánh theo chuỗi là đúng thứ tự thời gian."""
    return origin_month > LAST_VALIDATED_ORIGIN


def forecast_flags(
    *,
    exceed_prob: float,
    estimated_share: float,
    origin_month: str,
    stale: bool = False,
) -> list[str]:
    """Cờ cảnh báo của một dự báo (danh mục cố định của hợp đồng). Thứ tự ổn định."""
    flags: list[str] = []
    if exceed_prob >= UNDERPREDICTION_EXCEED_PROB:
        flags.append("outbreak_underprediction_risk")
    if estimated_share > 0:
        flags.append("estimated_inputs")
    if stale:
        flags.append("stale_data")
    if is_after_validated_period(origin_month):
        flags.append("out_of_validated_period")
    return flags


def input_sources(sources: Sequence[str]) -> InputSources:
    """Tỉ trọng nguồn dữ liệu của cửa sổ đầu vào (mỗi phần tử = nguồn của một tháng). Cộng lại = 1."""
    if not sources:
        raise ValueError("Cửa sổ đầu vào rỗng — không thể xác định nguồn dữ liệu")
    n = len(sources)
    known = {"real", "estimated", "imputed"}
    unknown = set(sources) - known
    if unknown:
        raise ValueError(f"Nguồn dữ liệu đầu vào không hỗ trợ: {sorted(unknown)}")
    return {k: sum(1 for s in sources if s == k) / n for k in ("real", "estimated", "imputed")}  # type: ignore[return-value]


def _fmt(x: float) -> str:
    """Số thập phân kiểu Việt Nam (dấu phẩy), 1 chữ số."""
    return f"{x:.1f}".replace(".", ",")


def exceed_prob_legend() -> list[LegendClass]:
    labels = ("Dưới 20%", "20–40%", "40–60%", "60–80%", "Từ 80%")
    return [
        {"min": lo, "max": hi, "label": label}
        for (lo, hi), label in zip(pairwise(EXCEED_PROB_EDGES), labels, strict=True)
    ]


def incidence_legend(lower_edges: Sequence[float], upper: float) -> list[LegendClass]:
    """Lớp màu theo tỉ suất ca/100.000 từ các phân vị LỊCH SỬ toàn quốc (do server tính — frontend không tự tính).

    `lower_edges` = 4 cận giữa (vd P20, P40, P60, P80) tăng dần; `upper` = cận trên của lớp cuối.
    """
    if len(lower_edges) != 4:
        raise ValueError("Cần đúng 4 cận giữa để chia 5 lớp")
    edges = [0.0, *lower_edges, upper]
    if any(not math.isfinite(e) for e in edges) or any(
        b <= a for a, b in pairwise(edges)
    ):
        raise ValueError(f"Các cận phải hữu hạn và tăng ngặt: {edges}")
    labels = [
        f"Dưới {_fmt(edges[1])}",
        f"{_fmt(edges[1])}–{_fmt(edges[2])}",
        f"{_fmt(edges[2])}–{_fmt(edges[3])}",
        f"{_fmt(edges[3])}–{_fmt(edges[4])}",
        f"Từ {_fmt(edges[4])}",
    ]
    return [
        {"min": edges[i], "max": edges[i + 1], "label": labels[i]} for i in range(5)
    ]
