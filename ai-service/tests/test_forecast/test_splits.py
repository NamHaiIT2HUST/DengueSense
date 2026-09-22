from __future__ import annotations

import pandas as pd
import pytest

from app.forecast.splits import assert_test_is_real_only, make_splits, splits_to_frame


def _make_panel(
    n_months: int = 30, provinces: tuple[str, ...] = ("a", "b")
) -> pd.DataFrame:
    months = pd.date_range("2020-01-01", periods=n_months, freq="MS")
    rows = []
    for p in provinces:
        for i, m in enumerate(months):
            rows.append(
                {
                    "province_id": p,
                    "month": m,
                    "cases": float(i + 1),
                    "data_source": "real",
                }
            )
    return pd.DataFrame(rows)


def test_expanding_window_train_end_increases_monotonically():
    panel = _make_panel(n_months=30)
    splits = make_splits(panel, n_origins=5, horizons=(1, 2, 3, 6))

    assert len(splits) == 5
    train_ends = [s.train_end for s in splits]
    assert train_ends == sorted(train_ends)
    assert len(set(train_ends)) == 5  # moi origin 1 thang khac nhau


def test_embargo_gap_holds_for_every_split():
    panel = _make_panel(n_months=30)
    embargo = 6
    splits = make_splits(
        panel, n_origins=5, horizons=(1, 2, 3, 6), embargo_months=embargo
    )

    for s in splits:
        gap_months = (s.test_start.year - s.train_end.year) * 12 + (
            s.test_start.month - s.train_end.month
        )
        assert gap_months >= embargo


def test_default_embargo_filters_out_short_horizons():
    # embargo mac dinh = 6 = horizon dai nhat -> chi h=6 "sach" moi origin
    panel = _make_panel(n_months=30)
    splits = make_splits(panel, n_origins=5, horizons=(1, 2, 3, 6), embargo_months=6)

    for s in splits:
        assert s.usable_horizons == (6,)


def test_smaller_embargo_allows_more_horizons():
    panel = _make_panel(n_months=30)
    splits = make_splits(panel, n_origins=5, horizons=(1, 2, 3, 6), embargo_months=1)

    for s in splits:
        assert s.usable_horizons == (1, 2, 3, 6)


def test_target_month_counted_from_train_end():
    panel = _make_panel(n_months=30)
    splits = make_splits(panel, n_origins=3, horizons=(1, 3))
    s = splits[0]

    assert s.target_month(1) == s.train_end + pd.DateOffset(months=1)
    assert s.target_month(3) == s.train_end + pd.DateOffset(months=3)


def test_split_structure_does_not_change_with_future_values():
    """Rò rỉ tương lai: đưa giá trị bất thường vào tháng sau train_end
    KHÔNG được làm đổi biên train/test — make_splits() chỉ được nhìn vào
    tập các tháng có trong panel, không phải giá trị cases."""
    panel_a = _make_panel(n_months=30)
    panel_b = panel_a.copy()
    # gia tri bat thuong o thang cuoi cung (tuong lai xa nhat)
    panel_b.loc[panel_b["month"] == panel_b["month"].max(), "cases"] = 999_999.0

    splits_a = make_splits(panel_a, n_origins=5, horizons=(1, 2, 3, 6))
    splits_b = make_splits(panel_b, n_origins=5, horizons=(1, 2, 3, 6))

    assert [s.train_end for s in splits_a] == [s.train_end for s in splits_b]
    assert [s.test_start for s in splits_a] == [s.test_start for s in splits_b]
    assert [s.usable_horizons for s in splits_a] == [
        s.usable_horizons for s in splits_b
    ]


def test_raises_when_not_enough_months_for_longest_horizon():
    panel = _make_panel(n_months=5)
    with pytest.raises(ValueError, match="Không đủ dữ liệu"):
        make_splits(panel, n_origins=1, horizons=(1, 6))


def test_raises_when_not_enough_months_for_n_origins():
    panel = _make_panel(n_months=8)
    with pytest.raises(ValueError, match="Không đủ dữ liệu"):
        make_splits(panel, n_origins=10, horizons=(1,))


def test_assert_test_is_real_only_passes_when_all_real():
    panel = _make_panel(n_months=10)
    month = panel["month"].iloc[0]
    assert_test_is_real_only(panel, month)  # khong raise


def test_assert_test_is_real_only_raises_when_estimated_present():
    panel = _make_panel(n_months=10)
    target_month = panel["month"].iloc[0]
    panel.loc[panel["month"] == target_month, "data_source"] = "estimated"

    with pytest.raises(ValueError, match="VI PHẠM"):
        assert_test_is_real_only(panel, target_month)


def test_assert_test_is_real_only_raises_on_partial_contamination():
    """Chỉ 1 tỉnh trong tháng đó là estimated cũng phải raise, không được
    'trung bình hoá' qua các tỉnh khác."""
    panel = _make_panel(n_months=10, provinces=("a", "b", "c"))
    target_month = panel["month"].iloc[0]
    mask = (panel["month"] == target_month) & (panel["province_id"] == "b")
    panel.loc[mask, "data_source"] = "estimated"

    with pytest.raises(ValueError, match="1 dòng"):
        assert_test_is_real_only(panel, target_month)


def test_splits_to_frame_returns_one_row_per_split():
    panel = _make_panel(n_months=30)
    splits = make_splits(panel, n_origins=4, horizons=(1, 6))
    df = splits_to_frame(splits)

    assert len(df) == 4
    assert list(df.columns) == [
        "origin",
        "train_end",
        "feature_cutoff",
        "test_start",
        "usable_horizons",
    ]
