# Nhật ký tiến độ

> File này ghi lại **mỗi việc thật đã làm xong** (không phải kế hoạch — kế hoạch xem
> [PHASE-1-CHECKLIST.md](PHASE-1-CHECKLIST.md)/[ROADMAP.md](ROADMAP.md)). Mới nhất ở trên cùng. Mỗi
> mục ghi: làm gì, verify bằng cách nào, số liệu thật ra sao, file nào đổi.
>
> **Bảng xếp hạng model tổng hợp** (số MASE mới nhất, mọi experiment gộp 1 chỗ, có biểu đồ):
> [ai-service/experiments/MODEL_ZOO_RESULTS.md](ai-service/experiments/MODEL_ZOO_RESULTS.md).

---

## 2026-09-24 — exp_006: phân rã M4 (§4.2) + LOPO (§4.3) — lộ điểm yếu thật: thua seasonal-naive ở miền Bắc, dự báo thấp khi bùng dịch

**Làm:** `app/forecast/backtest.py` (helper dùng chung cho experiment mới: nạp panel + đặc trưng, ghép cặp
neo tại origin, mẫu số MASE, dự báo 3 model; 3 test) + `experiments/exp_006_lopo_breakdown/` (run.py lưu
dự báo từng tỉnh, analyze.py, RESULTS.md, analysis_output.txt). Sanity: E1/M2b khớp chính xác exp_005.
Lỗi gặp: XGBoost trả float32 → không ghi JSON được (mất ~5 phút chạy lại), sửa ép kiểu float.

**Kết quả chính:**
- MASE theo vùng (mẫu số riêng từng vùng): M4 Bắc **1.755** (thua seasonal-naive), Trung 0.904, Nam 0.800. Con
  số gộp ~0.9 che điểm yếu miền Bắc — chỉ lộ khi tách mẫu số theo vùng.
- Tháng bùng dịch: MASE 2.555 vs 0.503 tháng thường; bias −15.1 ca/100k; 38.7% quan sát bùng dịch bị dự báo
  thấp hơn thực tế >50%. Ensemble vẫn giảm sai số bùng dịch 14% so với M2b đơn.
- LOPO (ensemble GBM, M1 không tham gia được): +0.9% gộp (h=1 +5%, h≥2 ≈ 0); 9/34 tỉnh còn tốt hơn standard.

**Ý nghĩa:** không được mô tả M4 là "tốt toàn quốc"; cần ghi rõ vào model card, và cảnh báo nên hiệu chỉnh cho
bias âm khi bùng dịch. Luận điểm nhân rộng sang tỉnh mới được ủng hộ (kèm điều kiện có lịch sử địa phương).

**File:** `ai-service/app/forecast/backtest.py`, `ai-service/tests/test_forecast/test_backtest.py`,
`ai-service/experiments/exp_006_lopo_breakdown/`, `ai-service/experiments/MODEL_ZOO_RESULTS.md`

---

## 2026-09-24 — exp_005: M4 Ensemble xong — kết quả DƯƠNG TÍNH đầu tiên, E1 (trung bình đơn giản) thắng

**Làm:** `app/forecast/ensemble.py` (`combine_ensemble`, `validation_error_weights`, 6 unit test) +
`experiments/exp_005_m4_ensemble/`. Thành viên M1+M2a+M2b (T1 default, bỏ M3 và bỏ tham số T2 theo các
quyết định trước). E2 ước lượng trọng số trên cửa sổ validation riêng (10 origin, ≤2008-12), không dùng
outer.

**Kết quả (outer MASE, 8 origin):** E1 = 0.429 / 0.671 / 0.898 / 1.479 (h=1/2/3/6) vs model đơn lẻ tốt
nhất 0.447 / 0.694 / 0.963 / 1.609 → cải thiện 3.9 / 3.3 / 6.8 / 8.0%, vượt ngưỡng ≥3% docs/02 §7 ở cả
4 horizon; thắng 21/32 fold vs M2b, 27/32 vs M2a. E2 kém hơn E1 ở mọi horizon → chọn E1.
**E1 đạt G1** (MASE<0.90 ở h=1 và h=3), h=3 sát ngưỡng (0.8975).

**Kiểm tra nghi vấn:** MASE của M1/M2a/M2b khớp chính xác exp_002 (harness đúng); tái lập y hệt sau
refactor; quy mô cải thiện bình thường cho ensemble, khớp khảo sát docs/02.

**File:** `ai-service/app/forecast/ensemble.py`, `ai-service/tests/test_forecast/test_ensemble.py`,
`ai-service/experiments/exp_005_m4_ensemble/`, `ai-service/experiments/{MODEL_ZOO_RESULTS.md,
plot_leaderboard.py,leaderboard_mase.png}`

---

## 2026-09-24 — T2 tuning kiểm chứng lại xong (inner=15 origin): kết luận "T1 default thắng" vững hơn, không phải chỉ do thiếu dữ liệu tuning

**Làm:** Chạy lại `notebooks/04_tune_m2.ipynb` với `INNER_N_ORIGINS=15` (tăng từ 5) sau 2 lần thất bại
vận hành (không liên quan tới code): lần 1 dùng nhầm kernel Jupyter cũ còn cache `run.py` bản chưa
sửa → phát hiện qua số liệu trùng khớp tuyệt đối với bản inner=5, không báo cáo nhầm; lần 2 máy tự
sleep giữa chừng làm mất 69 phút XGBoost đã tính xong (kernel chết, không cứu được biến trong bộ nhớ).
Đã sửa cả 2: thêm `SetThreadExecutionState` (chặn Windows tự sleep) + 2 cell checkpoint lưu ngay sau
mỗi model tune xong. Lần chạy thứ 3 thành công trọn vẹn.

**Kết quả (outer MASE, so T1 default vs T2 tuned):**

| Model | T1 default | T2 (inner=5, cũ) | T2 (inner=15, mới) |
|---|---|---|---|
| M2a XGBoost | 0.9304 | 0.9764 (-4.9%) | 0.9470 (-1.8%) |
| M2b LightGBM | 0.9374 | 0.9368 (+0.1%) | 0.9408 (-0.4%) |

**Phát hiện quan trọng:** đường hội tụ inner của XGBoost NAY ĐÃ PHẲNG (trước đó ở inner=5 vẫn đang
giảm tới tận trial 100, chưa hội tụ) — xác nhận đúng giả thuyết "inner=5 quá nhỏ" cho việc TÌM tham
số. Nhưng dù đã hội tụ sạch, **outer vẫn KHÔNG cải thiện** — cả 2 model vẫn tệ hơn T1 default. Kết
luận cập nhật: nguyên nhân không phải (chỉ) thiếu dữ liệu tuning, mà là **dịch chuyển phân phối theo
thời gian** giữa giai đoạn tuning (≤2008-12) và giai đoạn đánh giá (2009-11..2010-06) — tham số tối ưu
cho quá khứ không nhất thiết tối ưu cho tương lai gần, đúng với đặc điểm SXH biến động mạnh theo năm
đã thấy ở exp_001.

**Quyết định (vững, đã kiểm chứng 2 lần độc lập):** giữ T1 default cho M2a/M2b trong M4 Ensemble.

**File:** `ai-service/notebooks/04_tune_m2.ipynb` (thêm sleep-guard + checkpoint),
`ai-service/experiments/exp_003_tuning_m2/{RESULTS.md,results_trials100.json,checkpoint_*.json}`,
`ai-service/experiments/MODEL_ZOO_RESULTS.md`

---

## 2026-09-23 — Cải thiện thật 2 kết quả âm tính: M3 +khí hậu (cải thiện khiêm tốn), T2 tuning inner mở rộng (đang chờ chạy)

**Bối cảnh:** sau khi dọn báo cáo cho đẹp (mục dưới), user muốn KẾT QUẢ THẬT tốt hơn trước khi làm
tiếp, không chỉ trình bày đẹp. Quay lại đúng 2 "việc tiếp theo" đã ghi ở exp_003/exp_004.

**M3 hhh4 — thêm covariate khí hậu (climatology theo tỉnh), đã chạy xong thật:**
- Sửa `app/forecast/models_r.py::fit_hhh4()` — thêm tham số `climate_cols`, tự tính climatology
  (trung bình lịch sử theo tỉnh × tháng dương lịch, CHỈ từ dữ liệu `<= train_end`) và wire vào
  `end$f` + `control$data` của hhh4 qua rpy2. **Cố ý KHÔNG dùng khí hậu thực đo** — vì
  `simulate.hhh4()` mô phỏng tiến vào tương lai, dùng khí hậu thực đo ở các bước tương lai sẽ là
  đúng lớp lỗi rò rỉ đã bắt được ở exp_002. Thêm 1 regression test xác nhận dự báo có/không khí hậu
  khác nhau thật (không phải covariate bị bỏ qua).
- Chạy lại exp_004 (cả 2 biến thể, cùng 8 origin, so sánh công bằng): thêm khí hậu cải thiện MASE
  **thật, đều đặn, tăng dần theo horizon** (h=1: -0.4%, h=6: -7.2%) — nhưng **vẫn chưa đủ**: M3 v2
  (2.232 ở h=6) vẫn thua cả B1 Persistence (2.164), kém xa M1/M2/B3 (1.6-1.6).
- **Chẩn đoán mới (điều bất ngờ thật sự):** climatology chỉ bắt mùa vụ trung bình nhiều năm, KHÔNG
  bắt được bất thường khí hậu LIÊN NĂM mà M1/M2's khí hậu lag thực đo có — đây mới là phần thiếu thật
  sự, không phải "thiếu khí hậu nói chung" như kết luận ban đầu ở exp_004 v1.
- **Quyết định:** vẫn loại M3 khỏi M4 (cả v1 lẫn v2 đều thua). Hướng tiếp theo (chưa làm): thử
  `oni_lag_6` (đủ xa để leak-safe ở mọi horizon ≤6) — có thể là cách duy nhất thêm được tín hiệu liên
  năm vào hhh4 mà không rò rỉ.

**T2 tuning — mở rộng inner window, đang chờ chạy thật:**
- Nghi vấn ở exp_003 (5 origin inner quá nhỏ) đáng kiểm tra lại trước khi kết luận "T2 không giúp
  được gì" là chắc chắn. Tăng `INNER_N_ORIGINS` từ 5 → 15 trong `exp_003/run.py` + `config.yaml` +
  `notebooks/04_tune_m2.ipynb` (không cần sửa code notebook, chỉ import lại hằng số từ `run.py`).
  Dữ liệu vẫn dư dả (real-only 1994-02→2008-12, ~179 tháng, dư sức cho 15 origin).
- Smoke-test đang chạy (2 trial) để xác nhận không lỗi trước khi giao lại — **kết quả 100-trial thật
  chưa có, cần chạy trên máy user** (nặng hơn ~3x so với bản 5-origin cũ, ước tính ~2-3 giờ thay vì
  ~20 phút — đã cập nhật notebook, sẽ báo lại thời gian ước tính chính xác sau khi smoke-test xong).

**File:** `ai-service/app/forecast/models_r.py`, `ai-service/tests/test_forecast/test_models_r.py`,
`ai-service/experiments/exp_004_m3_hhh4/{run.py,RESULTS.md,config.yaml}`,
`ai-service/experiments/exp_003_tuning_m2/{run.py,config.yaml}`,
`ai-service/experiments/{MODEL_ZOO_RESULTS.md,plot_leaderboard.py,leaderboard_mase.png}`

---

## 2026-09-23 — Dọn lại kết quả cho chuẩn chỉnh: bảng xếp hạng tổng hợp + biểu đồ, chuẩn hoá config

**Làm:** Sau 4 experiment (exp_001-004), kết quả đang nằm rải rác ở 4 file `RESULTS.md` riêng — gộp lại
thành 1 nguồn sự thật duy nhất trước khi làm tiếp M4, để tránh mỗi lần so sánh model lại phải lục nhiều
file. Cụ thể:
- Tạo `ai-service/experiments/MODEL_ZOO_RESULTS.md` — bảng MASE đầy đủ mọi model (B1-B4, M1, M2a/b, M3)
  × mọi horizon, kèm bảng trạng thái model zoo (docs/02 §3) và việc tiếp theo ưu tiên theo thứ tự.
- Viết `ai-service/experiments/plot_leaderboard.py` — sinh `leaderboard_mase.png` (đường MASE theo
  horizon, mọi model, tô đậm B3/M2b) bằng script (không vẽ tay) để lần sau có model mới chỉ cần thêm 1
  dòng rồi chạy lại.
- Thêm `config.yaml` cho `exp_003`/`exp_004` (trước đó chỉ có hằng số trong `run.py`, không đồng bộ với
  quy ước `config.yaml` của `exp_001`/`exp_002`) — cùng 1 khuôn cho mọi experiment từ giờ.
- Xoá `exp_003/results_trials5.json` (file sanity-check 5-trial còn sót lại, đã bị `results_trials100.json`
  thay thế, không file nào tham chiếu tới nữa).
- Thêm link "Xem MODEL_ZOO_RESULTS.md" vào đầu mỗi `RESULTS.md` của exp_001-004 để điều hướng qua lại.

**File:** `ai-service/experiments/{MODEL_ZOO_RESULTS.md,plot_leaderboard.py,leaderboard_mase.png}`,
`ai-service/experiments/exp_003_tuning_m2/config.yaml`, `ai-service/experiments/exp_004_m3_hhh4/config.yaml`,
`ai-service/experiments/exp_00{1,2,3,4}_*/RESULTS.md` (thêm link), `PROGRESS_LOG.md`

---

## 2026-09-23 — exp_004: M3 hhh4 chạy xong thật — kết quả âm tính, chẩn đoán rõ nguyên nhân

**Làm:** Rtools45 cài xong → `rpy2` chạy được (sau khi sửa 3 bẫy Windows thật, xem
`app/forecast/r_env.py` docstring: `R_HOME` phải đặt trước import, `bin/x64` (chứa `R.dll`) phải có
trong `PATH` không thì lỗi khó hiểu "LoadLibrary failure", `.libPaths()` phải APPEND không REPLACE
không thì mất luôn thư viện gốc của R). Cài `surveillance` package vào `ai-service/.rlibs/`
(gitignored) thay vì `AppData/Local` — phát hiện `AppData/Local` bị Windows sandbox redirect sang thư
mục ảo hoá riêng của ứng dụng, không thấy được từ terminal thường.

Xây `app/data/adjacency.py` (ma trận kề 34 tỉnh từ `provinces.geojson`, dùng cho thành phần lan
truyền không gian của hhh4 — 6 unit test, verify không có false-adjacency từ đảo xa Trường Sa/Hoàng
Sa) + `app/forecast/models_r.py` (M3 hhh4: fit + dự báo đa bước bằng mô phỏng Monte Carlo) +
`experiments/exp_004_m3_hhh4/`.

**Bug thật gặp khi xây (đã sửa, verify lại):**
1. Round-trip object R phức tạp (`fit`) qua biến Python rồi gán ngược lại `globalenv` gây lỗi
   conversion khó hiểu — sửa bằng cách giữ `fit`/`stsObj` LUÔN ở trong R's global environment, chỉ
   đưa qua Python mảng/số thô.
2. Class `hhh4sims` (kết quả `simulate()`) có method `[` riêng KHÔNG tự drop chiều đơn vị như array
   thường — `rowMeans()` gộp nhầm cả 34 tỉnh thành 1 số duy nhất nếu không `unclass()` trước. Bắt
   được qua test (shape `(1,)` thay vì `(34,)`), có regression test riêng.

**Kết quả (MASE, so với exp_001/002):**

| Model | h=1 | h=3 | h=6 |
|---|---|---|---|
| B3 Climatology | 0.522 | 1.069 | 1.638 |
| M2a XGBoost (tốt nhất) | 0.449 | 0.963 | 1.611 |
| **M3 hhh4** | 0.544 | **1.527** | **2.406** |

**M3 thua MỌI model khác (kể cả 2 baseline) ở h≥2** — tệ nhất trong 7 cấu hình đã thử qua 4 thí
nghiệm. Chẩn đoán rõ ràng, không mơ hồ: **M3 là model DUY NHẤT không dùng bất kỳ thông tin khí hậu
nào** (chỉ AR + lan truyền không gian + mùa vụ thuần), trong khi EDA đã đo tương quan khí hậu↔ca bệnh
khá mạnh (temp lag 2 tháng r=0.565) mà M1/M2 đều khai thác. Không phải bug — đã verify riêng ma trận
kề đúng, indexing đúng, dự báo có scale hợp lý.

**Quyết định:** không đưa M3 (cấu hình hiện tại) vào M4 Ensemble — thua rõ rệt. Việc tiếp theo (nếu
làm) là thêm covariate khí hậu vào `end$f` của hhh4 qua tham số `data=`.

**File:** `ai-service/app/data/adjacency.py`, `ai-service/app/forecast/{r_env,models_r}.py`,
`ai-service/experiments/exp_004_m3_hhh4/{run.py,RESULTS.md,results.json}`,
`ai-service/tests/test_data/test_adjacency.py`, `ai-service/tests/test_forecast/test_models_r.py`

---

## 2026-09-23 — R + rpy2 cài xong (M3 sẵn sàng khi có Rtools), exp_003 T2 tuning dựng xong

**Làm:**
- Phát hiện R 4.6.1 đã được cài (không báo trước) — cài `rpy2` vào venv. Gặp lỗi build từ nguồn (cần
  `make`/Rtools) — chuyển sang cài bằng wheel dựng sẵn (`pip install --only-binary=:all: rpy2`) thành
  công phần cài đặt, nhưng **runtime vẫn cần Rtools45** (rpy2 gọi `R CMD config` lúc import, không chỉ
  lúc build) — đang chờ user cài thêm Rtools45 (~450MB, link CRAN đã gửi) để hoàn thiện M3 (hhh4).
- Trong lúc chờ: xây `exp_003_tuning_m2/` — T2 Optuna TPE tuning cho M2a/M2b (đúng search space
  docs/02 §6.3). Tách biệt HOÀN TOÀN inner-tuning (dữ liệu ≤2008-12) khỏi 8 outer origin đánh giá
  (2009-11..2010-06) để không rò rỉ giữa tuning và đánh giá cuối.
- Sanity-check thật bằng 5 trial: XGBoost ~26s/trial, LightGBM ~7.5s/trial → ước tính 100 trial mỗi
  model ≈ 1 giờ tổng. Theo đúng yêu cầu "việc nặng/dài để notebook" — đóng gói thành
  `notebooks/04_tune_m2.ipynb`, đã verify chạy đúng 2 lần (trước và sau khi ruff tự sắp xếp lại import)
  bằng bản rút gọn 2 trial trước khi giao, kết quả khớp 100% với bản CLI.
- Lệch có chủ đích so với docs/02 §6: tune CẢ 2 model (không chỉ model thắng) vì XGBoost/LightGBM gần
  hoà nhau ở exp_002; dùng TPE sampler nhưng bỏ ASHA pruner (lợi ích nhỏ ở quy mô dữ liệu này); tune 1
  lần trên 1 cửa sổ inner CV thay vì nested CV đầy đủ theo từng outer origin (tốn gấp 8 lần compute).

**Kết quả sanity (5 trial, chưa phải kết quả cuối — cần 100 trial thật từ notebook):**

| Model | T1 default MASE (outer) | T2 tuned MASE (outer, 5 trial) | Cải thiện |
|---|---|---|---|
| M2a XGBoost | 0.9304 | 0.9077 | 2.4% |
| M2b LightGBM | 0.9374 | 0.9323 | 0.6% |

(Số outer MASE ở đây KHÁC exp_002 vì `evaluate_params()` dùng tập feature/protocol chung nhưng tính
trung bình gộp cả 4 horizon thành 1 số — không so trực tiếp với bảng exp_002 theo từng horizon.)

**Việc chờ user:** cài Rtools45 (M3), chạy `notebooks/04_tune_m2.ipynb` full 100 trial (T2, ~1 giờ).

**File:** `ai-service/app/forecast/models.py` (thêm tham số `params` cho M2), `ai-service/experiments/
exp_003_tuning_m2/run.py`, `ai-service/notebooks/04_tune_m2.ipynb`, `ai-service/requirements.txt`
(thêm optuna)

---

## 2026-09-23 — exp_002: 3 model Tier 1 (M1 GLM NegBin, M2a XGBoost, M2b LightGBM) — bắt được 1 rò rỉ dữ liệu thật trước khi báo cáo

**Làm:** Xây `app/forecast/features.py` (7 nhóm đặc trưng theo docs/02 §2, causal, 16 unit test) +
`app/forecast/models.py` (M1 GLM NegBin hiệu ứng tỉnh cố định, M2a/M2b XGBoost/LightGBM, 5 test) +
`experiments/exp_002_model_zoo_tier1/` (config, run.py, RESULTS.md).

**⭐ Rò rỉ dữ liệu thật bắt được TRƯỚC KHI báo cáo (đúng quy trình docs/02 §10 — "kết quả đẹp bất
thường phải nghi trước khi ăn mừng"):** lần chạy đầu M2a cho MASE h=1..6 = 0.352/0.436/0.520/0.796 —
thắng baseline mạnh nhất áp đảo ở MỌI horizon kể cả h=6 (đáng ngờ vì càng xa càng phải khó hơn). Điều
tra: `features.py` sinh lag/momentum gắn với tháng của CHÍNH DÒNG ĐÓ, nhưng lấy thẳng feature của dòng
tại `target_month` để dự báo khiến lag ngắn đọc dữ liệu SAU `train_end` khi h≥3 (h=6: đọc trước 4
tháng!). Đã verify bằng số học tay (in ra chênh lệch tháng chính xác 0/1/1/4 cho h=1/2/3/6). Viết lại
hoàn toàn phần ghép dữ liệu (`build_horizon_pairs`) — features LUÔN neo đúng 1 mốc `train_end`, không
bao giờ đọc xa hơn. Sau khi sửa, MASE tăng lên mức hợp lý hơn (khiêm tốn, đáng tin).

**Bug thật khác gặp trong lúc xây (đều đã sửa, verify lại):**
1. `statsmodels.families.NegativeBinomial()` GLM (alpha cố định=1.0) overflow/phân kỳ với offset lớn
   (log dân số) + 33 dummy tỉnh — chuyển sang `discrete_model.NegativeBinomial` (MLE, tự ước lượng
   alpha) + chuẩn hoá z-score feature + warm-start từ Poisson GLM.
2. Quên đổi đơn vị: M1 fit trên `cases` (offset population) nhưng quên đổi lại `incidence_per_100k`
   trước khi trả về — dự báo sai lệch ~10-50 lần so với thực tế trước khi phát hiện.
3. `add_seasonal_norm_features` ban đầu tưởng có bug nhóm sai tháng — điều tra kỹ hơn phát hiện đây là
   **false alarm**: vì `reporting_delay_months` là hằng số áp dụng đều cho cả chuỗi, nhóm theo tháng
   của `t` hay của `t-D` cho ra CÙNG một phép chia nhóm (chỉ khác nhãn) — đã sửa lại comment/docstring
   cho đúng thay vì để lại tuyên bố sai về "đã sửa bug" không có thật.

**Kết quả cuối cùng (MASE trung bình qua 8 origin, sau khi sửa rò rỉ):**

| Model | h=1 | h=3 | h=6 |
|---|---|---|---|
| B3 Climatology (exp_001) | 0.522 | 1.069 | 1.638 |
| M1 GLM NegBin | 0.497 ✅ | 1.138 ❌ | 1.644 ❌ (sát nút) |
| **M2a XGBoost (thắng nhất quán)** | **0.449** | **0.963** | **1.611** |
| M2b LightGBM | 0.447 | 1.001 | 1.608 |

M2 thắng B3 ở mọi horizon nhưng khiêm tốn (2-14%), chưa đạt ngưỡng promote G1 (docs/02 §10) ở h=3.
Quyết định: M2 là hướng đầu tư tuning (T2) tiếp theo, không tune M1.

**File:** `ai-service/app/forecast/{features,models}.py`,
`ai-service/experiments/exp_002_model_zoo_tier1/{config.yaml,run.py,RESULTS.md,results.json}`,
`ai-service/tests/test_forecast/{test_features,test_models}.py`

---

## 2026-09-23 — Phase 1 hoàn tất cổng nghiệm thu (5/6, mục 6 không khả thi khi làm solo)

**Làm:** Viết 3 file note kiểm chứng nguồn dữ liệu (`docs/data-sources/{era5,population,oni}.md`) —
URL, cách tải, độ phủ thật, giấy phép, ngày kiểm chứng, bẫy đã gặp. Cập nhật `docs/01` §9 tick các mục
đã xong thật. Cập nhật `PHASE-1-CHECKLIST.md` §0 (cổng nghiệm thu).

**Trạng thái 6 điểm cổng nghiệm thu (docs/01 §9 / PHASE-1-CHECKLIST §0):**
1. ✅ panel v0.2.0 đủ cột — xong
2. ✅ sinh lại bằng 1 lệnh — verify lại lần nữa, ra đúng 9.326 dòng
3. ✅ `make_splits()` có test chống rò rỉ — xong (B2, 12 test)
4. ✅ baseline seasonal naive có số — xong (exp_001)
5. 🟡 note nguồn dữ liệu — ERA5/WorldPop/ONI xong; HCDC/NSO vẫn chưa dùng được (NSO xác nhận không có
   CSV/API, chỉ PDF — đã ghi rõ, không phải bỏ sót)
6. ⬜ tái lập chéo trên máy khác — **không khả thi hiện tại** vì làm solo (kế hoạch gốc giả định 2
   người); để lại khi có Minh Dương tham gia thật hoặc khi cần nộp hồ sơ chính thức

**File:** `docs/data-sources/{era5,population,oni}.md`, `docs/01-chien-luoc-du-lieu.md`,
`PHASE-1-CHECKLIST.md`

---

## 2026-09-23 — exp_001: 4 baseline Tier 0 chạy xong

**Làm:** Dựng `ai-service/experiments/exp_001_baselines/` (`config.yaml`, `run.py`, `RESULTS.md`) theo
đúng cấu trúc docs/03 §1. 4 baseline: B1 Persistence, B2 Seasonal naive, B3 Climatology, B4 GLM
Poisson (pooled, offset=log(population)).

**Chạy thật:** `python experiments/exp_001_baselines/run.py` trên panel v0.2.0, tập test giới hạn
đúng `data_source=="real"` (1994-2010) theo docs/03 §8. 8 origin rolling-window, horizon 1/2/3/6.

**Kết quả (MASE trung bình ± std qua 8 origin):**

| Model | h=1 | h=3 | h=6 |
|---|---|---|---|
| B1 Persistence | 0.758±0.626 | 1.620±1.214 | 2.164±1.035 |
| B2 Seasonal naive | 0.739±0.511 | 1.399±1.227 | 1.998±1.060 |
| **B3 Climatology (thắng)** | **0.522±0.458** | **1.069±1.059** | **1.638±0.954** |
| B4 GLM Poisson | 0.943±0.867 | 1.768±1.536 | 2.367±1.236 |

**Phát hiện quan trọng đã điều tra kỹ (không phải bug):** B4 thua cả Persistence — kiểm tra phân phối
dự báo vs thực tế (origin mẫu h=6): std dự báo 3.73 vs std thực tế 17.81 — model pooled dồn dự báo về
gần trung bình chung, không nắm được tỉnh nào vốn incidence cao hẳn (Cà Mau thực tế 97/100k, model
đoán 11.5/100k). Xác nhận đúng lý do docs/02 chọn M1 = GLM NegBin **phân cấp** (hierarchical) cho
Phase 2 thay vì pooled đơn giản.

**Quyết định:** B3 Climatology là mốc so sánh THỰC TẾ mạnh nhất cho Phase 2 (B2 vẫn giữ vai trò mốc
quy ước theo định nghĩa MASE).

**File:** `ai-service/experiments/exp_001_baselines/{config.yaml,run.py,RESULTS.md,results.json}`

---

## 2026-09-23 — Luồng A chạy thật xong hoàn toàn (dân số + ONI + ERA5 → panel v0.2.0)

**Làm:** Nam Hải tự chạy 4 notebook (`00_ingest_population`, `01_ingest_oni`, `02_ingest_era5`,
`03_eda_panel`) qua Jupyter trong VS Code.

**Sự cố gặp + đã sửa (đều verify bằng dữ liệu thật, không đoán):**
1. Kernel VS Code mặc định trỏ nhầm Python hệ thống (không phải venv `ai-service`) → đăng ký kernel
   riêng `denguesense-venv` bằng `python -m ipykernel install`.
2. CDS trả `403 required licences not accepted` — thiếu bước chấp nhận licence RIÊNG của dataset
   ERA5-Land (khác ToS chung lúc đăng ký tài khoản).
3. **Bug thật:** CDS (hạ tầng mới) trả file đặt tên `.nc` nhưng thực chất là ZIP chứa file `.nc` bên
   trong (`data_stream-moda.nc`), dù request đã khai `data_format: netcdf`. Sửa
   `load_and_convert()` trong `ingest_era5.py` tự phát hiện (đọc magic bytes ZIP) và tự giải nén —
   trong suốt với người gọi.

**Kết quả verify thật (không phải giả lập):**
- Dân số: 21/21 năm WorldPop tải đủ, 1.088 dòng (34 tỉnh × 32 năm), 0 null, xu hướng khớp thực tế VN
  (1994≈78M → 2010≈86.6M → 2020≈99.04M, số chính thức ~71M/87M/97M).
- ONI: 919 dòng, 1950-2026, 0 null, 0 trùng lặp.
- ERA5: 32/32 năm CDS (1994-2025) tải đủ sau khi sửa 2 lỗi trên. Zonal stats 13.056 dòng (34×384
  tháng), 0 null, nhiệt độ 9.2-31.1°C/độ ẩm 44-97%/mưa 0-1160mm — đúng thực tế khí hậu VN.
- **Panel v0.2.0:** `python -m app.data.build_panel` → 9.326 dòng, 11 cột, **0 null ở mọi cột** — cả
  3 phép merge (dân số theo tỉnh+năm, khí hậu theo tỉnh+tháng, ONI theo năm+tháng) khớp hoàn hảo.
- **Tương quan khí hậu ↔ ca bệnh (03_eda_panel.ipynb, 278 tháng):** nhiệt độ mạnh nhất ở độ trễ
  **2 tháng** (r=0.565), mưa mạnh nhất ở độ trễ **1 tháng** (r=0.527) — đúng logic sinh học (mưa tạo
  ổ đẻ trứng nhanh, nhiệt độ ảnh hưởng cả vòng đời muỗi lẫn ủ virus, chu kỳ dài hơn).

**File:** `ai-service/app/data/ingest_era5.py` (fix), `ai-service/data/processed/v0.2.0/` (gitignored,
sinh ra bằng script), `ai-service/notebooks/*.ipynb` (đã chạy, có output).

---

## 2026-09-22 — Hardening Luồng A cho chạy qua đêm + xây Luồng B (metrics, splits)

**Làm:**
- `app/data/_retry.py` — exponential backoff dùng chung, wire vào `download_year()` (WorldPop) và
  `fetch_year()` (CDS) — 1 năm lỗi mạng tạm thời tự phục hồi, không sập cả vòng lặp.
- `app/data/run_luong_a.py` — 1 script chạy hết Luồng A nối tiếp, idempotent, log ra file — cho chạy
  nền không cần Jupyter.
- `app/forecast/metrics.py` (B1) — 9 hàm (mae, rmse, bias, mase, poisson_deviance, pr_auc,
  recall_at_precision, brier_score, lead_time), 22 unit test.
- `app/forecast/splits.py` (B2) — `Split` dataclass, `make_splits()` rolling-origin expanding window,
  `assert_test_is_real_only()`, 12 unit test.

**Bug thật bắt được qua test (trước khi lọt vào pipeline):**
1. `rioxarray` chưa import trong `ingest_era5.py` → sẽ crash `AttributeError` ngay lần chạy đầu.
2. `recall_at_precision()` thiết kế sai — định trả NaN khi "không đạt precision mục tiêu", nhưng
   sklearn `precision_recall_curve` luôn có điểm biên precision=1.0 nên nhánh đó không bao giờ xảy
   ra — sửa lại 0.0 là kết quả hợp lệ.

**Verify:** 65/65 test pass, ruff/black sạch, wiring `run_luong_a.py` verify 2 lần bằng dữ liệu giả
đúng schema (xoá sạch sau test).

**File:** `ai-service/app/data/{_retry,run_luong_a}.py`, `ai-service/app/forecast/{metrics,splits}.py`,
`ai-service/tests/test_data/test_retry.py`, `ai-service/tests/test_forecast/*.py`

---

## 2026-09-21/22 — Xây 4 notebook cho Luồng A + module ingest mới

**Làm:** Viết mới hoàn toàn `app/data/{zonal_stats,ingest_oni,ingest_population,ingest_era5}.py` +
sinh 4 notebook (`00-03`) bằng `nbformat`. Cập nhật `build_panel.py` tự nâng version khi đủ dữ liệu.

**Nguồn dữ liệu thật đã xác minh (không phải đoán URL):**
- WorldPop: `data.worldpop.org/GIS/Population/Global_2000_2020/{year}/VNM/vnm_ppp_{year}.tif` — tải
  thử curl HEAD trả 200, ~197MB/năm, verify 2000-2020.
- ONI: `cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` — tải thật, parse thật, đúng định dạng.
- NSO/GSO cấp tỉnh: xác nhận **không có** CSV/API tải được, chỉ có PDF — quyết định dùng WorldPop
  thay vì cố scrape PDF.

**Bug thật bắt được khi viết test `zonal_stats.py`:** bbox ERA5 áng chừng "đất liền VN" ban đầu hẹp
hơn ranh giới hành chính thật — Khánh Hòa (Trường Sa) vươn tới 117.8E, Đà Nẵng (Hoàng Sa) tới 112.7E.
Sửa `VN_BBOX` để bao trọn `total_bounds` thật của `provinces.geojson`.

**Verify:** `python -c "...population_for_year..."` trên file WorldPop 2020 thật → tổng dân số
99.037.315 người (số chính thức ~97,6 triệu, sai lệch hợp lý ~1.5%).

**File:** `ai-service/app/data/{zonal_stats,ingest_oni,ingest_population,ingest_era5}.py`,
`ai-service/notebooks/*.ipynb`, `ai-service/data/external/{provinces.geojson,oni_raw.txt}`

---

## 2026-09-21 — Sửa CI/CD (2 lỗi thật)

1. `pytest` thuần (lệnh CI) không tự thêm `ai-service/` vào `sys.path` như `python -m pytest` — thêm
   `pytest.ini` (`pythonpath = .`).
2. `requirements.txt` khoá cứng bằng `pip freeze` trên Windows gây lỗi ABI trên Ubuntu — quay về ghim
   theo khoảng version.

**File:** `ai-service/pytest.ini`, `ai-service/requirements.txt`

---

## Trước đó (đã có sẵn, không phải việc trong phiên log này)

- Panel v0.1.0 (OpenDengue, small-area estimation) — `app/data/{crosswalk,ingest_opendengue,
  estimate_province,build_panel}.py`, 20 test.
- Dashboard prototype (React) deploy Vercel.
- Docs phương pháp luận `docs/00-06`.
