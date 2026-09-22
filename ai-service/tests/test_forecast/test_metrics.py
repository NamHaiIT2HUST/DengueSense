from __future__ import annotations

import numpy as np
import pytest

from app.forecast.metrics import (
    bias,
    brier_score,
    lead_time,
    mae,
    mase,
    poisson_deviance,
    pr_auc,
    recall_at_precision,
    rmse,
)


def test_mae_hand_computed():
    # |3-1| + |5-5| + |10-7| = 2+0+3 = 5, /3 = 1.6667
    assert mae([1, 5, 7], [3, 5, 10]) == pytest.approx(5 / 3)


def test_rmse_hand_computed():
    # (3-1)^2=4, (5-5)^2=0, (10-7)^2=9 -> mean=13/3 -> sqrt
    assert rmse([1, 5, 7], [3, 5, 10]) == pytest.approx(np.sqrt(13 / 3))


def test_bias_positive_means_overprediction():
    # pred luôn cao hơn true 2 đơn vị -> bias = +2
    assert bias([1, 2, 3], [3, 4, 5]) == pytest.approx(2.0)


def test_bias_negative_means_underprediction():
    assert bias([3, 4, 5], [1, 2, 3]) == pytest.approx(-2.0)


def test_mase_hand_computed():
    # MAE(true,pred) = mae([1,5,7],[3,5,10]) = 5/3
    # naive train errors: [2,4] -> mean abs = 3
    # MASE = (5/3) / 3 = 5/9
    result = mase([1, 5, 7], [3, 5, 10], y_train_naive_errors=[2, 4])
    assert result == pytest.approx((5 / 3) / 3)


def test_mase_raises_on_zero_denominator():
    with pytest.raises(ValueError, match="Mẫu số MASE"):
        mase([1, 2, 3], [1, 2, 3], y_train_naive_errors=[0, 0, 0])


def test_mase_below_1_when_better_than_naive():
    # model gần như hoàn hảo, naive train error trung bình lớn hơn nhiều
    result = mase([10, 10, 10], [10, 10, 11], y_train_naive_errors=[5, 5, 5])
    assert result < 1.0


def test_poisson_deviance_zero_when_perfect_prediction():
    result = poisson_deviance([5, 10, 0], [5, 10, 0.0001])
    assert result == pytest.approx(0.0, abs=1e-3)


def test_poisson_deviance_handles_zero_actual_without_nan():
    result = poisson_deviance([0, 0, 0], [1.0, 2.0, 0.5])
    assert np.isfinite(result)
    assert result > 0  # du bao > 0 nhung thuc te = 0 -> co deviance duong


def test_poisson_deviance_raises_on_nonpositive_pred():
    with pytest.raises(ValueError, match="y_pred phải > 0"):
        poisson_deviance([1, 2, 3], [1, 0, 3])


def test_poisson_deviance_raises_on_negative_true():
    with pytest.raises(ValueError, match="y_true phải >= 0"):
        poisson_deviance([-1, 2, 3], [1, 2, 3])


def test_pr_auc_perfect_separation_equals_1():
    y_true = [0, 0, 1, 1]
    y_score = [0.1, 0.2, 0.8, 0.9]
    assert pr_auc(y_true, y_score) == pytest.approx(1.0)


def test_pr_auc_random_scores_below_1():
    y_true = [0, 1, 0, 1]
    y_score = [0.9, 0.1, 0.8, 0.2]  # score va label nguoc nhau hoan toan
    assert pr_auc(y_true, y_score) < 1.0


def test_recall_at_precision_perfect_case():
    y_true = [0, 0, 1, 1]
    y_score = [0.1, 0.2, 0.8, 0.9]
    assert recall_at_precision(y_true, y_score, target_precision=1.0) == pytest.approx(
        1.0
    )


def test_recall_at_precision_zero_when_only_trivial_point_qualifies():
    # diem cao nhat lai la nhan am (0.9 -> true=0) nen precision khong the
    # vuot 0.5 o bat ky nguong "that" nao; precision_recall_curve luon co
    # diem bien (recall=0, precision=1.0) -> chi diem bien nay thoa target
    # cao -> recall = 0.0 (khong phai NaN, xem docstring recall_at_precision).
    y_true = [0, 1, 0, 1]
    y_score = [0.9, 0.5, 0.4, 0.3]
    result = recall_at_precision(y_true, y_score, target_precision=0.999)
    assert result == pytest.approx(0.0)


def test_recall_at_precision_raises_on_invalid_target():
    with pytest.raises(ValueError, match="target_precision"):
        recall_at_precision([0, 1], [0.1, 0.9], target_precision=1.5)


def test_brier_score_zero_for_perfect_probabilities():
    assert brier_score([0, 1, 0, 1], [0.0, 1.0, 0.0, 1.0]) == pytest.approx(0.0)


def test_brier_score_positive_for_imperfect_probabilities():
    assert brier_score([0, 1], [0.5, 0.5]) == pytest.approx(0.25)


def test_lead_time_hand_computed():
    # dinh dich o index 4 (gia tri 100). alert=True lan dau o index 1.
    cases = [10, 20, 30, 50, 100, 40]
    alert = [False, True, True, True, True, False]
    assert lead_time(cases, alert) == pytest.approx(3.0)  # 4 - 1


def test_lead_time_nan_when_no_alert_before_peak():
    cases = [10, 20, 100, 50]
    alert = [False, False, False, True]  # alert chi den SAU dinh
    assert np.isnan(lead_time(cases, alert))


def test_lead_time_zero_when_alert_exactly_at_peak():
    cases = [10, 20, 100]
    alert = [False, False, True]
    assert lead_time(cases, alert) == pytest.approx(0.0)


def test_lead_time_raises_on_mismatched_length():
    with pytest.raises(ValueError, match="cùng độ dài"):
        lead_time([1, 2, 3], [True, False])
