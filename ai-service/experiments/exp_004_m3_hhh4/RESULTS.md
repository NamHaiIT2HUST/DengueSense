# exp_004 — M3 hhh4 (bán cơ giới endemic-epidemic)

- **Ngày chạy:** 2026-09-23 (v1, không khí hậu) · **2026-09-23 (v2, thêm climatology khí hậu)**
- **Data version:** panel v0.2.0
- **Toolchain:** R 4.6.1 + Rtools45 + package `surveillance` (cài vào `ai-service/.rlibs/`, gitignored)
  — xem `app/forecast/r_env.py` cho 3 bẫy Windows đã gặp khi thiết lập (R_HOME, PATH cho R.dll,
  `.libPaths()` append vs replace).
- **Thời gian chạy:** ~17s cho toàn bộ 8 origin × 2 biến thể (không/có khí hậu) × tới 4 horizon.

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

**⚠️ v1 (lần chạy đầu) không có bất kỳ biến khí hậu nào** (không temp/precip/ONI) — chỉ mùa vụ thuần.
**v2 (cập nhật ngay sau đó, cùng ngày) thêm 2 covariate khí hậu** vào `end$f`:
`~1 + sin(2πt/12) + cos(2πt/12) + temp_mean + precip_total`, dùng **climatology theo tỉnh** (trung
bình lịch sử theo tháng dương lịch, tính CHỈ từ dữ liệu `<= train_end`) — **CỐ Ý không dùng giá trị
khí hậu thực đo tại từng thời điểm**, vì `simulate.hhh4()` mô phỏng tiến về tương lai và cần giá trị
covariate ở CẢ các bước tương lai đang mô phỏng; dùng khí hậu thực đo ở đó sẽ là đúng lớp lỗi rò rỉ đã
bắt được ở exp_002 (đọc dữ liệu thật của giai đoạn sau `train_end`). Chi tiết + lý do đầy đủ:
`app/forecast/models_r.py` docstring phần "Covariate khí hậu trong end$f".

## Kết quả

### v1 — không khí hậu — ⚠️ KẾT QUẢ ÂM TÍNH, M3 THUA MỌI MODEL KHÁC Ở H≥2

| Model | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| B2 Seasonal naive (exp_001) | 0.739 | 1.028 | 1.399 | 1.998 |
| B3 Climatology (exp_001) | 0.522 | 0.757 | 1.069 | 1.638 |
| M1 GLM NegBin (exp_002) | 0.497 | 0.736 | 1.138 | 1.644 |
| M2a XGBoost (exp_002) | 0.449 | 0.698 | 0.963 | 1.611 |
| M2b LightGBM (exp_002) | 0.447 | 0.694 | 1.001 | 1.608 |
| **M3 hhh4 (v1, không khí hậu)** | 0.544 | 1.038 | 1.527 | 2.406 |

M3 v1 chỉ thắng B2 ở h=1 (0.544<0.739), thua MỌI model khác kể cả 2 baseline ở h=2,3,6.

### v2 — có climatology khí hậu — ⚠️ VẪN THUA MỌI MODEL KHÁC, nhưng cải thiện thật, nhất quán

| Model | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| M3 hhh4 (v1, không khí hậu) | 0.544 | 1.038 | 1.527 | 2.406 |
| **M3 hhh4 (v2, +climatology khí hậu)** | **0.542** | **1.014** | **1.477** | **2.232** |
| Cải thiện so với v1 | −0.4% | −2.3% | −3.3% | **−7.2%** |
| Mốc thực tế mạnh nhất (B3, để so sánh) | 0.522 | 0.757 | 1.069 | 1.638 |

Thêm khí hậu giúp **thật, đều đặn ở mọi horizon, và tăng dần theo horizon** (0.4%→7.2%) — không phải
nhiễu ngẫu nhiên. Nhưng **vẫn chưa đủ để M3 cạnh tranh**: ở h=6, M3 v2 (2.232) vẫn thua cả B1
Persistence (2.164) — model baseline đơn giản nhất. So với B3/M1/M2 (0.96-1.64 ở h=3,6), M3 v2 vẫn
kém xa.

## Điều bất ngờ / nghi vấn ⭐

**v1:** phù hợp với giả thuyết rõ ràng — M3 là model DUY NHẤT không dùng thông tin khí hậu, trong khi
EDA đo được tương quan khí hậu↔ca bệnh khá mạnh (nhiệt độ lag 2 tháng r=0.565, mưa lag 1 tháng
r=0.527) mà M1/M2 đều khai thác trực tiếp.

**v2 (điều bất ngờ thật sự):** thêm khí hậu chỉ đóng góp cải thiện KHIÊM TỐN (0.4-7.2%), không đủ để
lấp khoảng cách với M1/M2/B3 — giả thuyết "chỉ thiếu khí hậu" ở v1 **đúng một phần, không đầy đủ**.
Chẩn đoán: **climatology (chuẩn mùa vụ trung bình nhiều năm) khác về bản chất với "khí hậu lag thực
đo" mà M1/M2 dùng** — M1/M2's `temp_mean_lag_2`/`precip_total_lag_1` đọc giá trị THỰC ĐO tại
`train_end-2`/`train_end-1`, bắt được **bất thường liên năm** (vd năm nay nóng/mưa hơn trung bình
mọi năm — chính là loại tín hiệu El Niño/La Niña ONI cũng nắm được). Climatology theo định nghĩa loại
bỏ hoàn toàn biến động liên năm (chỉ còn hình dạng mùa vụ trung bình, tương tự B3) — vì vậy chỉ cải
thiện chút ít so với sin/cos thuần (vốn cũng đã mã hoá mùa vụ, chỉ khác là không phân biệt theo tỉnh).
**Kết luận cập nhật:** M3 thiếu KHÔNG PHẢI "khí hậu nói chung" mà thiếu cụ thể **tín hiệu bất thường
khí hậu theo thời gian thực** — loại tín hiệu khó đưa vào `hhh4` mà không rò rỉ (xem "Việc tiếp theo"
cho 1 hướng khả thi: ONI lag đủ xa).

Không phải bug — verify riêng: ma trận kề đúng, hhh4sims array indexing đúng, climatology covariate
chạy đúng chiều (test `test_fit_hhh4_with_climate_covariates_runs_and_differs_from_no_climate`), dự
báo v1 vs v2 khác nhau đúng như kỳ vọng (không giống hệt, không NaN).

## Hạn chế đã biết

- Climatology khí hậu chỉ bắt được mùa vụ theo tỉnh, KHÔNG bắt được bất thường liên năm (xem trên).
- `ar`/`ne` chỉ bậc 1 (`~1`, không có thêm biến giải thích trong 2 thành phần này) — hhh4 cho phép
  thêm biến vào cả `ar$f`/`ne$f`, chưa thử.
- `family = "NegBin1"` (1 tham số phân tán chung toàn bộ tỉnh) — `NegBinM` (phân tán riêng theo tỉnh)
  có thể phù hợp hơn với dữ liệu có tỉnh chênh lệch quy mô lớn, chưa thử vì tốn thêm thời gian fit.

## Quyết định

- **Không đưa M3 (v1 lẫn v2) vào M4 Ensemble** — cả 2 bản đều thua rõ rệt mọi model khác ở h≥2, đưa
  vào ensemble nhiều khả năng kéo tụt kết quả chung (E1 trung bình đơn giản đặc biệt nhạy với model
  yếu). Dùng v2 (có khí hậu) làm bản tham chiếu "M3 tốt nhất hiện tại" khi cần trích dẫn.
- **Không kết luận "hhh4 không phù hợp với bài toán"** — kết luận đúng hơn là "hhh4 chưa có đủ ĐÚNG
  LOẠI tín hiệu khí hậu (bất thường liên năm, không chỉ mùa vụ) để cạnh tranh". Đây là khác biệt quan
  trọng khi báo cáo (docs/02 §10: không đạt G1 là kết quả nghiên cứu hợp lệ, không phải thất bại).

## Việc tiếp theo

- [ ] Thử thêm `oni_lag_6` (hoặc xa hơn) làm covariate — ONI biến động chậm (trung bình trượt 3 tháng
      của dị thường SST), lag đủ xa (≥ horizon dài nhất = 6) thì giá trị tại MỌI bước mô phỏng tương
      lai đều đã biết tại `train_end` mà không cần đo thật — có thể là cách duy nhất thêm được tín
      hiệu "bất thường liên năm" vào hhh4 mà không rò rỉ.
- [ ] Thử `family = "NegBinM"` (phân tán riêng theo tỉnh)
- [ ] M4 Ensemble: M1 + M2a + M2b (bỏ M3 khỏi ensemble cho tới khi có bản M3 cạnh tranh hơn)
