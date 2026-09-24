# exp_012 — Classifier trực tiếp cho cảnh báo vượt ngưỡng P75 (docs/02 §1 phương án dự phòng)

- **Ngày chạy:** 2026-09-25 · validation 10 origin (≤2008-12), outer 8 origin, real-only
- **File:** `predictions.json`, `summary.csv`, `analysis_output.txt` (`run.py` + `analyze.py`)
- Hỗ trợ: `alerting.py::add_expanding_exceedance_threshold` (ngưỡng nhân quả theo dòng, 2 test)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

exp_011 (suy xác suất từ dự báo hồi quy M4-R2) cho ROC-AUC ~0.73, dưới mốc D-MOSS 0.83-0.94. Theo docs/02 §1, khi cách suy ra
kém thì mới train classifier riêng — classifier trực tiếp có cải thiện không?

## Thiết lập

- GBM nhị phân (XGBoost `binary:logistic` + LightGBM `binary`, T1, trung bình xác suất), mỗi horizon 1 model riêng.
- Nhãn = y(t+h) > P75 của tỉnh cho tháng đó, nhân quả (mở rộng, chỉ các năm trước). Khớp tuyệt đối ngưỡng exp_011
  (100% dòng bằng nhau; nhãn khớp 100% trên 2448 dòng).
- Đặc trưng: 17 T1 + quy mô tỉnh + ngưỡng tháng đích (`thr_target`, biết trước) + 5 đặc trưng ca bệnh TƯƠNG ĐỐI so ngưỡng
  (chia cho thr+1). Cột mới nối cuối. Huấn luyện chỉ trên cặp t, t+h ≤ train_end.
- **Quy tắc chọn khai báo trước:** cách nào có PR-AUC (điểm thô) cao hơn trên VALIDATION được chọn; outer chỉ xác nhận.
  Cả hai được hiệu chỉnh isotonic trực tuyến (chỉ kết quả đã trưởng thành) để so xác suất công bằng.

## Kết quả

**Validation (chọn):** classifier PR-AUC **0.495**, ROC-AUC **0.792** vs suy-từ-hồi-quy 0.289 / 0.605 → **chọn classifier**.

**Outer (xác nhận; base rate 0.35):**

| Horizon | ROC-AUC clf / derived | PR-AUC clf / derived | Recall@P0.8 clf / derived | Brier clf / derived |
|---|---|---|---|---|
| h=1 | **0.796** / 0.746 | **0.688** / 0.664 | 0.38 / 0.41 | 0.171 / 0.169 |
| h=2 | 0.739 / 0.745 | 0.635 / **0.684** | 0.28 / 0.34 | 0.209 / 0.179 |
| h=3 | 0.738 / 0.722 | 0.616 / **0.665** | 0.18 / 0.30 | 0.204 / 0.204 |
| h=6 | **0.748** / 0.665 | **0.637** / 0.577 | **0.30** / 0.05 | 0.204 / 0.253 |
| **Gộp** | **0.758** / 0.720 | 0.646 / 0.646 | **0.30** / 0.19 | 0.197 / 0.201 |

Theo vùng (ROC-AUC clf / derived): **Bắc 0.839** / 0.770 · Trung 0.766 / 0.685 (PR-AUC 0.834) · **Nam 0.597 / 0.635**.
ECE gộp: classifier 0.089, derived 0.079 (đều đã hiệu chỉnh trực tuyến).

## Kết luận

1. **Classifier cải thiện có chọn lọc, không toàn diện:** ROC-AUC gộp 0.720→0.758 (+0.04), thắng rõ ở **h=1 (+0.05) và h=6
   (+0.08; Recall@P0.8 từ 0.05 lên 0.30)**, miền Bắc (0.77→0.84) và Trung; nhưng PR-AUC gộp **bằng nhau** (0.646) và ở
   h=2,3 cách suy-từ-hồi-quy còn nhỉnh hơn. Miền **Nam vẫn gần ngẫu nhiên** (ROC 0.60).
2. **Vẫn chưa đạt mốc D-MOSS 0.83–0.94** (pooled 0.76; chỉ Bắc 0.84 và h=1 0.80 chạm mốc dưới) — và mốc đo trên định
   nghĩa/dữ liệu/độ phân giải khác nên chỉ để tham chiếu.
3. **Yêu cầu vận hành "precision 0.8" vẫn không đạt ở recall hữu ích:** Recall@P0.8 gộp 0.30; Precision@Recall 0.8 chỉ 0.47.
4. **Xác suất được hiệu chỉnh tương đương** (Brier 0.197 vs 0.201) — hiệu chỉnh isotonic trực tuyến giải quyết cả hai.

## Điều bất ngờ / nghi vấn ⭐

- **Validation phóng đại khoảng cách** (ROC 0.79 vs 0.61) mà outer chỉ còn +0.04: điểm derived trên validation yếu bất thường
  (dự báo M4 ở giai đoạn ≤2008 với ít dữ liệu huấn luyện hơn + base rate thấp 0.18) — lại là dịch chuyển phân phối theo
  thời gian; validation chọn đúng hướng nhưng không đáng tin về ĐỘ LỚN lợi ích.
- **Trung bình hạng (classifier + derived) — khám phá, KHÔNG khai báo trước, không chọn:** PR-AUC 0.694, ROC 0.760,
  Recall@P0.8 0.34 (cao nhất) — gợi ý 2 cách bổ sung nhau (chỉ 1 bộ outer, chưa kiểm chứng trên validation).
- Nam yếu ở cả hai cách dù M4 hồi quy tốt nhất ở Nam (MASE 0.72) — dự báo số ca tốt ≠ phân biệt tốt quanh ngưỡng P75.

## Hạn chế đã biết

- 1 mùa dịch (2009-11→2010-12), 34 tỉnh; chưa có khoảng tin cậy. Lead time chưa tính lại cho classifier (xem exp_011:
  chỉ ~37% sự kiện được báo trước, trung vị 2 tháng với cách suy-từ-hồi-quy).
- Ngưỡng = 0 ở ~29% quan sát (nhãn "có ca"), chưa tách riêng miền Bắc.
- Chưa tuning classifier (T1 mặc định), chưa thử hiệu chỉnh riêng theo vùng.

## Quyết định

- **Dùng classifier trực tiếp làm điểm cảnh báo chính** (theo quy tắc khai báo trước) + hiệu chỉnh isotonic trực tuyến;
  giữ hồi quy M4-R2 cho bài toán A (số ca) — hai đầu ra phục vụ 2 mục đích khác nhau (docs/02 §1).
- Model card phải nêu: ROC-AUC ~0.76 (< D-MOSS), Nam gần ngẫu nhiên, không đạt precision 0.8 ở recall hữu ích.

## Việc tiếp theo

- [ ] Kiểm chứng "trung bình hạng" bằng cách khai báo trước + chọn trên validation.
- [ ] SHAP cho M2 và classifier; model card tổng hợp mọi giới hạn.
