"""Bộ chỉ số đánh giá cho Layer 1 (forecast) — xem PHASE-1-CHECKLIST §B1,
docs/02 §5.1.

Mọi hàm nhận numpy array/pandas Series 1 chiều, không tự làm gì với
DataFrame nhiều tỉnh — gộp/tách theo tỉnh là việc của code gọi hàm này.
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    precision_recall_curve,
)


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true, y_pred = np.asarray(y_true, dtype=float), np.asarray(y_pred, dtype=float)
    return float(np.mean(np.abs(y_true - y_pred)))


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true, y_pred = np.asarray(y_true, dtype=float), np.asarray(y_pred, dtype=float)
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def bias(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Sai số có dấu trung bình: dương = model dự báo CAO hơn thực tế
    (overprediction), âm = thấp hơn (underprediction)."""
    y_true, y_pred = np.asarray(y_true, dtype=float), np.asarray(y_pred, dtype=float)
    return float(np.mean(y_pred - y_true))


def mase(
    y_true: np.ndarray, y_pred: np.ndarray, y_train_naive_errors: np.ndarray
) -> float:
    """Mean Absolute Scaled Error — metric CHÍNH (docs/02 §5.1). MASE < 1
    nghĩa là model giỏi hơn seasonal-naive trên chính tập đang đánh giá.

    ⚠️ `y_train_naive_errors` PHẢI là sai số tuyệt đối của seasonal-naive
    tính trên TẬP TRAIN (không phải tập đang đánh giá) — tính trên toàn bộ
    dữ liệu hoặc trên tập test là RÒ RỈ tương lai (docs/01 §6 Bẫy 1/2), vì
    mẫu số khi đó chứa thông tin từ đúng khoảng thời gian đang muốn đánh giá
    một cách khách quan.
    """
    y_train_naive_errors = np.asarray(y_train_naive_errors, dtype=float)
    denom = np.mean(np.abs(y_train_naive_errors))
    if denom == 0 or not np.isfinite(denom):
        raise ValueError(
            "Mẫu số MASE = 0 hoặc không hữu hạn — seasonal-naive trên tập "
            "train hoàn hảo hoặc train rỗng, không tính được MASE có nghĩa."
        )
    return mae(y_true, y_pred) / denom


def poisson_deviance(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Poisson deviance — phù hợp với dữ liệu đếm (số ca) hơn MSE vì
    tôn trọng phương sai tăng theo trung bình của phân phối Poisson.

    `y_pred` (giá trị dự báo, đóng vai trò mean của Poisson) phải > 0 —
    Poisson không có mean <= 0. `y_true` == 0 được xử lý đúng quy ước
    (lim y->0 của y*ln(y/mu) = 0), không NaN/-inf.
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    if np.any(y_pred <= 0):
        raise ValueError(
            "y_pred phải > 0 (Poisson deviance không định nghĩa cho mean <= 0)."
        )
    if np.any(y_true < 0):
        raise ValueError("y_true phải >= 0 (số ca không âm).")

    # np.where tính CẢ 2 nhánh trước khi chọn -> nhánh y_true=0 vẫn chạy
    # log(0/y_pred)=−inf gây RuntimeWarning dù kết quả bị loại bỏ ngay sau.
    # errstate chặn warning này, không phải bug.
    with np.errstate(divide="ignore", invalid="ignore"):
        y_log_term = np.where(y_true == 0, 0.0, y_true * np.log(y_true / y_pred))
    deviance = 2.0 * (y_log_term - (y_true - y_pred))
    return float(np.mean(deviance))


def pr_auc(y_true_binary: np.ndarray, y_score: np.ndarray) -> float:
    """Area under Precision-Recall curve (average precision) — cho bài toán
    cảnh báo nhị phân (vượt ngưỡng dịch hay không), phù hợp hơn ROC-AUC khi
    lớp dương (đợt dịch) hiếm."""
    return float(average_precision_score(y_true_binary, y_score))


def recall_at_precision(
    y_true_binary: np.ndarray, y_score: np.ndarray, target_precision: float
) -> float:
    """Recall lớn nhất đạt được tại ngưỡng mà precision >= target_precision.

    `sklearn.precision_recall_curve` LUÔN có điểm biên (recall=0,
    precision=1.0, tương ứng "không dự báo dương tính nào") — nên với mọi
    `target_precision <= 1.0` luôn có ít nhất 1 điểm thoả, hàm này không
    bao giờ trả "không đạt được". Recall trả về = 0.0 là kết quả HỢP LỆ và
    có ý nghĩa: chỉ điểm biên (không dự báo gì) mới đạt được mức precision
    yêu cầu, tức ngưỡng đó không dùng được cho cảnh báo thật.
    """
    if not 0.0 < target_precision <= 1.0:
        raise ValueError("target_precision phải trong (0.0, 1.0].")
    precision, recall, _ = precision_recall_curve(y_true_binary, y_score)
    reachable = recall[precision >= target_precision]
    return float(reachable.max())


def brier_score(y_true_binary: np.ndarray, y_prob: np.ndarray) -> float:
    """Brier score — độ hiệu chỉnh (calibration) của xác suất dự báo. Càng
    thấp càng tốt, 0 = hoàn hảo."""
    return float(brier_score_loss(y_true_binary, y_prob))


def lead_time(cases: np.ndarray, alert: np.ndarray) -> float:
    """Số kỳ (tuần/tháng, tuỳ tần suất chuỗi `cases`) từ lần alert=True ĐẦU
    TIÊN cho tới kỳ đỉnh dịch (cases đạt max) — con số "bán hàng" chính
    (docs/02). Đây là hàm cho 1 chuỗi/1 đợt dịch; muốn "trung vị" như mô tả
    trong docs thì gọi hàm này cho nhiều đợt dịch (vd nhiều tỉnh x năm) rồi
    lấy `np.nanmedian()` bên ngoài — không gộp logic đó vào đây.

    Trả về NaN nếu không có lần alert nào trước hoặc đúng lúc đỉnh (báo trễ
    hoặc không báo).
    """
    cases = np.asarray(cases, dtype=float)
    alert = np.asarray(alert, dtype=bool)
    if len(cases) != len(alert):
        raise ValueError("cases và alert phải cùng độ dài (cùng 1 chuỗi thời gian).")

    peak_idx = int(np.argmax(cases))
    alerted_before_peak = np.where(alert[: peak_idx + 1])[0]
    if alerted_before_peak.size == 0:
        return float("nan")
    first_alert_idx = int(alerted_before_peak[0])
    return float(peak_idx - first_alert_idx)
