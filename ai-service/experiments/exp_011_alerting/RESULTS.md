# exp_011 — Bài toán B: cảnh báo xác suất vượt ngưỡng P75 từ dự báo M4-R2 (docs/02 §5.2-5.3)

- **Ngày chạy:** 2026-09-25 · validation 10 origin (≤2008-12) để FIT bộ hiệu chỉnh; outer 8 origin để ĐÁNH GIÁ
- **File:** `predictions.json`, `summary.csv`, `analysis_output.txt`, `reliability.png` (`run.py` + `analyze.py`)
- Module: `app/forecast/alerting.py` (ngưỡng nhân quả, đuôi Poisson, Platt/Isotonic/Residual, reliability/ECE, 7 test)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

Suy xác suất "tháng dự báo vượt P75 lịch sử của chính tỉnh đó cho chính tháng đó" từ điểm dự báo M4-R2 (cách docs/02 §1
khuyến nghị) cho chất lượng cảnh báo ra sao? Hiệu chỉnh xác suất (§5.3) có giúp không?

## Thiết lập

- Nhãn: `y_true > P75` của incidence lịch sử (≤ train_end) cùng tháng dương lịch, theo tỉnh — nhân quả. 29.1% quan sát
  outer có ngưỡng = 0 (nhãn = "có ca"), chủ yếu miền Bắc.
- 4 cách ra xác suất: **Poisson thô** (không hiệu chỉnh, đuôi Poisson quanh số ca dự báo), **Platt**, **Isotonic**
  (cả hai trên x = log((pred+1)/(thr+1))), **Residual** (phân phối sai số log thực nghiệm). Fit theo từng horizon.
- **Chọn bằng Brier leave-one-origin-out TRÊN VALIDATION** (không dùng outer): isotonic 0.1405 < platt 0.1442 <
  residual 0.2043 < poisson thô 0.2333 → chọn **isotonic**. Ngoài ra thử biến thể **trực tuyến** (fit lại chỉ trên kết
  quả đã trưởng thành ≤ train_end, đúng như vận hành).
- Điểm tham chiếu không hiệu chỉnh cho xếp hạng: `pred/(thr+1)`.

## Kết quả (outer, 1088 quan sát; base rate outer 0.35 — CAO hơn validation 0.18)

| Horizon | Base rate | PR-AUC (isotonic) | ROC-AUC | Brier thô → isotonic | ECE thô → isotonic | Recall@P0.8 |
|---|---|---|---|---|---|---|
| h=1 | 0.312 | 0.630 | 0.758 | 0.258 → **0.172** | 0.254 → 0.068 | 0.41 |
| h=2 | 0.342 | 0.611 | 0.739 | 0.254 → **0.185** | 0.248 → 0.092 | 0.33 |
| h=3 | 0.353 | 0.589 | 0.712 | 0.293 → **0.211** | 0.288 → 0.112 | 0.10 |
| h=6 | 0.397 | 0.527 | 0.683 | 0.286 → **0.253** | 0.286 → 0.166 | 0.00 |
| **Gộp** | 0.351 | 0.606 | 0.733 | 0.273 → **0.205** | 0.264 → 0.103 | 0.17 |

Trực tuyến (isotonic_online, gộp): Brier 0.201, **ECE 0.079**, PR-AUC 0.610, ROC-AUC 0.723. Điểm `pred/thr` (không hiệu chỉnh):
PR-AUC 0.660, ROC-AUC 0.747. Theo vùng (isotonic): Trung base 0.54, PR-AUC 0.69; Bắc base 0.28, 0.62; **Nam base 0.24,
PR-AUC 0.32, Recall@P0.8 = 0**.

## Kết luận

1. **Hiệu chỉnh giúp rõ về chất lượng xác suất:** Brier giảm ~25% (0.273→0.205), ECE 0.264→0.103 (0.079 nếu hiệu chỉnh
   trực tuyến); đuôi Poisson thô cực kỳ quá tự tin (đúng dự đoán docs §5.3). Isotonic thắng Platt/residual trên
   validation LOO; trực tuyến tốt hơn tĩnh về ECE.
2. **Khả năng phân biệt khiêm tốn, không đạt mốc tài liệu:** ROC-AUC gộp ~0.73 (h=1 0.76 → h=6 0.68), PR-AUC 0.61 so
   với base 0.35 (lift ~1.7×; h=6 chỉ 1.3×). Mốc D-MOSS 0.83–0.94 (docs/02 §1) **không đạt**. Nam gần như không phân
   biệt (PR-AUC 0.32 ≈ base 0.24+).
3. **Không đạt yêu cầu vận hành "precision 80%":** Recall@P=0.8 gộp chỉ 0.17-0.29; ở h≥3 gần 0. Muốn recall 0.8 thì
   precision chỉ ~0.47 (gần base rate + 0.12). Cảnh báo chỉ dùng được ở ngưỡng tin cậy cao và bỏ sót phần lớn.
4. **Lead time (xấp xỉ, 1 mùa duy nhất 2009-11→2010-12):** với τ=0.5 (precision≥0.8 trên validation LOO), chỉ **37% sự kiện**
   (59/160 tỉnh×tháng vượt ngưỡng) được báo trước; **trung vị 2 tháng (~9 tuần) TRONG SỐ ĐÃ PHÁT HIỆN**. Precision outer tại τ:
   h=1 0.62, h=2 0.84, h=3 1.0 (ít mẫu); recall h=1 0.57, h=2 0.33, h=3 0.10, h=6 0. **Không được phát biểu "báo trước 5–9
   tuần" như một khả năng chung** — chỉ đúng có điều kiện cho một phần nhỏ sự kiện, trên 1 mùa.

## Điều bất ngờ / nghi vấn ⭐

- **Base rate outer (0.31–0.40) gần gấp đôi validation (0.17–0.19)** dù ngưỡng định nghĩa là P75 (kỳ vọng 25%): 2009–2010
  là giai đoạn cao so với lịch sử → dịch chuyển phân phối theo thời gian (cùng chủ đề exp_003, exp_006/008) làm bộ
  hiệu chỉnh fit trên validation lệch (ECE 0.10 tĩnh vs 0.08 trực tuyến). Trong vận hành phải hiệu chỉnh lại định kỳ.
- **Điểm thô `pred/thr` xếp hạng tốt ngang hoặc hơn mọi xác suất đã hiệu chỉnh** (PR-AUC 0.660 vs 0.606): hiệu chỉnh
  cải thiện xác suất (Brier/ECE) nhưng KHÔNG cải thiện xếp hạng (isotonic còn tạo hoà điểm) — đúng bản chất hiệu chỉnh;
  muốn phân biệt tốt hơn phải cải thiện chính điểm dự báo, không phải bước hiệu chỉnh.
- Miền Nam gần như ngẫu nhiên (PR-AUC 0.32): M4 có MASE tốt nhất ở Nam (0.72) nhưng phân loại vượt P75 lại yếu — dự báo
  số ca tốt không đồng nghĩa phân biệt tốt quanh ngưỡng.

## Hạn chế đã biết

- Chỉ 8 origin × 34 tỉnh (1 mùa); khoảng tin cậy rộng, chưa tính. 160 sự kiện vượt ngưỡng.
- Ngưỡng = 0 ở 29% quan sát (nhãn "có ca") làm bài toán Bắc khác bản chất; chưa tách riêng.
- Lead time chỉ xấp xỉ bằng horizon lớn nhất còn báo động, không phải "trước đỉnh dịch" như định nghĩa docs.
- ROC-AUC/PR-AUC của D-MOSS/nghiên cứu khác đo trên định nghĩa, dữ liệu, độ phân giải khác — chỉ tham chiếu.

## Quyết định

- Dùng **isotonic hiệu chỉnh trực tuyến** làm đầu ra xác suất chuẩn của cảnh báo; **bắt buộc** hiệu chỉnh lại định kỳ.
- Vì cách suy ra từ hồi quy cho phân biệt khiêm tốn (ROC-AUC 0.73 < mốc 0.83), **kích hoạt phương án dự phòng của
  docs/02 §1: thử classifier riêng** (exp_012), ghi rõ lý do.

## Việc tiếp theo

- [ ] exp_012: classifier trực tiếp (LightGBM nhị phân) so với cách suy ra từ hồi quy.
- [ ] SHAP, model card (nêu rõ: Bắc/Nam yếu, bùng dịch dự báo thấp, cảnh báo chưa đạt precision 0.8 ở recall hữu ích).
