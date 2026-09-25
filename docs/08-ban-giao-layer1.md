# 08 — Bàn giao Layer 1 (dự báo) cho Minh Dương

> **Mục đích:** tổng kết đầy đủ những gì đã làm ở Layer 1, kết quả thật, những gì đã thử và **thất bại** (để không lặp lại), điểm yếu còn lại,
> và các hướng cải thiện **chưa thử** — để Minh Dương tiếp nhận, kiểm tra lại, và thử làm tốt hơn. Đọc kèm [Model Card](07-model-card.md)
> (con số + giới hạn) và [MODEL_ZOO_RESULTS.md](../ai-service/experiments/MODEL_ZOO_RESULTS.md) (bảng xếp hạng). Nhật ký từng bước:
> [PROGRESS_LOG.md](../PROGRESS_LOG.md). Cập nhật: 2026-09-25.

---

## 0. Đọc trong 5 phút

**Layer 1 làm gì:** dự báo số ca sốt xuất huyết/100k dân theo tháng cho **34 tỉnh**, ở **h = 1, 2, 3, 6 tháng**, và xác suất tháng dự báo **vượt P75
lịch sử của chính tỉnh đó** (cảnh báo).

**Bản hiện hành: M4-R2** = (M1 GLM NegBin + 2 × GBM[XGBoost+LightGBM])/3, định tuyến theo vùng (Bắc: scale-aware+Tweedie; Trung: chuẩn; Nam: pha 50% Climatology).

| Chỉ số (MASE, thấp = tốt; <1 = thắng seasonal-naive) | h=1 | h=2 | h=3 | h=6 |
|---|---|---|---|---|
| B3 Climatology (mốc mạnh nhất) | 0.522 | 0.757 | 1.069 | 1.638 |
| **M4-R2** | **0.404** | **0.625** | **0.851** | **1.394** |

Theo vùng: **Nam 0.72 · Trung 0.90 · Bắc 1.37 (thua naive)**. Cảnh báo: **ROC-AUC 0.758**, PR-AUC 0.646 (base 0.35), Recall@P0.8 = 0.30; **Nam ~0.60**.

> **⚠️ CẬP NHẬT 2026-09-26 (exp_016, đánh giá 6 mùa 2005–2010):** bảng trên là **mùa 2010 = mùa KHÓ NHẤT** (MASE gộp 0.820; các mùa khác 0.32–0.57, TB 0.515 ± 0.170).
> M4-R2 thắng B3 ở **6/6 mùa** (+22% TB, CI95 18–26%); cảnh báo ROC-AUC **0.809 ± 0.041** (3/6 mùa ≥ 0.83; 2010 tệ nhất 0.757). Miền Bắc thất bại chỉ ở 2 mùa dịch (2009, 2010),
> tốt ở 4 mùa còn lại; Nam chỉ hòa với B3. **Định tuyến vùng khái quát** (+6.9%, CI95 5.0–8.7%). Chi tiết: [exp_016 RESULTS](../ai-service/experiments/exp_016_multiseason/RESULTS.md).
> **Lưu ý nhiễm thiết kế:** mùa ≤2009 nằm trong cửa sổ đã dùng để chọn thiết kế → số tuyệt đối lạc quan (baseline B2/B3 không bị nhiễm).

**3 điều quan trọng nhất cần biết trước khi động vào:**
1. **~~Toàn bộ đánh giá nằm trong 1 mùa dịch~~ → ĐÃ CÓ khung nhiều mùa** (`app/forecast/multiseason.py`, exp_016; 6 mùa 2005–2010). **Mọi thí nghiệm mới PHẢI báo cáo theo từng mùa**, không chỉ mùa 2010
   (mùa khó nhất, dễ dẫn tới kết luận âm tính sai). Mùa ≤2009 nhiễm thiết kế — dùng để đo độ biến thiên và độ ổn định, không công bố như kết quả "chưa từng thấy".
2. **Đã thử rất nhiều hướng cải thiện điểm yếu (xem §5) — hầu hết thất bại.** Đừng lặp lại; tìm hướng KHÁC (dữ liệu mới, mô hình cấu trúc khác).
3. **Kỷ luật bắt buộc:** chọn bằng cửa sổ VALIDATION với quy tắc khai báo trước, outer chỉ để xác nhận (xem §3). Chúng ta đã suýt tự lừa mình nhiều lần khi nhìn kết quả outer.

---

## 1. Bản đồ mã nguồn (`ai-service/`)

| File | Vai trò |
|---|---|
| `app/data/build_panel.py` | Ghép panel v0.2.0 (ca bệnh + dân số + khí hậu + ONI). Chạy: `python -m app.data.build_panel` → `data/processed/v0.2.0/panel_monthly.parquet` (9.326 dòng). |
| `app/data/run_luong_a.py` | 1 lệnh tải+ghép toàn bộ nguồn ngoài (WorldPop, ERA5 qua CDS, ONI); idempotent, tự retry. |
| `app/data/adjacency.py` | Ma trận kề 34 tỉnh (từ `provinces.geojson`, `intersects`). |
| `app/forecast/splits.py` | `make_splits` rolling-origin + `assert_test_is_real_only` (test PHẢI 100% `real`). |
| `app/forecast/metrics.py` | MASE, MAE, RMSE, bias, Poisson deviance, PR-AUC, Recall@Precision, Brier, lead_time. |
| `app/forecast/features.py` | Đặc trưng **nhân quả** (mùa vụ, khí hậu lag/rolling, ca bệnh lag/đà tăng, ONI, chuẩn mùa vụ, quy mô tỉnh, không gian) + `impute_climate_causal`. |
| `app/forecast/backtest.py` | Dùng chung: nạp panel real-only + đặc trưng (`calendarize=True` cho lag đúng tháng lịch), `build_horizon_pairs` (chống rò rỉ), mẫu số MASE. |
| `app/forecast/models.py` | M1 (GLM NegBin), M2a/M2b (XGBoost/LightGBM, T1), `fit_predict_scale_aware`. |
| `app/forecast/models_r.py`, `r_env.py` | M3 hhh4 qua rpy2 (**chỉ thí nghiệm**, không dùng sản xuất; cần R 4.6 + Rtools45, package R cài vào `.rlibs/`). |
| `app/forecast/ensemble.py` | `combine_ensemble`, `validation_error_weights`, `route_by_group`. |
| **`app/forecast/m4.py`** | **M4-R2 sản xuất:** `predict_m4`, `predict_m4_many` (fit 1 lần, dự báo nhiều bản đầu vào), `assemble_m4`. |
| `app/forecast/alerting.py` | Bài toán B: ngưỡng P75 nhân quả, đuôi Poisson, Platt/Isotonic/Residual, ECE/reliability. |
| `app/forecast/multiseason.py` | **Khung đánh giá nhiều mùa:** `season_splits`, `cluster_bootstrap_ci`, `sign_test_pvalue` (6 test). |
| `app/forecast/alert_classifier.py` | Classifier cảnh báo trực tiếp (exp_012) dùng lại được (3 test). |
| `app/forecast/explain.py` | TreeSHAP chính xác (LightGBM `pred_contrib`, XGBoost `pred_contribs`), nhóm đặc trưng. |
| `experiments/exp_001…016/` | Mỗi thí nghiệm: `config.yaml`, `run.py` (+`analyze.py`), `RESULTS.md`, kết quả thô. **Đọc `RESULTS.md` là nhanh nhất.** |
| `notebooks/00–04` | Ingest/EDA/tuning (đã chạy). |
| `tests/` | **181 test** (`pytest -q`, ~20s; 148 thuộc thư viện Layer 1/dữ liệu, 33 thuộc hợp đồng `contracts/` và lớp `app/serving`): nhân quả đặc trưng, hồi quy các bug đã gặp, split, metric, model, ensemble, alerting, explain. |

**Cài đặt/chạy:** Python 3.13 (venv `ai-service/venv`), `pip install -r requirements.txt` (+ `optuna`, `rpy2` nếu chạy M3/tuning). `ruff check . && black --check . && pytest -q`
phải sạch trước khi commit (CI kiểm). Dữ liệu (`data/raw`, `data/interim`, `data/processed`) **không nằm trong git** — sinh lại bằng `run_luong_a`/`build_panel`
(ERA5 cần tài khoản CDS + chấp nhận licence dataset; **không commit khoá API**).

## 2. Dữ liệu (tóm tắt — chi tiết ở [01](01-chien-luoc-du-lieu.md), [data-sources/](data-sources/))

- 34 tỉnh sau sáp nhập (crosswalk từ 63 cũ). Vùng: **Bắc 15 · Trung 11 · Nam 8** (`data/external/province_metadata.csv`).
- Cột chính: `cases`, `incidence_per_100k`, `population`, `temp_mean`, `precip_total`, `humidity_mean`, `oni`, `data_source` (`real`/`estimated`).
- **Chỉ `real` (1994-02 → 2010-12) được dùng để huấn luyện VÀ đánh giá.** 2011–2025 cấp tỉnh chỉ là ước lượng (tổng quốc gia × tỉ trọng lịch sử) → loại. Hệ quả: 203 tháng/tỉnh,
  mô hình chưa thấy dữ liệu hiện đại.
- 5/34 tỉnh có 1–2 tháng thiếu giữa chuỗi (đã đo: ảnh hưởng ≤1%, xem exp_015).
- Miền Bắc: 89% quan sát < 1/100k, trung vị 0 (chuỗi thưa) — nguồn gốc nhiều khó khăn.

## 3. Giao thức đánh giá & QUY TẮC BẮT BUỘC

**Giao thức:** rolling-origin, cửa sổ mở rộng, **8 origin outer** (train_end 2009-11 → 2010-06), horizon {1,2,3,6}, embargo 1, độ trễ báo cáo D=1, **direct multi-horizon**
(mỗi horizon 1 model, đặc trưng neo tại origin). **Cửa sổ VALIDATION** riêng: 10 origin, dữ liệu ≤ 2008-12.

**Quy tắc (rút ra bằng máu — đừng phá):**
1. **Mọi lựa chọn (tham số, biến thể, quy tắc định tuyến, hiệu chỉnh) quyết định trên VALIDATION** bằng quy tắc **khai báo trước khi chạy**; outer chỉ để xác nhận. Đã có ≥3 lần
   validation và outer mâu thuẫn (exp_003, 008, 013) — chọn theo outer = overfit vào 1 mùa.
2. **Không đổi quy tắc sau khi thấy kết quả.** Nếu muốn thử ý mới, khai báo lại và chạy lại.
3. **Chống rò rỉ:** feature tại `t` chỉ dùng dữ liệu ≤ `t−D`; train chỉ dùng cặp (t, t+h) với cả hai ≤ train_end. Mỗi hàm đặc trưng mới **phải có test nhân quả** (mẫu: `_assert_causal` trong `tests/test_forecast/test_features.py`).
   *Đã bắt 1 rò rỉ thật (exp_002): lấy feature ở `target_month` thay vì `train_end` → MASE đẹp giả 0.35 thay vì 0.45.*
4. **"Kết quả đẹp bất thường phải nghi trước"** (docs/02 §10). Luôn kiểm sanity: số của hạng mục đã biết phải khớp tuyệt đối (mẫu: `verify_m4_equivalence.py`, `smoke.py`).
5. **Smoke test trên DỮ LIỆU THẬT** trước khi chạy dài — test tổng hợp không thấy lỗi dtype nullable, NaN lan truyền, cột trùng tên (đã gặp cả 3).
6. **MASE theo vùng phải dùng mẫu số riêng từng vùng** (mẫu số gộp che điểm yếu miền Bắc).
7. **GBM nhạy THỨ TỰ cột** (bagging): đổi thứ tự cột đổi dự báo tới ~6/100k. Cột mới luôn **nối cuối**.
8. Test set chỉ `real` (`assert_test_is_real_only`). Không dùng `estimated`/`imputed`/`simulated` làm target ở test.
9. **Báo cáo kết quả THEO TỪNG MÙA** (`season_splits` trong `app/forecast/multiseason.py`), kèm trung bình ± sd và số mùa thắng — đừng chỉ mùa 2010 (mùa khó nhất). Ghi rõ mùa ≤2009 nhiễm thiết kế nếu dùng để chọn.

## 4. Lịch sử thí nghiệm (đọc `experiments/exp_XXX/RESULTS.md` để biết chi tiết)

| Exp | Nội dung | Kết quả chính | Quyết định |
|---|---|---|---|
| 001 | 4 baseline | B3 Climatology mạnh nhất (0.522/1.64); B4 pooled tệ nhất (thiếu hiệu ứng tỉnh) | B3 là mốc thực tế |
| 002 | M1 GLM NegBin, M2a/b XGB/LGBM (T1) | **bắt rò rỉ thật**; sau sửa M2 thắng B3 khiêm tốn (2–14%) | M2 hướng đi |
| 003 | Optuna T2 (inner 5 rồi 15 origin) | **T2 không cải thiện** (XGB −1.8…−4.9%); hội tụ sạch nhưng không tổng quát → dịch chuyển phân phối theo thời gian | giữ T1 |
| 004 | M3 hhh4 (R) ± khí hậu | thua mọi model (h=6: 2.23); khí hậu chỉ giúp 0.4–7% | loại M3 |
| 005 | M4 ensemble E1/E2 | E1 (TB đơn giản) thắng đơn lẻ 3.9–8.0%; E2 (trọng số) không hơn | dùng E1 |
| 006 | Phân rã + LOPO | **Bắc 1.755 (>1)**, bias bùng dịch −15; LOPO chỉ +0.9% | phát hiện điểm yếu |
| 007 | Scale-aware (dự báo tỉ lệ so quy mô tỉnh) | chỉ thêm đặc trưng quy mô làm TỆ; phải dự báo tỉ lệ; định tuyến Bắc→V3 | M4-R |
| 008 | Đòn bẩy Tweedie/trọng số/pha B3 | Nam pha B3 −10% (tái lập); Bắc-Tweedie không tái lập; bùng dịch không sửa được | **M4-R2** |
| 009 | Đặc trưng không gian (láng giềng/toàn quốc) | tín hiệu có nhưng yếu (M4 −0.3%) | không dùng |
| 010 | Robustness | nhiễu 5% +1.7%; khuyết 20% +8.5% → **điền khuyết nhân quả về +0.5%** | điền khuyết bắt buộc |
| 011 | Cảnh báo suy từ hồi quy + hiệu chỉnh | Brier −25%, ROC 0.73; lead time 37% sự kiện | — |
| 012 | Classifier cảnh báo trực tiếp | ROC 0.758 (thắng validation) | dùng classifier |
| 013 | 3 đòn bẩy cảnh báo | không cái nào qua quy tắc | dừng |
| 014 | SHAP | 3 trụ: ca gần đây, chuẩn mùa vụ, khí hậu | — |
| 015 | Lag theo tháng lịch | ảnh hưởng ≤1% | dùng `calendarize=True` |
| 016 | **Đánh giá nhiều mùa (2005–2010)** + ablation định tuyến | **2010 là mùa khó nhất**; M4-R2 thắng B3 6/6 mùa (+22%, CI 18–26%); cảnh báo ROC 0.809±0.041; Bắc chỉ thất bại 2 mùa dịch; định tuyến khái quát (+6.9%) | headline cũ = kịch bản bi quan; dùng khung này từ giờ |

## 5. Đã thử và THẤT BẠI — đừng lặp lại (hoặc chỉ lặp với thay đổi có lý do)

> ⚠️ Các kết luận âm tính bên dưới được đo trên **mùa 2010 (mùa khó nhất)** — hãy kiểm lại bằng khung nhiều mùa trước khi bỏ hẳn.

| Hướng | Kết quả | Vì sao có thể thất bại |
|---|---|---|
| Tuning Optuna (5 & 15 origin inner) | không cải thiện outer | tham số tối ưu quá khứ ≠ tối ưu tương lai gần (dịch chuyển phân phối) |
| hhh4 (endemic-epidemic) | tệ nhất | không có tín hiệu khí hậu bất thường liên năm; climatology chỉ bắt mùa vụ |
| Thêm đặc trưng quy mô tỉnh (không đổi cách dự báo) | tệ hơn baseline | cây trên target tuyệt đối vẫn dự báo theo thang chung |
| Hiệu chỉnh isotonic cho bias bùng dịch | tệ hơn (0.93→1.06) | hiệu chỉnh ở giai đoạn ≤2008 không chuyển sang 2009–10 |
| Trọng số mẫu 3× cho bùng dịch | giảm bias nhưng h=1 +11%, Bắc +21% | đánh đổi, không cải thiện thực |
| Tweedie cho Bắc | −44% validation nhưng KHÔNG tái lập outer | winner's curse (validation 10 origin) |
| Đặc trưng không gian | +0.3% M4, ROC không đổi | tín hiệu yếu ở độ phân giải tháng |
| Classifier: model chung mọi horizon, đặc trưng không gian, TB hạng với điểm hồi quy | không qua quy tắc | ROC ~0.76 là trần với dữ liệu/đặc trưng này |
| E2 (trọng số ensemble theo validation) | không hơn E1 | trọng số ước lượng ở giai đoạn khác |

## 6. Điểm yếu còn lại (xếp theo mức quan trọng với sản phẩm)

> Các số dưới đây là **mùa 2010 (khó nhất)**; xem exp_016 cho biến thiên giữa 6 mùa (ví dụ Bắc: 0.34–0.40 ở 4 mùa, 2.40 và 1.34 ở 2 mùa dịch; ROC-AUC cảnh báo 0.757–0.857).

| # | Điểm yếu | Số đo hiện tại | Nghi vấn nguyên nhân |
|---|---|---|---|
| 1 | **Bùng dịch bị dự báo thấp** | bias ≈ −15.5/100k; MASE bùng dịch 2.5 vs 0.5; 38.7% ca bùng dịch bị dự báo < 50% thực tế (M4-E1) | hồi quy về trung bình; đặc trưng không có tín hiệu SỚM của bùng phát đột ngột |
| 2 | **Cảnh báo dưới mốc** | ROC-AUC 0.76 (D-MOSS 0.83–0.94); Recall@P0.8 = 0.30; lead time 37% sự kiện | phân biệt yếu; 1 mùa; độ phân giải tháng |
| 3 | **Miền Bắc** | MASE 1.37 (>1); 89% quan sát < 1/100k | chuỗi thưa/zero-inflated; model Poisson-GBM dự báo dương sàn quá cao |
| 4 | **Miền Nam khi phân loại** | ROC-AUC 0.60 (dù MASE tốt nhất 0.72) | endemic ổn định, tín hiệu vượt P75 nhiễu |
| 5 | **h=6** | MASE 1.39 (>1) | khó nội tại; chỉ dựa mùa vụ + lag xa |
| 6 | **Độ tin cậy thống kê** | 1 mùa, chưa có khoảng tin cậy | thiết kế đánh giá |

## 7. Ý tưởng CHƯA thử (xếp theo giá trị kỳ vọng / chi phí) — chỗ Minh Dương có thể tạo khác biệt

1. ✅ **ĐÃ LÀM — Đánh giá nhiều mùa (exp_016).** Kết quả: xem đầu tài liệu và [RESULTS](../ai-service/experiments/exp_016_multiseason/RESULTS.md). **Việc còn lại từ ý tưởng này:**
   (a) **chạy lại các đòn bẩy âm tính** (tuning T2, đòn bẩy cảnh báo, đặc trưng không gian) trên khung nhiều mùa — chúng bị đánh giá trên mùa khó nhất nên kết luận "không cải thiện" chưa chắc đúng ở mọi mùa;
   (b) bootstrap theo khối/mùa thay vì theo origin; (c) phân tích **vì sao "năm dịch bất thường" (Bắc 2009) làm cả model lẫn B3 thất bại** — có thể là điểm cải thiện giá trị nhất.
2. **Dữ liệu mới** (tác động lớn nhất tới kết quả thật): ca theo TUẦN (ưu tiên số 1 cho bùng dịch/lead time), dữ liệu real sau 2010 (NSO cấp tỉnh/HCDC — thêm mùa dịch, kiểm chứng hiện đại), chỉ số muỗi (Breteau/HI). Cần quyền truy cập — chưa có.
3. **Dự báo phân phối (probabilistic):** quantile GBM / conformal / NegBin phân cấp cho **khoảng dự báo** và đuôi bùng dịch; cảnh báo suy từ phân phối đó thay cho hồi quy điểm + hiệu chỉnh. Có thể giải quyết trực tiếp #1 và #2 (đuôi phải), chưa thử.
4. **Mô hình hai giai đoạn (hurdle/zero-inflated) cho miền Bắc:** P(có ca) × E[ca | có ca]. Chuỗi thưa hợp cấu trúc này hơn Poisson-GBM; nhắm thẳng #3.
5. **M1 phân cấp thật** (random effect, partial pooling — `glmmTMB` R hoặc PyMC): hiện là fixed-effect; partial pooling có thể giúp tỉnh thưa (Bắc) và cho phép dự báo tỉnh lạ (LOPO cho M1). docs/02 chọn hướng này từ đầu, chưa làm.
6. **Ablation/lựa chọn đặc trưng:** mới dùng 17/~50 cột; chưa thử lag khí hậu 3–6, rolling 6 tháng, độ ẩm lag, ONI lag khác, đặc trưng "tích luỹ mưa" theo tuần sinh học muỗi; chưa ablation từng nhóm (exp_002 "việc tiếp theo" vẫn mở).
7. **Stacking E3 (Ridge trên dự báo OOF)** và **ensemble theo chế độ E4** (docs/02 §7) — mới có E1/E2 và định tuyến theo vùng.
8. **Sửa lỗi thiết kế nhỏ:** M1 lỗi hội tụ ở ~2–3/32 fold outer (bỏ M1 ở fold đó); thử ổn định số học tốt hơn hoặc thay M1.
9. **Mô hình chuỗi thời gian sâu (TFT/N-BEATS)**: docs/02 chọn ML cổ điển vì quy mô dữ liệu (34×203) — chỉ thử nếu có dữ liệu tuần (~4× điểm).

## 8. Cách thử một ý tưởng mới (quy trình khuyến nghị)

1. Tạo `experiments/exp_0XX_ten/` với `config.yaml` (khai báo **biến thể + quy tắc chấp nhận** trước), `run.py`, `analyze.py`. Dùng `app/forecast/backtest.py` (đừng copy lại).
2. **Sanity đầu tiên:** biến thể control phải khớp số đã công bố (sai lệch 0.0) — chứng minh harness đúng.
3. Chạy validation (10 origin ≤2008-12) → áp quy tắc → mới xem outer → **rồi chạy khung nhiều mùa (exp_016) để biết kết quả có ổn định giữa các năm không**. Ghi CẢ kết quả âm tính vào `RESULTS.md` (mục "Điều bất ngờ / nghi vấn").
4. Nếu được nhận: đưa vào `app/` (có test) + `verify_*` khớp tuyệt đối với experiment + cập nhật `MODEL_ZOO_RESULTS.md`, `PROGRESS_LOG.md`, `docs/07-model-card.md`.
5. Việc chạy dài (>~10 phút): chạy nền `python -u ...`, hoặc đóng gói notebook như `04_tune_m2.ipynb` (có sleep-guard + checkpoint). Nhớ **restart kernel** khi sửa `run.py`.
6. Commit: người dùng tự chạy `git`; không thêm dòng đồng tác giả của công cụ.

## 9. Câu hỏi mở cần trả lời để cải thiện thật

- Có cách nào lấy **ca theo tuần / cấp tỉnh sau 2010** (HCDC, NSO)? Đây là điều kiện để cải thiện #1, #2 một cách chắc chắn.
- Ngưỡng cảnh báo P75 theo tháng có phải định nghĩa nghiệp vụ đúng của đề án (`ProbExceed75th`), hay nên dùng định nghĩa khác (vd vượt kênh nội sinh P90, hoặc tỉ lệ tăng)? Định nghĩa quyết định độ khó (29% quan sát có ngưỡng = 0).
- Yêu cầu vận hành chính thức: precision/recall tối thiểu bao nhiêu thì cảnh báo dùng được? Hiện chưa đạt "precision 0.8 ở recall hữu ích".

## 10. Phụ lục — tham số cần nhớ

- **T1 mặc định (XGBoost & LightGBM):** `n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8`; objective Poisson; seed 42.
- **17 đặc trưng T1:** `sin_month, cos_month, temp_mean_lag_1/2, precip_total_lag_1/2, humidity_mean_lag_1, temp_mean_roll_mean_3, precip_total_roll_mean_3, incidence_per_100k_lag_2/3, momentum, acceleration, oni_lag_3/6, incidence_per_100k_same_month_last_year, incidence_per_100k_deviation_from_median`.
- **M4-R2:** (M1 + 2·GBM)/3; Bắc: scale-aware (`prov_mean_hist`+1 làm quy mô, dự báo tỉ lệ) + Tweedie(1.5); Nam: 0.5·GBM + 0.5·Climatology; Trung: GBM chuẩn.
- **Cảnh báo:** nhãn = y(t+h) > P75 mở rộng nhân quả cùng tháng dương lịch; classifier XGB(`binary:logistic`)+LGBM(`binary`); hiệu chỉnh isotonic trực tuyến (chỉ kết quả đã trưởng thành).
- **Điền khuyết:** trung bình cùng tháng dương lịch các năm trước (`impute_climate_causal`).
