# Model zoo — bảng xếp hạng tổng hợp

> **Nguồn sự thật duy nhất** cho kết quả so sánh model. Chi tiết đầy đủ (thiết lập, bug gặp phải, chẩn
> đoán điều bất ngờ) nằm ở `RESULTS.md` của từng experiment — file này chỉ gộp lại số cuối cùng để
> không phải lục 4 file mỗi lần cần so sánh. **Cập nhật file này mỗi khi có experiment mới** (M4
> ensemble, M3 bản có khí hậu, ...) — thêm 1 hàng vào bảng + 1 dòng vào `plot_leaderboard.py::RESULTS`
> rồi chạy lại `python experiments/plot_leaderboard.py`.

- **Data version:** panel v0.2.0 (`ai-service/data/processed/v0.2.0/panel_monthly.parquet`)
- **Giao thức chung (mọi experiment dưới đây dùng y hệt):** rolling-origin mở rộng, **8 origin**
  (`train_end` 2009-11 → 2010-06), horizon **{1, 2, 3, 6} tháng**, `embargo_months=1`,
  `reporting_delay_months=1`, tập test **100% `data_source=="real"`** (`assert_test_is_real_only()`),
  metric chính **MASE** (mẫu số = sai số seasonal-naive trên phần train của từng origin).
- **Cập nhật lần cuối:** 2026-09-23 (sau exp_004)

## Biểu đồ

![So sánh MASE các model theo horizon](leaderboard_mase.png)

_(sinh bằng `python experiments/plot_leaderboard.py`, xem file đó để sửa số liệu/style)_

## Bảng đầy đủ

| # | Model | Tier | h=1 | h=2 | h=3 | h=6 | Nguồn |
|---|---|---|---|---|---|---|---|
| B1 | Persistence | 0 (baseline) | 0.758 | 1.196 | 1.620 | 2.164 | [exp_001](exp_001_baselines/RESULTS.md) |
| B2 | Seasonal naive ⭐ mốc quy ước | 0 (baseline) | 0.739 | 1.028 | 1.399 | 1.998 | [exp_001](exp_001_baselines/RESULTS.md) |
| B3 | Climatology ⭐ mốc thực tế mạnh nhất | 0 (baseline) | 0.522 | 0.757 | 1.069 | 1.638 | [exp_001](exp_001_baselines/RESULTS.md) |
| B4 | GLM Poisson (pooled) | 0 (baseline) | 0.943 | 1.333 | 1.768 | 2.367 | [exp_001](exp_001_baselines/RESULTS.md) |
| M1 | GLM NegBin (fixed-effect theo tỉnh) | 1 (T1 default) | 0.497 | 0.736 | 1.138 | 1.644 | [exp_002](exp_002_model_zoo_tier1/RESULTS.md) |
| M2a | XGBoost | 1 (T1 default) | 0.449 | 0.698 | 0.963 | 1.611 | [exp_002](exp_002_model_zoo_tier1/RESULTS.md) |
| M2b | **LightGBM 🏆 tốt nhất hiện tại** | 1 (T1 default) | **0.447** | **0.694** | **1.001** | **1.608** | [exp_002](exp_002_model_zoo_tier1/RESULTS.md) |
| M3 | hhh4 (endemic-epidemic, R/surveillance) | 1 (T1, thiếu khí hậu) | 0.544 | 1.038 | 1.527 | 2.406 | [exp_004](exp_004_m3_hhh4/RESULTS.md) |
| — | M2a XGBoost, **T2 tuned (100 trial)** | 2 (tuning) | — | — | — | — | outer trung bình gộp 0.9764 (TỆ HƠN T1's 0.9304, −4.9%) — [exp_003](exp_003_tuning_m2/RESULTS.md) |
| — | M2b LightGBM, **T2 tuned (100 trial)** | 2 (tuning) | — | — | — | — | outer trung bình gộp 0.9368 (≈T1's 0.9374, +0.1%) — [exp_003](exp_003_tuning_m2/RESULTS.md) |

_(std qua 8 origin và MAE chi tiết: xem `results.json` trong từng thư mục experiment)_

## Đọc nhanh

1. **M2b LightGBM (T1 mặc định) đang là model tốt nhất** ở mọi horizon, nhưng thắng B3 khiêm tốn
   (2-14%, không áp đảo) — đúng như kỳ vọng thực tế cho quy mô dữ liệu 34 chuỗi × ~200 tháng.
2. **T2 tuning (Optuna 100 trial) không cải thiện được gì** — XGBoost sau tuning còn tệ hơn, LightGBM
   không đổi. Nguyên nhân: cửa sổ inner tuning (5 origin) quá nhỏ để dẫn đường tin cậy cho không gian
   tìm kiếm 7 chiều. **Quyết định: dùng T1 default cho M4 ensemble, không dùng tham số đã tune.**
3. **M3 hhh4 thua mọi model khác ở h≥2**, kể cả 2 baseline — vì đây là model DUY NHẤT không dùng thông
   tin khí hậu (chỉ AR + lan truyền không gian + mùa vụ thuần), trong khi khí hậu là tín hiệu mạnh nhất
   đo được (EDA: nhiệt độ lag 2 tháng r=0.565). **Quyết định: loại M3 khỏi M4 ensemble ở cấu hình hiện
   tại** — việc tiếp theo (chưa làm) là thêm covariate khí hậu vào `end$f`.
4. **Không model nào đạt ngưỡng promote G1** (docs/02 §10: MASE<0.90 ở CẢ h=1 và h=3) — M2b đạt h=1
   (0.447<0.90 ✅) nhưng không đạt h=3 (1.001>0.90 ❌). Kỳ vọng thực tế cho vòng model zoo đầu tiên,
   chưa đáng lo.

## Trạng thái model zoo (docs/02 §3)

| Model | Trạng thái |
|---|---|
| B1-B4 (Tier 0) | ✅ Xong — exp_001 |
| M1 GLM NegBin | ✅ Xong (T1) — exp_002. Không tune thêm (thua M2 mọi horizon) |
| M2a/M2b XGBoost/LightGBM | ✅ Xong (T1 + T2) — exp_002, exp_003. T1 default là bản dùng |
| M3 hhh4 | ✅ Xong (T1, chưa có khí hậu) — exp_004. Loại khỏi M4 ở bản hiện tại |
| M4 Ensemble | ⬜ Chưa làm — dự kiến M1 + M2a + M2b (T1 default), bỏ M3 |

## Việc tiếp theo (ưu tiên theo thứ tự)

- [ ] **M4 Ensemble** — M1 + M2a + M2b (T1 default), thử E1 (trung bình đơn giản) trước, E2 (trọng số
      theo sai số validation) sau nếu có thời gian.
- [ ] Thêm covariate khí hậu vào `hhh4`'s `end$f` (và có thể `ar$f`) — nếu M3 vẫn thua M2 sau đó, mới
      là bằng chứng chắc chắn cho thấy thành phần lan truyền không gian không thêm giá trị ở quy mô
      dữ liệu này.
- [ ] LOPO (leave-one-province-out) cross-validation, robustness test (nhiễu khí hậu, dữ liệu thiếu),
      hiệu chỉnh xác suất (Platt/Isotonic), SHAP, model card — theo docs/02 protocol đầy đủ, chưa bắt
      đầu.
