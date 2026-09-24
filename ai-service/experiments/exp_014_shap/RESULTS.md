# exp_014 — SHAP: tín hiệu nào dẫn dắt dự báo? (docs/02 §5)

- **Ngày chạy:** 2026-09-25 · 8 origin outer × 4 horizon; TreeSHAP CHÍNH XÁC có sẵn trong LightGBM (`pred_contrib`) và XGBoost
  (`pred_contribs`) — không cần thư viện `shap`. `app/forecast/explain.py` (5 test, gồm **tính cộng tính**: tổng đóng góp + nền = điểm thô
  của model, cho cả LightGBM và XGBoost).
- **File:** `results.json`, `shap_families.png`, `analysis_output.txt` (`run.py`)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp; tổng hợp giới hạn ở [docs/07-model-card.md](../../../docs/07-model-card.md).

## Câu hỏi

Model dùng tín hiệu nào để dự báo, tỉ trọng đổi thế nào theo horizon, chiều tác động có hợp lý về dịch tễ không, và giải thích
được từng dự báo cụ thể ("tỉnh X rủi ro cao vì ...") như docs/02 §5 yêu cầu?

## Thiết lập

Mỗi (horizon, origin): fit model T1 trên dữ liệu ≤ train_end (đúng như lúc đánh giá), SHAP trên 34 dòng test; gộp 8 origin (272 dòng).
Giải thích 3 model: hồi quy M2b (LightGBM Poisson), hồi quy M2a (XGBoost), classifier cảnh báo (LightGBM nhị phân, exp_012). Đặc trưng
gộp thành nhóm ý nghĩa; tỉ trọng = mean|SHAP| của nhóm / tổng.

## Kết quả

**Hồi quy (M2b LightGBM) — tỉ trọng theo nhóm (%):**

| Nhóm tín hiệu | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| Ca bệnh gần đây (lag, đà tăng) | 33.8 | 25.7 | 25.5 | **39.1** |
| Chuẩn mùa vụ của tỉnh (cùng tháng năm trước, lệch so với trung vị) | 24.3 | 28.1 | 26.6 | 12.1 |
| Khí hậu (nhiệt/mưa/ẩm, lag + rolling) | 27.9 | 25.5 | 22.7 | 22.6 |
| Mùa vụ (sin/cos tháng) | 8.7 | 15.7 | 20.8 | 19.9 |
| ONI (El Niño) | 5.3 | 5.1 | 4.4 | 6.4 |

- **LightGBM và XGBoost đồng thuận** (tương quan hạng nhóm 0.94–1.0) → kết quả không phụ thuộc thuật toán.
- Đặc trưng đơn lẻ mạnh nhất: h=1 `incidence_lag_2` (|SHAP| 0.70), `same_month_last_year` (0.63), `temp_mean_lag_1` (0.60); h=6
  `incidence_lag_3` (0.84), `sin_month` (0.57). **Chiều tác động hợp lý:** ca bệnh gần đây và cùng-tháng-năm-trước cao → dự báo cao
  (Spearman +0.9…+0.97); nhiệt độ lag 1 tháng cao → dự báo cao (+0.94); ONI lag 3 → dự báo cao (+0.58).
- **Khi horizon tăng:** tỉ trọng mùa vụ (sin/cos) tăng 8.7%→~20%, ca bệnh lag xa hơn (lag_3) chiếm ưu thế ở h=6; khí hậu giữ ổn định
  ~23-28%. ONI chỉ 4-6% ở hồi quy.

**Classifier cảnh báo — khác hẳn hồi quy:** nhóm **quy mô/ngưỡng của tỉnh chiếm 38–48%** (đặc trưng chia cho ngưỡng, `thr_target`,
`prov_mean`), ca bệnh gần đây chỉ 5–7%, **ONI 10–15%** (cao hơn hẳn hồi quy; `oni_lag_3` là đặc trưng số 1 ở h=6), khí hậu 15–22%.
Đặc trưng số 1 ở h=1: `deviation_from_median` (lệch so với trung vị lịch sử cùng tháng, |SHAP| 0.73).

**Giải thích từng dự báo (ví dụ, origin cuối 2010-06, h=1):** hồi quy — Khánh Hòa dự báo cao nhất, chủ yếu do ca bệnh 2 tháng trước
(17.9/100k, +0.94 trên thang log), ca cùng tháng năm ngoái (25.5, +0.57), đà tăng (+0.54), nhiệt độ tháng trước 27.3°C (+0.46).
Cảnh báo — Đà Nẵng, chủ yếu do lệch so với trung vị lịch sử (+1.54), ONI lag 6 (+0.89), ca lag 2 tương đối so ngưỡng (+0.50).
(Chi tiết trong `results.json::local_example_h1`.)

## Điều bất ngờ / nghi vấn ⭐

- **ONI quan trọng hơn ở bài toán cảnh báo (10–15%) so với đếm ca (4–6%)** — gợi ý El Niño liên quan tới việc VƯỢT ngưỡng bất thường
  hơn là quy mô ca. **Nhưng cần thận trọng:** ONI là biến toàn cầu (giống nhau mọi tỉnh), trong 1 mùa đánh giá (2009-11→2010-12,
  El Niño 2009-10) nó có thể chỉ đại diện cho "năm này cao hơn lịch sử" — tương quan giả trong 1 mùa. Không kết luận nhân quả.
- Hồi quy: nhiệt độ lag 1 quan trọng hơn lag 2 (EDA đo lag 2 mạnh nhất r=0.565): trùng lặp thông tin (nhiệt độ có tính mùa, chia sẻ
  tín hiệu với sin/cos và lag ca bệnh) nên SHAP chia đóng góp giữa các đặc trưng tương quan — không đọc từng đặc trưng riêng lẻ như
  "nguyên nhân".

## Hạn chế đã biết

- **SHAP đo mức model DỰA VÀO đặc trưng, không phải quan hệ nhân quả** — đặc trưng tương quan chia sẻ đóng góp.
- Chỉ giải thích M2a/M2b T1 (đặc trưng T1) và classifier LightGBM; **chưa giải thích** M1 (GLM NegBin), nhánh Bắc V3 (Tweedie,
  scale-aware) và phần pha Climatology của miền Nam trong M4-R2 — nên tỉ trọng nhóm "quy mô" = 0% ở hồi quy không phản ánh nhánh Bắc.
- Phân tích trên 8 origin của 1 mùa; tỉ trọng có thể đổi khi có thêm năm.

## Việc tiếp theo

- [ ] Giải thích cả nhánh Bắc V3 và M1; SHAP interaction cho cặp (khí hậu, mùa vụ).
