# exp_004 — M3 hhh4 (bán cơ giới endemic-epidemic)

- **Ngày chạy:** 2026-09-23
- **Data version:** panel v0.2.0
- **Toolchain:** R 4.6.1 + Rtools45 + package `surveillance` (cài vào `ai-service/.rlibs/`, gitignored)
  — xem `app/forecast/r_env.py` cho 3 bẫy Windows đã gặp khi thiết lập (R_HOME, PATH cho R.dll,
  `.libPaths()` append vs replace).
- **Thời gian chạy:** 8.5s cho toàn bộ 8 origin × tới 4 horizon (rất nhanh — mỗi fit hhh4 ~3-4s,
  mỗi simulate ~0.1s).

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp (mọi experiment, có biểu đồ).

## Câu hỏi

M3 (hhh4, thành phần AR + lan truyền không gian NE + endemic mùa vụ) có thắng baseline hay các model
Tier 1 khác không? Đây là model duy nhất trong zoo bắt được **lan truyền không gian giữa các tỉnh kề
nhau** — giá trị mà M1/M2 không có.

## Thiết lập

Cùng protocol real-only, 8 origin, `embargo_months=1`, horizon `{1,2,3,6}` như exp_001/002/003.

**Cấu trúc hhh4 (docs/02 §3):**
- `ar = ~1` — tự hồi quy trên chính ca bệnh tỉnh đó tháng trước
- `ne = ~1`, trọng số = ma trận kề nhị phân 34 tỉnh (`app/data/adjacency.py`, suy từ
  `provinces.geojson` bằng `intersects()`, đã verify không có tỉnh nào bị cô lập/false-adjacency từ
  đảo xa Trường Sa/Hoàng Sa — 6 unit test)
- `end = ~1 + sin(2πt/12) + cos(2πt/12)`, offset = dân số — baseline mùa vụ
- `family = "NegBin1"`
- Dự báo đa bước: mô phỏng Monte Carlo (`simulate.hhh4`, 200 lần lặp), lấy trung bình — cách chuẩn
  của package cho dự báo xa từ model tự hồi quy (không phải "đệ quy" bị cấm ở docs/02 §1, cái đó áp
  dụng cho model dạng bảng đặc trưng M1/M2)

**⚠️ Khác biệt quan trọng so với M1/M2:** `end` formula ở đây **KHÔNG có bất kỳ biến khí hậu nào**
(không temp/precip/ONI) — chỉ mùa vụ thuần. Đây là giới hạn có chủ đích của lần chạy đầu (thêm
covariate khí hậu vào `hhh4` cần truyền `data=` là ma trận time×tỉnh riêng cho từng biến qua rpy2,
tốn thêm công đáng kể) — xem "Việc tiếp theo".

## Kết quả — ⚠️ KẾT QUẢ ÂM TÍNH, M3 THUA MỌI MODEL KHÁC Ở H≥2

| Model | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| B2 Seasonal naive (exp_001) | 0.739 | 1.028 | 1.399 | 1.998 |
| B3 Climatology (exp_001) | 0.522 | 0.757 | 1.069 | 1.638 |
| M1 GLM NegBin (exp_002) | 0.497 | 0.736 | 1.138 | 1.644 |
| M2a XGBoost (exp_002) | 0.449 | 0.698 | 0.963 | 1.611 |
| M2b LightGBM (exp_002) | 0.447 | 0.694 | 1.001 | 1.608 |
| **M3 hhh4** | 0.544 | **1.038** | **1.527** | **2.406** |

**M3 chỉ thắng B2 ở h=1** (0.544<0.739), thua MỌI model khác kể cả 2 baseline ở h=2,3,6. Ở h=6, M3
(2.406) còn tệ hơn cả B2 (1.998) — tệ nhất trong toàn bộ 7 cấu hình đã thử qua 4 thí nghiệm.

## Điều bất ngờ / nghi vấn ⭐

Kết quả này phù hợp với 1 giả thuyết rõ ràng, không cần suy đoán xa: **M3 là model DUY NHẤT không
dùng bất kỳ thông tin khí hậu nào**, trong khi EDA (`03_eda_panel.ipynb`) đã đo được tương quan khí
hậu↔ca bệnh khá mạnh (nhiệt độ lag 2 tháng r=0.565, mưa lag 1 tháng r=0.527) và M1/M2 đều khai thác
tín hiệu này trực tiếp qua feature. hhh4 chỉ có mùa vụ (sin/cos) + tự hồi quy + lan truyền không gian
— **thiếu đúng phần tín hiệu mạnh nhất** mà các model khác có.

Đây có khả năng cao là NGUYÊN NHÂN CHÍNH (không phải bug trong code — đã verify riêng: ma trận kề
đúng, hhh4sims array indexing đúng sau khi sửa bug `unclass()`, dự báo point-forecast có scale và
phân phối hợp lý so với thực tế khi so sánh 1 origin mẫu). Không loại trừ khả năng cấu trúc AR+NE đơn
giản (bậc 1, không có lag dài hơn) cũng góp phần, nhưng thiếu khí hậu là khác biệt rõ ràng nhất so
với các model thắng.

## Hạn chế đã biết

- `end` formula chưa có covariate khí hậu — xem trên.
- `ar`/`ne` chỉ bậc 1 (`~1`, không có thêm biến giải thích trong 2 thành phần này) — hhh4 cho phép
  thêm biến vào cả `ar$f`/`ne$f`, chưa thử.
- `family = "NegBin1"` (1 tham số phân tán chung toàn bộ tỉnh) — `NegBinM` (phân tán riêng theo tỉnh)
  có thể phù hợp hơn với dữ liệu có tỉnh chênh lệch quy mô lớn, chưa thử vì tốn thêm thời gian fit.

## Quyết định

- **Không đưa M3 (cấu hình hiện tại) vào M4 Ensemble** — thua rõ rệt mọi model khác ở h≥2, đưa vào
  ensemble nhiều khả năng kéo tụt kết quả chung thay vì đóng góp tích cực (E1 trung bình đơn giản đặc
  biệt nhạy với model yếu). Nếu làm E2 (trọng số theo sai số validation) thì M3 sẽ tự động nhận trọng
  số rất thấp — có thể thử sau nếu có thời gian, không ưu tiên.
- **Không kết luận "hhh4 không phù hợp với bài toán"** — kết luận đúng hơn là "hhh4 CHƯA ĐƯỢC CHO
  thấy đủ thông tin để cạnh tranh", vì thiếu đúng nhóm biến mạnh nhất. Đây là khác biệt quan trọng khi
  báo cáo (docs/02 §10: không đạt G1 là kết quả nghiên cứu hợp lệ, không phải thất bại — quan trọng là
  không đổ lỗi sai chỗ).

## Việc tiếp theo

- [ ] Thêm covariate khí hậu vào `end$f` (và có thể `ar$f`) qua tham số `data=` của `hhh4()` — cần
      truyền ma trận time×tỉnh cho `temp_mean_lag_2`/`precip_total_lag_1` (đã tính sẵn trong
      `features.py`) qua rpy2. Nếu M3 sau khi thêm khí hậu vẫn thua M2, đó mới là bằng chứng chắc
      chắn cho thấy thành phần lan truyền không gian không mang lại giá trị thêm ở quy mô dữ liệu này.
- [ ] Thử `family = "NegBinM"` (phân tán riêng theo tỉnh)
- [ ] M4 Ensemble: M1 + M2a + M2b (bỏ M3 khỏi ensemble cho tới khi có bản M3 cạnh tranh hơn)
