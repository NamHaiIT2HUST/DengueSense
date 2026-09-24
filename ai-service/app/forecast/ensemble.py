"""M4 — Ensemble (docs/02 §7). Kết hợp dự báo của các model thành viên đã
fit sẵn (không tự fit gì ở đây — nhận dự báo per-province làm input) — tách
riêng khỏi `models.py` vì đây là bước hậu xử lý, không phải 1 model mới.

E1 (trung bình đơn giản) và E2 (trung bình có trọng số) dùng chung 1 hàm
`combine_ensemble()` — E1 tương đương E2 với trọng số bằng nhau.
"""

from __future__ import annotations

import numpy as np


def combine_ensemble(
    member_preds: dict[str, dict[str, float]],
    provinces: list[str],
    weights: dict[str, float] | None = None,
) -> dict[str, float]:
    """Trung bình dự báo qua các model CÒN CÓ giá trị cho từng tỉnh (tự
    re-normalize nếu 1 model thiếu/NaN, vd M1 lỗi hội tụ) — `weights=None`
    = trung bình đơn giản (E1), có `weights` = trung bình có trọng số (E2).
    """
    result = {}
    for p in provinces:
        vals, ws = [], []
        for name, preds in member_preds.items():
            val = preds.get(p)
            if val is not None and not np.isnan(val):
                vals.append(val)
                ws.append(1.0 if weights is None else weights[name])
        if not vals:
            continue
        result[p] = float(np.average(vals, weights=np.array(ws)))
    return result


def validation_error_weights(avg_error_by_model: dict[str, float]) -> dict[str, float]:
    """Trọng số E2 = nghịch đảo sai số validation, chuẩn hoá về tổng 1
    (docs/02 §7 E2: "tỉ lệ nghịch với sai số validation")."""
    inv = {name: 1.0 / err for name, err in avg_error_by_model.items()}
    total = sum(inv.values())
    return {name: v / total for name, v in inv.items()}


def route_by_group(
    default_preds: dict[str, float],
    alt_preds: dict[str, float],
    group_of: dict[str, str],
    alt_groups: set[str] | list[str],
) -> dict[str, float]:
    """Ensemble theo vùng (docs/02 §7 E4): tỉnh thuộc nhóm trong `alt_groups`
    dùng `alt_preds`, còn lại dùng `default_preds`. Nhóm nào dùng bản thay thế
    phải được quyết định bằng cửa sổ VALIDATION, không phải outer (xem
    exp_007). Tỉnh thiếu dự báo ở nguồn được chọn thì lùi về nguồn còn lại."""
    alt = set(alt_groups)
    result = {}
    for p in default_preds.keys() | alt_preds.keys():
        use_alt = group_of.get(p) in alt
        first, second = (
            (alt_preds, default_preds) if use_alt else (default_preds, alt_preds)
        )
        val = first.get(p)
        if val is None:
            val = second.get(p)
        if val is not None:
            result[p] = val
    return result
