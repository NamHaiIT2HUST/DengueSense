# exp_013 — Đòn bẩy cho classifier cảnh báo: KẾT QUẢ ÂM TÍNH, không đòn bẩy nào được nhận

- **Ngày chạy:** 2026-09-25 · validation 10 origin, outer 8 origin, real-only
- **File:** `predictions.json`, `summary.csv`, `analysis_output.txt` (`run.py` + `analyze.py`; `smoke.py` kiểm A0 khớp exp_012 tuyệt đối)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

exp_012 dừng ở ROC-AUC 0.758 (< mốc D-MOSS 0.83), Nam ~0.60. Có đòn bẩy nào nâng được không? Khai báo trước: **A1** thêm đặc trưng
không gian (láng giềng/toàn quốc, cả bản chia cho ngưỡng), **A2** một model chung cho mọi horizon (4× dữ liệu), **A3** trung bình
hạng với điểm suy từ hồi quy M4-R2. Quy tắc nhận (trên VALIDATION): PR-AUC gộp +5% tương đối VÀ ROC-AUC không giảm so với A0.

## Kết quả

**Validation (chọn):** A1 PR-AUC −1.3% (ROC +0.002) · A2 +1.5% (ROC +0.012) · **A3 −17.6% (ROC −0.061)** → **không đòn bẩy nào được nhận.**

**Outer (xác nhận, gộp; base 0.351):**

| | PR-AUC | ROC-AUC | Recall@P0.8 | Prec@R0.8 |
|---|---|---|---|---|
| A0 (exp_012) | 0.646 | 0.758 | 0.296 | 0.472 |
| A1 không gian | 0.638 | 0.758 | 0.202 | 0.483 |
| A2 chung horizon | 0.641 | 0.760 | 0.275 | 0.465 |
| A3 trung bình hạng | 0.694 | 0.760 | 0.338 | 0.500 |

- **A1 (không gian): không có tác dụng** với việc vượt ngưỡng (ROC 0.758 → 0.758), nhất quán với exp_009 (tín hiệu yếu).
  Nam 0.597→0.619, Bắc 0.839→0.846: trong dao động.
- **A2 (chung horizon): không đáng kể** (+0.002 ROC).
- **Mâu thuẫn validation/outer ở A3 ⭐:** A3 tệ hơn rõ trên validation (−17.6% PR-AUC) nhưng CAO NHẤT ở outer (PR-AUC 0.694 vs 0.646,
  Recall@P0.8 0.34). Đây đúng loại tình huống chọn theo outer sẽ là "tự lừa mình": quy tắc khai báo trước nói KHÔNG nhận, và
  **không đổi quy tắc sau khi thấy outer.** Giải thích khả dĩ (chưa kiểm chứng): điểm suy từ hồi quy yếu trên validation (dự báo M4
  huấn luyện ít dữ liệu hơn ở giai đoạn ≤2008) nhưng khá hơn ở outer — lại là dịch chuyển giữa 2 giai đoạn; A3 có thể thật sự hữu ích
  nhưng bằng chứng hiện có không cho phép khẳng định.

## Kết luận

Classifier cảnh báo **dừng ở ROC-AUC ~0.76** với dữ liệu/đặc trưng hiện có: không đòn bẩy nào đã kiểm được nâng lên mốc 0.83. **Giữ A0
(exp_012).** Cải thiện thêm bằng tuning/chọn trên outer chỉ là overfit vào 1 mùa dịch (8 origin) — không làm.

## Hạn chế đã biết

- 1 mùa dịch, 34 tỉnh; chưa có khoảng tin cậy. Chênh lệch ROC ±0.01 nằm trong nhiễu.
- Chưa tuning classifier, chưa thử loại đặc trưng khác (vd dữ liệu tuần, mật độ muỗi — chưa có nguồn).

## Việc tiếp theo

- [ ] Kiểm chứng A3 đúng cách: khai báo lại + đánh giá trên cửa sổ validation mới / khi có thêm dữ liệu real ngoài 2010.
- [ ] SHAP, model card (nêu rõ giới hạn cảnh báo).
