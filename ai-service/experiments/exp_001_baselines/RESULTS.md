# exp_001 — 4 baseline Tier 0

- **Ngày chạy:** 2026-09-23
- **Commit:** 940ab77 (trước khi commit các file của exp_001)
- **Data version:** panel v0.2.0 (`ai-service/data/processed/v0.2.0/panel_monthly.parquet`)
- **Lệnh chạy:** `python experiments/exp_001_baselines/run.py` (từ `ai-service/`)

## Câu hỏi

4 baseline bắt buộc (docs/02 §3 Tier 0) đứng ở đâu trên dữ liệu thật của dự án? Mốc nào (`B2` seasonal
naive theo quy ước) sẽ dùng để tính MASE cho mọi model ở Phase 2?

## Thiết lập

- **Target:** `incidence_per_100k` (không dùng `cases` tuyệt đối — tránh model chỉ học "tỉnh đông dân
  thì nhiều ca", xem docs/01 §2.3).
- **Tập dữ liệu:** chỉ `data_source == "real"` (1994-02 → 2010-12) — bắt buộc theo docs/03 §8, tập
  test cấp tỉnh hiện chỉ có dữ liệu thật ở giai đoạn này. `assert_test_is_real_only()` chạy trước mỗi
  lần tính metric để chặn cứng, không chỉ dựa vào việc lọc dữ liệu đúng.
- **Splits:** rolling-origin, cửa sổ mở rộng, **8 origin** (`train_end` từ 2009-11 đến 2010-06, mỗi
  origin cách nhau 1 tháng), horizon `{1, 2, 3, 6}` tháng, `reporting_delay_months=1`.
- **Embargo = 1 tháng** (khác mặc định 6 của `make_splits()`) — quyết định có chủ đích: B1-B4 không
  dùng đặc trưng cửa sổ trượt sát `train_end` (persistence/seasonal-naive/climatology chỉ tham chiếu
  đúng 1 điểm lịch sử; GLM Poisson chỉ dùng mùa vụ + khí hậu của tháng dự báo) nên không có đường rò
  rỉ nào embargo lớn mới chặn được — hạ xuống mức tối thiểu để đánh giá được đủ cả 4 horizon thay vì
  chỉ h=6 (mặc định `embargo_months=6` sẽ lọc bỏ h=1,2,3, xem `app/forecast/splits.py` docstring).
- **Metric chính:** MASE (mẫu số = sai số tuyệt đối seasonal-naive tính trên phần **train** của từng
  origin, không phải trên test — đúng định nghĩa Hyndman, xem `app/forecast/metrics.py::mase`).

### 4 baseline

| | Công thức | Ghi chú |
|---|---|---|
| B1 Persistence | `ŷ[t+h] = y[train_end − D]` | D = reporting_delay_months = 1 |
| B2 Seasonal naive ⭐ | `ŷ[t+h] = y[cùng tháng năm trước]` | Mốc chuẩn quy ước — không tự động = MASE 1.0 vì mẫu số MASE tính trên train, không phải tự so với chính nó trên test |
| B3 Climatology | `ŷ[t+h] = trung bình lịch sử (đến train_end) của tháng đó tại tỉnh đó` | |
| B4 GLM Poisson | `cases ~ Poisson`, `offset = log(population)`, predictor = mùa vụ (sin/cos tháng) + `temp_mean` + `precip_total` **của chính tháng dự báo** | Pooled qua mọi tỉnh, KHÔNG có hệ số riêng theo tỉnh — xem giới hạn ở mục "Điều bất ngờ". Dùng khí hậu THẬT của tháng dự báo (đã biết trong backtest vì là dữ liệu lịch sử) — baseline tham chiếu "nếu biết trước khí hậu", không phải model triển khai thật |

## Kết quả

### MASE theo horizon (trung bình ± độ lệch chuẩn qua 8 origin)

| Model | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| B1 Persistence | 0.758 ± 0.626 | 1.196 ± 0.964 | 1.620 ± 1.214 | 2.164 ± 1.035 |
| **B2 Seasonal naive** ⭐ | 0.739 ± 0.511 | 1.028 ± 0.914 | 1.399 ± 1.227 | 1.998 ± 1.060 |
| **B3 Climatology** | **0.522 ± 0.458** | **0.757 ± 0.784** | **1.069 ± 1.059** | **1.638 ± 0.954** |
| B4 GLM Poisson (pooled) | 0.943 ± 0.867 | 1.333 ± 1.267 | 1.768 ± 1.536 | 2.367 ± 1.236 |

(MAE — cùng thứ hạng, xem `results.json` cho số liệu chi tiết từng origin/horizon)

## Nhận định

- **B3 Climatology thắng ở mọi horizon**, kể cả so với B2 seasonal naive (mốc chuẩn quy ước theo tài
  liệu). Hợp lý về mặt thống kê: số ca SXH theo tỉnh dao động mạnh giữa các năm (outbreak năm này có
  thể gấp nhiều lần năm trước) — lấy trung bình nhiều năm lịch sử làm dự báo ổn định hơn là chỉ dùng
  đúng 1 năm trước (B2) hay 1 điểm gần nhất (B1).
- **B1 Persistence luôn thua B2 Seasonal naive** — hợp lý, vì SXH có mùa vụ rõ (đỉnh dịch mùa mưa),
  "giữ nguyên giá trị gần nhất" không nắm được chu kỳ mùa, trong khi "lấy đúng tháng năm trước" thì có.
- **Không baseline nào có MASE < 1 ở horizon dài (h=6)** — dự báo 6 tháng xa khó hơn nhiều so với 1
  tháng cho mọi baseline, kể cả B3. Đúng như kỳ vọng.
- Đối chiếu mốc tài liệu (docs/06 §6, ≥69% @ 3 tháng theo PLOS NTD): baseline không đo bằng % chính
  xác phân loại nên chưa so trực tiếp được — sẽ đối chiếu khi có model phân loại nhị phân (PR-AUC) ở
  Phase 2.

## Điều bất ngờ / nghi vấn

- ⚠️ **B4 GLM Poisson thua CẢ 4 horizon, kể cả thua B1 Persistence** — ban đầu nghi là bug, đã kiểm
  tra kỹ (không phải bug): so sánh phân phối dự báo vs thực tế ở 1 origin mẫu (h=6, `target_month=
  2010-12`) cho thấy **độ lệch chuẩn dự báo (3.73) nhỏ hơn nhiều so với độ lệch chuẩn thực tế
  (17.81)** — model dự báo dồn về gần giá trị trung bình chung, không nắm được tỉnh nào vốn dĩ có
  incidence cao hơn hẳn (vd Cà Mau thực tế 97.0/100k nhưng model dự báo chỉ 11.5/100k).
  **Nguyên nhân xác định được:** B4 hiện tại là model **pooled** (chung 1 bộ hệ số cho cả 34 tỉnh),
  không có hệ số riêng theo tỉnh (province fixed/random effect) — chỉ 4 predictor (mùa vụ + 2 biến
  khí hậu) không đủ giải thích khác biệt cấu trúc giữa các tỉnh (đô thị hoá, mật độ dân, thực hành
  báo cáo y tế...). **Đây chính xác là lý do docs/02 chọn M1 là "GLM NegBin **phân cấp**" (hierarchical)
  cho Phase 2** thay vì GLM đơn giản — kết quả B4 ở đây là bằng chứng thực nghiệm ủng hộ quyết định
  đó, không phải một bất ngờ khó hiểu.
- Độ lệch chuẩn (std) giữa các origin khá lớn so với trung bình (vd B3 h=6: 1.638 ± 0.954) — dấu hiệu
  dữ liệu SXH biến động mạnh theo năm, hoặc n_origins=8 còn ít để ước lượng ổn định. Không phải lỗi,
  nhưng cần lưu ý khi so sánh model ở Phase 2 (chênh lệch nhỏ giữa 2 model có thể không có ý nghĩa
  thống kê với std lớn thế này).

## Quyết định

- **Dùng B3 Climatology, không phải B2 Seasonal naive, làm mốc so sánh thực tế mạnh nhất** khi đánh
  giá model Phase 2 — B2 vẫn giữ vai trò "mốc chuẩn quy ước" theo docs/02 (MASE định nghĩa theo B2),
  nhưng nếu model Phase 2 thắng B2 mà vẫn thua B3 thì **chưa nên coi là thành công thật sự**.
- B4 (bản pooled) xác nhận hướng đi M1 = hierarchical GLM NegBin ở docs/02 là đúng — không cần thử
  lại bản GLM Poisson pooled ở Phase 2, đã có bằng chứng nó không đủ tốt.

## Việc tiếp theo

- [ ] `exp_002`: 4 model Tier 1 (GLM NegBin hierarchical, XGBoost, LightGBM, hhh4) — so cả với B2 (quy
      ước) lẫn B3 (mốc mạnh nhất thực tế)
- [ ] Khi có nguồn `real` mới (NSO cấp tỉnh hoặc Đường A) phủ ngoài 2010, chạy lại toàn bộ exp_001
      trên giai đoạn gần đây để xem baseline có còn đúng thứ hạng không (giả định B3 thắng có thể
      không giữ nguyên nếu khí hậu/đô thị hoá đổi nhiều so với 1994-2010)
