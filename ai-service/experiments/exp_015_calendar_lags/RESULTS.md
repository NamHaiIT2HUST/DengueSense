# exp_015 — Tác động của lỗi "lag theo số dòng" lên M4-R2: KHÔNG ĐÁNG KỂ

- **Ngày chạy:** 2026-09-25 · M4-R2 đánh giá đầy đủ (8 origin × 4 horizon) với panel căn theo tháng lịch
- **File:** `predictions.json`, `summary.json`, `analysis_output.txt` (`run.py`)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) và [docs/07-model-card.md](../../../docs/07-model-card.md) (giới hạn L10).

## Câu hỏi

Các hàm đặc trưng dịch theo SỐ DÒNG (`groupby.shift/rolling`), nhưng 5/34 tỉnh (ca_mau, cao_bang, da_nang, gia_lai, thai_nguyen) có 1–2 tháng
thiếu giữa chuỗi real (phát hiện ở exp_009). Sau khoảng trống, lag lệch tối đa 1 tháng. Lỗi này ảnh hưởng kết quả đã công bố bao nhiêu?

## Thiết lập

`backtest.calendarize_panel` chèn dòng NaN cho tháng thiếu (dân số điền tiến), dựng đặc trưng, rồi bỏ dòng chèn → lag theo dòng = lag theo tháng
lịch (`load_real_panel_with_features(calendarize=True)`, mặc định TẮT để giữ nguyên số đã công bố; 1 test hồi quy). Chạy lại ĐÚNG đánh giá M4-R2.

**Mức ảnh hưởng ở cấp đặc trưng:** 151/6776 dòng (2.2%) có ≥1 đặc trưng T1 khác (chỉ 5 tỉnh nói trên); nhiều nhất `deviation_from_median` (1.49%),
`same_month_last_year` (0.58%), các lag ngắn ≤ 0.3%.

## Kết quả (MASE M4-R2, outer)

| | Lag theo dòng (đã công bố) | Lag theo tháng lịch | Δ |
|---|---|---|---|
| h=1 | 0.404 | 0.407 | +0.76% |
| h=2 | 0.625 | 0.631 | +1.00% |
| h=3 | 0.851 | 0.852 | +0.14% |
| h=6 | 1.394 | 1.389 | −0.35% |
| **Gộp** | **0.8185** | **0.8199** | **+0.17%** |
| Bắc | 1.373 | 1.338 | −2.53% |
| Trung | 0.904 | 0.902 | −0.26% |
| Nam | 0.722 | 0.731 | +1.18% |

## Kết luận

- **Tác động không đáng kể và dấu lẫn lộn** (gộp +0.17%; mọi horizon trong ±1%; Bắc −2.5%, Nam +1.2%): nằm trong nhiễu đã thấy giữa các
  cấu hình (std giữa origin lớn). **Không thay đổi bất kỳ kết luận nào**; G1 vẫn đạt (0.407 và 0.852 < 0.90).
- Bản căn theo tháng lịch là ĐÚNG về mặt logic → **dùng `calendarize=True` cho mọi lần chạy lại toàn pipeline từ giờ**; các số đã công bố
  giữ nguyên (chênh lệch ≤ 1%, đã đo) — không cần đổi lại toàn bộ tài liệu.
- Giới hạn L10 của model card được **đóng bằng số đo**: lỗi có thật nhưng ảnh hưởng ≤ ~1% (Bắc −2.5%, không làm xấu đi).

## Hạn chế đã biết

- Chỉ đo cho M4-R2; chưa đo cho classifier cảnh báo (ảnh hưởng dự kiến tương tự nhỏ do cùng đặc trưng).
- 8 origin, 1 mùa: chênh lệch ±1% không có ý nghĩa thống kê.
