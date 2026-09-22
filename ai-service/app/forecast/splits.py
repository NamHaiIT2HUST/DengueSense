"""Chia tập rolling-origin (expanding window) cho panel nhiều tỉnh — xem
PHASE-1-CHECKLIST §B2, docs/01 §6-7.

Thiết kế embargo (quyết định kỹ thuật, ghi rõ vì tài liệu kế hoạch gốc chỉ
mô tả bằng lời): `embargo_months` KHÔNG dịch chuyển horizon (horizon vẫn
luôn tính từ `train_end`, đúng nghĩa "dự báo h kỳ tới") — nó lọc RA những
horizon quá ngắn để đánh giá an toàn ở origin đó. Với mặc định
`embargo_months=6` = horizon dài nhất, chỉ horizon 6 "sạch" (qua khỏi vùng
đệm) ở mỗi origin; muốn đánh giá horizon ngắn hơn, hạ `embargo_months`
xuống — đánh đổi an toàn lấy độ phủ horizon, người gọi tự quyết định.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd


@dataclass(frozen=True)
class Split:
    origin: int
    train_end: pd.Timestamp
    feature_cutoff: pd.Timestamp
    test_start: pd.Timestamp
    horizons: tuple[int, ...] = field(default=())
    usable_horizons: tuple[int, ...] = field(default=())

    def target_month(self, horizon: int) -> pd.Timestamp:
        """Tháng cụ thể cần dự báo cho horizon `h`, TÍNH TỪ train_end."""
        return self.train_end + pd.DateOffset(months=horizon)


def make_splits(
    panel: pd.DataFrame,
    n_origins: int = 5,
    horizons: tuple[int, ...] = (1, 2, 3, 6),
    embargo_months: int = 6,
    reporting_delay_months: int = 1,
) -> list[Split]:
    """Rolling-origin, cửa sổ mở rộng (expanding). Chỉ dựa vào tập các
    tháng có trong `panel["month"]` — KHÔNG đọc bất kỳ giá trị nào khác
    (cases, ...) để quyết định biên train/test, nên thay đổi giá trị dữ
    liệu không làm đổi cấu trúc split (test_no_future_leakage_in_structure).
    """
    months = sorted(panel["month"].unique())
    max_h = max(horizons)

    last_train_end_idx = len(months) - 1 - max_h
    if last_train_end_idx < 0:
        raise ValueError(
            f"Không đủ dữ liệu: cần ít nhất {max_h + 1} tháng để horizon dài "
            f"nhất ({max_h}) có target nằm trong panel, hiện chỉ có {len(months)}."
        )
    if last_train_end_idx - n_origins + 1 < 0:
        raise ValueError(
            f"Không đủ dữ liệu để tạo {n_origins} origin với horizon dài "
            f"nhất {max_h} (chỉ dựng được tối đa {last_train_end_idx + 1})."
        )

    first_origin_idx = last_train_end_idx - n_origins + 1
    splits = []
    for i, idx in enumerate(range(first_origin_idx, last_train_end_idx + 1)):
        train_end = pd.Timestamp(months[idx])
        feature_cutoff = train_end - pd.DateOffset(months=reporting_delay_months)
        test_start = train_end + pd.DateOffset(months=embargo_months)
        usable = tuple(
            h for h in horizons if train_end + pd.DateOffset(months=h) >= test_start
        )
        splits.append(
            Split(
                origin=i,
                train_end=train_end,
                feature_cutoff=feature_cutoff,
                test_start=test_start,
                horizons=tuple(horizons),
                usable_horizons=usable,
            )
        )
    return splits


def assert_test_is_real_only(panel: pd.DataFrame, month: pd.Timestamp) -> None:
    """RAISE nếu tháng `month` (tập test cho 1 horizon) có bất kỳ dòng nào
    `data_source != "real"`. Ràng buộc CỨNG cài vào code — gọi hàm này
    trước khi tính bất kỳ metric nào trên tập test (docs/01 §8, docs/03 §8).
    """
    rows = panel[panel["month"] == month]
    bad = rows[rows["data_source"] != "real"]
    if len(bad) > 0:
        raise ValueError(
            f"Tập test tháng {pd.Timestamp(month).date()} có {len(bad)} dòng "
            f"data_source != 'real' ({sorted(bad['data_source'].unique().tolist())}) "
            "— VI PHẠM quy tắc tập test chỉ dùng dữ liệu thật (docs/01 §8)."
        )


def splits_to_frame(splits: list[Split]) -> pd.DataFrame:
    """Bảng tóm tắt các fold để soi bằng mắt (docs/01 §7.2 yêu cầu)."""
    return pd.DataFrame(
        [
            {
                "origin": s.origin,
                "train_end": s.train_end.date(),
                "feature_cutoff": s.feature_cutoff.date(),
                "test_start": s.test_start.date(),
                "usable_horizons": s.usable_horizons,
            }
            for s in splits
        ]
    )
