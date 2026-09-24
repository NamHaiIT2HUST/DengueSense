# exp_008 — Đòn bẩy cho bias bùng dịch và miền Bắc: M4-R2

- **Ngày chạy:** 2026-09-24 · validation 10 origin (≤2008-12), outer 8 origin, real-only
- **File:** `results.json`, `summary.csv`, `analysis_output.txt` (`run.py` + `analyze.py`), `verify_m4_equivalence.py`

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp.

## Câu hỏi

Sau exp_007, M4-R còn 2 điểm yếu: miền Bắc 1.366 (>1) và bias bùng dịch −15. Có đòn bẩy nào giúp, khi
chọn **chỉ bằng validation** (outer chỉ để xác nhận)?

## Thiết lập (khai báo trước khi chạy)

Áp lên phần GBM của M4-R (M2a+M2b, Bắc→V3 scale-aware, còn lại V0). 4 đòn bẩy độc lập:
C0 control · **C1** Tweedie (variance_power 1.5) thay Poisson · **C2** trọng số mẫu 3x cho dòng train > p90 của
tỉnh · **C3** pha 50% với Climatology (B3). C0 khớp exp_007 tuyệt đối (sai lệch 0.0 khi smoke-test).
Quy tắc chấp nhận toàn cục: MASE gộp không tệ hơn C0 quá 1% VÀ (MASE bùng dịch hoặc reg_avg giảm ≥5%).
Sau đó định tuyến theo vùng như exp_007: vùng nào có đòn bẩy tốt nhất cải thiện >10% trên validation thì dùng.

## Kết quả

**Toàn cục (quy tắc trên validation):** chỉ C3 được nhận (gộp −3.9%, bùng dịch −7.0%). Nhưng **outer xác nhận
lẫn lộn**: C3 MASE gộp không đổi (0.912), bùng dịch **tệ hơn** (2.91→3.26), Trung tệ hơn (0.979→1.086), trong khi
Bắc (1.416→1.120) và Nam (0.842→0.757) tốt hơn. Không có đòn bẩy toàn cục nào là chiến thắng rõ ràng.

**Định tuyến theo vùng (chọn bằng validation):**

| Vùng | Đòn bẩy tốt nhất (validation) | Cải thiện validation | Quyết định | Outer (vs C0) |
|---|---|---|---|---|
| Bắc | C1 Tweedie | −44.1% | C1 | 1.429 vs 1.416 — **không tái lập** |
| Trung | C1 | −4.4% | giữ C0 (<10%) | không đổi |
| Nam | C3 blend B3 | −17.1% | C3 | 0.757 vs 0.842 — **tái lập (−10%)** |

**M4-R2 đầy đủ = (M1 + 2·GBM định tuyến)/3, outer:**

| | h=1 | h=2 | h=3 | h=6 | Gộp | Bắc | Trung | Nam | Bùng dịch MASE / bias |
|---|---|---|---|---|---|---|---|---|---|
| M4 (exp_005) | 0.429 | 0.671 | 0.898 | 1.479 | 0.8693 | 1.755 | 0.904 | 0.800 | 2.555 / −15.06 |
| M4-R (exp_007) | 0.424 | 0.666 | 0.894 | 1.436 | 0.8552 | 1.366 | 0.904 | 0.800 | 2.552 / −15.21 |
| **M4-R2** | **0.404** | **0.625** | **0.851** | **1.394** | **0.8185** | 1.373 | 0.904 | **0.722** | 2.526 / −15.55 |

- M4-R2 vs M4-R: h=1 −4.7%, h=2 −6.2%, h=3 −4.8%, h=6 −2.9%, gộp **−4.3%**, thắng **27/32** fold. Vượt
  ngưỡng ≥3% (docs/02 §7). G1 (h=1 & h=3 < 0.90) đạt với biên thoải mái hơn (0.404 / 0.851).
- Nguồn cải thiện: chủ yếu **Nam (−10%)** nhờ pha Climatology — tức thêm B3 như một thành viên ensemble ở vùng
  mà B3 mạnh; Trung không đổi; **Bắc không cải thiện** (1.373 vs 1.366).

## Điều bất ngờ / nghi vấn ⭐

- **Gain −44% của Bắc-Tweedie trên validation hoàn toàn không tái lập ở outer** (1.429 vs 1.416): validation miền
  Bắc (2007-2008) có động lực khác 2009-2010 → ví dụ rõ về "winner's curse" khi chọn theo 10 origin. Giữ C1 cho Bắc
  vì đúng quy tắc khai báo trước (không đổi quy tắc sau khi thấy outer), nhưng ghi rõ là **không có bằng chứng
  cải thiện**; hiệu quả tương đương C0.
- **Bias bùng dịch KHÔNG sửa được**: C2 (trọng số 3x) giảm bias GBM rõ (−18.1→−14.2, MASE bùng dịch −15%) nhưng làm
  h=1 tệ 11% và Bắc tệ 21% — đánh đổi, không qua quy tắc chấp nhận (validation chỉ −3.2%). C1 giảm nhẹ (−16.5).
  Sau 3 lần thử (quy mô, isotonic, trọng số/Tweedie) bias âm khi bùng dịch vẫn là giới hạn nền tảng của phương
  pháp này (dự báo hồi quy về trung bình khi bùng phát đột ngột, không có tín hiệu báo trước trong đặc trưng).
- **Miền Bắc vẫn 1.373 > 1: M4-R2 KHÔNG thắng seasonal-naive ở miền Bắc.** Chỉ C3 (pha B3 cho Bắc) đưa Bắc xuống
  1.12 (vẫn >1) nhưng làm Trung/bùng dịch tệ hơn và không được chọn theo quy tắc.

## Hạn chế đã biết

- Chọn đòn bẩy theo vùng trên validation 10 origin, 9 so sánh (3 vùng × 3 đòn bẩy) — nguy cơ winner's curse (đã
  thấy ở Bắc). Nam-C3 tái lập nhưng cũng chỉ 8 origin outer.
- 1 tham số Tweedie (1.5), 1 hệ số pha (0.5), 1 trọng số bùng dịch (3x) — chưa quét.
- Chưa kiểm định thống kê khoảng tin cậy (std giữa origin lớn, xem exp_001).

## Quyết định

- **Chấp nhận M4-R2 làm M4 hiện hành** (`app/forecast/m4.py::predict_m4`, khớp tuyệt đối kết quả exp_008):
  cải thiện −4.3% so với M4-R, 27/32 fold, không vùng nào hồi quy.
- Model card phải nêu: (1) Nam/Trung có kỹ năng (0.72/0.90), Bắc KHÔNG (1.37); (2) dự báo thấp có hệ thống khi
  bùng dịch (bias ≈ −15.5 ca/100k); (3) Bắc-Tweedie không có bằng chứng lợi ích.

## Việc tiếp theo

- [ ] Robustness §4.4 (nhiễu/khuyết thiếu khí hậu) trên M4-R2 → notebook cho user chạy (cần nhiều lần chạy lại).
- [ ] Miền Bắc & bùng dịch cần TÍN HIỆU mới (không chỉ đổi loss): vd dữ liệu mật độ muỗi/sự kiện, hoặc mô hình
      hai giai đoạn cho chuỗi thưa — chưa làm.
- [ ] Calibration cho bài toán phân loại vượt ngưỡng (PR-AUC/Recall@Precision), SHAP, model card.
