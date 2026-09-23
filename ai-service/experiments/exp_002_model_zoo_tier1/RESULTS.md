# exp_002 — Model zoo Tier 1 (T1, cấu hình mặc định)

- **Ngày chạy:** 2026-09-23
- **Commit:** 940ab77 (trước khi commit các file của exp_002)
- **Data version:** panel v0.2.0
- **Lệnh chạy:** `python experiments/exp_002_model_zoo_tier1/run.py` (từ `ai-service/`)

> Xem [MODEL_ZOO_RESULTS.md](../MODEL_ZOO_RESULTS.md) cho bảng xếp hạng tổng hợp (mọi experiment, có biểu đồ).

## Câu hỏi

3 model Tier 1 thuần Python (M1 GLM NegBin hiệu ứng tỉnh, M2a XGBoost, M2b LightGBM) ở cấu hình
**mặc định** (chưa tuning) có thắng nổi baseline mạnh nhất (B3 Climatology, xem exp_001) không? Model
nào đáng đầu tư tuning tiếp?

## Thiết lập

- Giao thức **giống hệt exp_001**: real-only (1994-2010), rolling-origin 8 origin, `embargo_months=1`,
  horizon `{1,2,3,6}`.
- **Đặc trưng (T1 mặc định, 17 cột)** — không dùng hết ~50 cột `build_feature_matrix()` sinh ra, chọn
  đại diện mỗi nhóm theo đúng phát hiện EDA thật (không đoán): mùa vụ (sin/cos), khí hậu lag 1-2 tháng
  + rolling 3 tháng, lịch sử dịch lag 2-3, động lượng (momentum/acceleration), ONI lag 3/6, chuẩn mùa
  vụ (same-month-last-year, deviation-from-median). Danh sách đầy đủ: `config.yaml`.
- **M1 GLM NegBin:** hiệu ứng CỐ ĐỊNH theo tỉnh (`C(province_id)`), KHÔNG PHẢI phân cấp/random-effect
  đúng nghĩa — xem giới hạn trong `app/forecast/models.py` docstring.
- **M2a/M2b:** XGBoost/LightGBM, `objective` Poisson, `n_estimators=300, max_depth=4,
  learning_rate=0.05` — cấu hình mặc định hợp lý (T1), CHƯA tuning (T2 là bước sau).

## Kết quả

### MASE trung bình qua 8 origin (so với B2/B3 từ exp_001)

| Model | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| B2 Seasonal naive (exp_001) | 0.739 | 1.028 | 1.399 | 1.998 |
| B3 Climatology (exp_001, mốc mạnh nhất) | 0.522 | 0.757 | 1.069 | 1.638 |
| M1 GLM NegBin | 0.497 | 0.736 | 1.138 | 1.644 |
| **M2a XGBoost** | **0.449** | **0.698** | **0.963** | **1.611** |
| M2b LightGBM | 0.447 | 0.694 | 1.001 | 1.608 |

(std qua origin, MAE chi tiết theo từng origin/horizon: `results.json`)

### Thắng/thua so với B3 (mốc thực tế mạnh nhất)

| Model | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| M1 | ✅ thắng (0.497<0.522) | ✅ thắng (0.736<0.757) | ❌ **thua** (1.138>1.069) | ❌ thua sát nút (1.644 vs 1.638) |
| M2a | ✅ thắng | ✅ thắng | ✅ thắng | ✅ thắng sát nút |
| M2b | ✅ thắng | ✅ thắng | ✅ thắng | ✅ thắng sát nút |

## Nhận định

- **M2a/M2b (gradient boosting) thắng B3 ở MỌI horizon**, dù mức thắng khá khiêm tốn (~2-14%, không
  phải thắng áp đảo) — đúng như kỳ vọng thực tế cho vòng T1 mặc định trên dữ liệu 34 chuỗi × ~200
  tháng (ít dữ liệu theo chuẩn ML).
- **M1 (GLM NegBin fixed-effect) thắng B3 ở h=1,2 nhưng THUA ở h=3,6** — hợp lý: model tuyến tính đơn
  giản khó nắm phi tuyến ở horizon xa, trong khi B3 (trung bình lịch sử) càng xa càng ổn định.
- Không model nào thắng ÁP ĐẢO — khớp với cảnh báo docs/02 §10: nếu MASE < 0.5 ở mọi horizon mới đáng
  nghi rò rỉ. Kết quả khiêm tốn, tăng dần độ khó theo horizon — đúng hình dạng kỳ vọng.

## Điều bất ngờ / nghi vấn ⭐ (mục quan trọng nhất — có rò rỉ thật, đã sửa)

**Lần chạy ĐẦU TIÊN** (trước khi phát hiện lỗi) cho kết quả **đáng ngờ tốt**: M2a MASE h=1..6 =
`0.352, 0.436, 0.520, 0.796` — thắng B3 áp đảo ở MỌI horizon, kể cả h=6 (0.796 so với B3's 1.638, gần
gấp đôi). Theo đúng nguyên tắc docs/02 §10 ("kết quả vượt xa mốc tài liệu → nghi rò rỉ trước khi ăn
mừng"), đã dừng lại điều tra thay vì báo cáo luôn.

**Nguyên nhân xác định được — rò rỉ tương lai thật, không phải false alarm:** `features.py` sinh các
cột lag/momentum/... GẮN VỚI THÁNG CỦA CHÍNH DÒNG ĐÓ (đúng cho mục đích nhân quả nói chung — dòng
nào cũng chỉ nhìn về quá khứ của chính nó). Nhưng bản chạy đầu lấy THẲNG feature của dòng tại
`target_month` (=`train_end+h`) để làm input dự báo. Với `incidence_per_100k_lag_2` (dịch tễ lag
2 tháng): tại `target_month`, giá trị này đọc dữ liệu ở `target_month−2 = train_end+h−2`. Với h=1:
`train_end−1` (quá khứ, OK). Với **h=3: `train_end+1`** — **1 THÁNG SAU `train_end`**. Với **h=6:
`train_end+4`** — **4 THÁNG SAU `train_end`**. Model được "biết trước" một phần tương lai gần khi dự
báo xa — giải thích chính xác vì sao bản lỗi thắng đậm nhất đúng ở horizon xa (h=6), chỗ lẽ ra phải
khó nhất.

**Đã kiểm chứng bằng số học tay** (không chỉ suy luận): in ra tháng nguồn dữ liệu của `lag_2` tại mỗi
horizon so với `train_end`, xác nhận đúng độ lệch 0/1/1/4 tháng cho h=1/2/3/6.

**Cách sửa:** viết lại hoàn toàn phần chuẩn bị dữ liệu — ghép cặp `(X tại t, y THẬT tại t+h)` cho MỌI
mốc lịch sử `t` (dùng làm train) và cho chính origin đang xét (`t=train_end`, dùng làm test) — feature
LUÔN đọc tại đúng 1 mốc thời gian cố định (`t`), không bao giờ đọc xa hơn. Sau khi sửa, MASE tăng lên
đúng mức hợp lý (0.449→1.611 thay vì 0.352→0.796) — **kết quả khiêm tốn hơn nhưng đáng tin**.

**Bài học quy trình:** đây là minh chứng trực tiếp cho nguyên tắc "điều bất ngờ thường là bug, không
phải may mắn" (docs/03 §4) — nếu không dừng lại kiểm tra vì "số đẹp quá", kết quả rò rỉ này đã có thể
bị báo cáo như một thành công thật.

## Hạn chế đã biết

- M1 thất bại hội tụ ở 2/32 tổ hợp origin×horizon (`h=2`, 2 origin) — lỗi `NaN, inf or invalid value
  in weights`, không điều tra sâu thêm (M1 dù sao cũng đã thua M2 rõ rệt, không phải hướng ưu tiên).
- M1 là fixed-effect, không phải hierarchical/random-effect thật — xem `models.py` docstring.
- Đặc trưng "khí hậu của tháng dự báo" chưa dùng ở đây (khác B4 exp_001) — M1/M2 chỉ dùng khí hậu ĐÃ
  BIẾT tại `train_end` (lag 1-2 tháng), không "nhìn trước" khí hậu tương lai — đây là thiết kế ĐÚNG
  cho model sẽ triển khai thật (khác B4 vốn chỉ là baseline tham chiếu).

## Quyết định

- **M2 (gradient boosting) là hướng đáng đầu tư tuning (T2)** — thắng nhất quán dù khiêm tốn.
- **Không tune M1** — thua M2 ở mọi horizon, và bản chất fixed-effect đã biết là xấp xỉ thô của
  hierarchical thật; nếu muốn thử hướng thống kê/Bayes sâu hơn, nên đầu tư thẳng vào bản hierarchical
  qua R (`glmmTMB`) khi có, không tune thêm bản fixed-effect này.
- Baseline B3 vẫn là mốc quan trọng cần thắng RÕ RỆT (không chỉ sát nút) trước khi promote bất kỳ
  model nào — hiện M2 mới thắng khiêm tốn, chưa đạt ngưỡng G1 promote (docs/02 §10: MASE<0.90 ở h=1
  VÀ h=3 — M2a đạt cả 2: 0.449<0.90 ✅, 0.963<0.90 ❌ chưa đạt ở h=3).

## Việc tiếp theo

- [ ] `exp_003`: Optuna T2 tuning cho M2a/M2b (100 trial) — ứng viên cho notebook chạy trên máy có GPU
- [ ] M3 hhh4 (cần R + rpy2 — đang chờ cài R)
- [ ] M4 Ensemble (M1+M2a+M2b, sau khi có M3)
- [ ] Ablation feature: thử bỏ nhóm "chuẩn mùa vụ" (same_month_last_year/deviation_from_median) xem
      có phải nhóm đóng góp chính không, hay chỉ 1-2 climate lag đã đủ
