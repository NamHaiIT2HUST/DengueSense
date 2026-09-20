# 03 — Quy trình thực nghiệm

> Mục tiêu: sáu tháng sau, khi hội đồng hỏi *"con số này ở đâu ra"*, mở đúng 1 run ID ra là trả lời được đầy đủ.

---

## 1. Cấu trúc thư mục thực nghiệm

```
ai-service/
├── app/                          # CODE PRODUCTION — chỉ code đã chín
│   ├── forecast/
│   │   ├── features.py           # sinh đặc trưng (có unit test nhân quả)
│   │   ├── models.py             # định nghĩa model zoo
│   │   ├── splits.py             # rolling-origin, nested CV
│   │   ├── metrics.py            # MASE, PR-AUC, lead time...
│   │   └── predict.py            # inference
│   ├── optimize/
│   └── genai_rag/
├── experiments/                  # THÍ NGHIỆM — mã nghiên cứu, được phép lộn xộn
│   ├── exp_001_baselines/
│   │   ├── run.py
│   │   ├── config.yaml
│   │   └── RESULTS.md            # ⭐ BẮT BUỘC, xem §4
│   ├── exp_002_model_zoo_tier1/
│   └── exp_003_tuning_comparison/
├── notebooks/                    # EDA, khám phá — KHÔNG import vào production
├── tests/
└── models/                       # artifact, gitignored
```

**Ranh giới rõ ràng:** `experiments/` là nơi thử nghiệm, được phép bừa. `app/` là code chạy thật, phải sạch và có test. Khi một thí nghiệm cho kết quả tốt → **port logic sang `app/`**, không import trực tiếp từ `experiments/`.

---

## 2. Đánh số thí nghiệm

Quy ước: `exp_<số thứ tự 3 chữ số>_<mô tả ngắn>`. Số thứ tự **tăng dần, không tái sử dụng, không xoá**. Thí nghiệm thất bại cũng giữ nguyên — biết cái gì *không* hoạt động cũng là kết quả, và tránh việc 3 tháng sau thử lại đúng thứ đã thất bại.

Kế hoạch thí nghiệm dự kiến:

| ID | Nội dung | Phụ thuộc | Tài liệu tham chiếu |
|---|---|---|---|
| `exp_001` | 4 baseline (B1–B4) | Data v1.0.0 | [02 §3 Tier 0](02-phuong-phap-mo-hinh.md#tier-0--baseline-bắt-buộc-làm-trước) |
| `exp_002` | **4 model** Tier 1, siêu tham số mặc định | exp_001 | [02 §3 Tier 1](02-phuong-phap-mo-hinh.md#tier-1--bắt-buộc-thử-4-model) |
| `exp_003` | Loại bỏ đặc trưng (ablation) — nhóm nào đóng góp thật? | exp_002 | [02 §2](02-phuong-phap-mo-hinh.md#2-kỹ-thuật-đặc-trưng-feature-engineering) |
| `exp_004` | Tuning (T1 mặc định + T2 Optuna TPE) trên **model thắng** | exp_002 | [02 §6](02-phuong-phap-mo-hinh.md#6-tuning-siêu-tham-số--2-phương-pháp-bắt-buộc-1-tuỳ-chọn) |
| `exp_005` | Ensemble (E1–E4) | exp_004 | [02 §7](02-phuong-phap-mo-hinh.md#7-ensemble--sau-khi-đã-chọn-được-model-đơn-lẻ) |
| `exp_006` | Hiệu chỉnh xác suất | exp_004 | [02 §5.3](02-phuong-phap-mo-hinh.md#53-hiệu-chỉnh-xác-suất-calibration) |
| `exp_007` | Leave-one-province-out | exp_004 | [02 §4.3](02-phuong-phap-mo-hinh.md#43-kiểm-tra-khái-quát-hoá-không-gian-leave-one-province-out) |
| `exp_008` | Kiểm định độ vững | exp_004 | [02 §4.4](02-phuong-phap-mo-hinh.md#44-kiểm-định-độ-vững-robustness) |
| `exp_009` | Tier 2 (nếu còn thời gian) | exp_004 | [02 §3 Tier 2](02-phuong-phap-mo-hinh.md#tier-2--thử-nếu-còn-thời-gian-4-model) |
| `exp_010` | **CHẠY TEST — chạm 1 lần** | Tất cả trên | [02 §10](02-phuong-phap-mo-hinh.md#10-cổng-quyết-định--điều-kiện-promote-model) |

---

## 3. Cấu hình thí nghiệm

Mỗi thí nghiệm có `config.yaml`, **không hardcode tham số trong code** ([CONTRIBUTING §4](../CONTRIBUTING.md)):

```yaml
experiment:
  id: exp_002_model_zoo_tier1
  description: "So sánh 4 model Tier 1 ở siêu tham số mặc định"
  author: minh-duong

data:
  version: "1.0.0"
  spatial_unit: province_34_2025
  target: incidence_per_100k
  reporting_delay_months: 1

splits:
  strategy: rolling_origin
  scheme: expanding
  train_end: "2016-12"
  val_range: ["2017-01", "2020-12"]
  n_origins: 5
  embargo_months: 6

horizons: [1, 2, 3, 6]

models: [glm_negbin_hier, xgboost, lightgbm, hhh4_endemic_epidemic]

metrics:
  primary: mase
  secondary: [mae, rmse, poisson_deviance, pr_auc, brier]

seed: 42
```

**Seed cố định ở mọi nơi**: numpy, random, model, và cả thứ tự tải dữ liệu. Không cố định seed = không tái lập được = số liệu không dùng được cho hồ sơ chính thức.

---

## 4. `RESULTS.md` — bắt buộc cho mọi thí nghiệm

Đây là thứ quan trọng nhất của quy trình này. Viết **ngay sau khi chạy xong**, không để dồn.

```markdown
# exp_002 — Model zoo Tier 1

- **Ngày chạy:** 2026-10-08
- **Commit:** a1b2c3d
- **Data version:** v1.0.0
- **MLflow run:** http://localhost:5000/#/experiments/2

## Câu hỏi
Trong 4 model Tier 1 ở cấu hình mặc định, model nào đáng đầu tư tuning? Có model nào đạt mốc tài liệu (≥69% @ 3 tháng) không?

## Thiết lập
Rolling-origin 5 origin, expanding window, 4 horizon. Metric chính MASE (so seasonal naive).

## Kết quả

### MASE theo horizon (trung bình ± độ lệch chuẩn qua 5 origin)

| Model | h=1 | h=3 | h=6 |
|---|---|---|---|
| B2 seasonal naive | 1.000 | 1.000 | 1.000 |
| M1 GLM NegBin phân cấp | | | |
| M2a XGBoost | | | |
| M2b LightGBM | | | |
| M3 hhh4 bán cơ giới | | | |
| M4 Ensemble | | | |

## Nhận định
- (model nào thắng, thắng ở đâu, thua ở đâu)
- (có model nào thua baseline không — nếu có, ghi rõ)
- (đối chiếu mốc tài liệu: ≥69% @ 3 tháng — đạt chưa? **vượt quá 95% thì nghi rò rỉ dữ liệu**)

## Điều bất ngờ / nghi vấn
- (chỗ nào kết quả khác dự đoán → thường là nơi có bug hoặc có phát hiện thật)

## Quyết định
- (chọn gì để đi tiếp, loại gì, vì sao)

## Việc tiếp theo
- [ ] exp_003: ablation đặc trưng trên top-2
```

**Mục "Điều bất ngờ / nghi vấn" là mục có giá trị nhất.** Kết quả tốt bất thường gần như luôn là rò rỉ dữ liệu chứ không phải may mắn. Ghi lại nghi vấn ngay lúc nhìn thấy, đừng bỏ qua vì "số đẹp mà".

---

## 5. Theo dõi thí nghiệm — MLflow

```bash
pip install mlflow
mlflow ui --backend-store-uri ./mlruns
```

Mỗi run bắt buộc log:

| Loại | Nội dung |
|---|---|
| **Params** | Toàn bộ `config.yaml` (flatten) + siêu tham số model |
| **Metrics** | Mọi metric, **tách theo horizon và theo origin** (không chỉ trung bình) |
| **Tags** | `git_commit`, `data_version`, `experiment_id`, `author` |
| **Artifacts** | Model đã train, biểu đồ SHAP, reliability diagram, file dự báo (parquet) |

Nguyên tắc: **bất kỳ con số nào xuất hiện trong slide/hồ sơ đều phải dẫn ngược về được một MLflow run ID.** Không có run ID → con số đó không được dùng đối ngoại.

---

## 6. Tái lập (Reproducibility)

### 6.1 Tiêu chí

Người còn lại trong nhóm, trên máy khác, từ `git commit` + `data version` → chạy lại ra kết quả sai khác **< 1%**.

### 6.2 Kiểm tra định kỳ

Cuối mỗi phase, làm **một lần kiểm tra tái lập chéo**: Nam Hải chạy lại thí nghiệm của Minh Dương và ngược lại. Không tái lập được thì dừng mọi việc khác để tìm nguyên nhân — vấn đề tái lập luôn lan rộng hơn vẻ ngoài của nó.

### 6.3 Checklist

- [ ] `requirements.txt` ghim phiên bản chính xác (`==`, không dùng `>=`)
- [ ] Seed cố định ở mọi nguồn ngẫu nhiên
- [ ] Data version ghi trong config, không dùng "file mới nhất"
- [ ] Không có đường dẫn tuyệt đối (`D:\...`) trong code
- [ ] Thí nghiệm chạy được bằng một lệnh: `python experiments/exp_002/run.py`
- [ ] Ghi rõ nếu có bước thủ công (và tốt nhất là tự động hoá nó)

---

## 7. Nhịp làm việc

| Nhịp | Việc | Ai |
|---|---|---|
| **Mỗi thí nghiệm xong** | Viết `RESULTS.md`, commit, báo nhóm 1 dòng | Người chạy |
| **Hàng tuần** | Rà soát kết quả tuần: cái gì hoạt động, cái gì không, tuần tới làm gì | 🤝 |
| **Cuối mỗi phase** | Kiểm tra tái lập chéo + cập nhật ROADMAP | 🤝 |
| **Trước mỗi mốc đối ngoại** | Rà soát: mọi con số trong tài liệu có run ID không? | 🤝 |

---

## 8. Quy tắc dùng tập test

> Đây là quy tắc dễ vi phạm nhất và hậu quả nặng nhất.

1. Tập test **khoá** cho tới cổng quyết định cuối ([02 §10](02-phuong-phap-mo-hinh.md#10-cổng-quyết-định--điều-kiện-promote-model)).
2. Mỗi lần chạm tập test phải **ghi vào `docs/test-set-access-log.md`**: ngày, lý do, kết quả, ai duyệt.
3. Sau khi đã nhìn kết quả test: **không được quay lại tuning rồi chạy test lần nữa** rồi báo cáo con số thứ hai như thể nó vô tư. Nếu buộc phải làm, ghi rõ trong model card là "test đã chạm N lần" và hiểu rằng con số đã mất một phần giá trị.
4. Test phải **100% dữ liệu thật**, không có dòng `simulated` nào ([01 §8](01-chien-luoc-du-lieu.md#8-xử-lý-dữ-liệu-mô-phỏng-nếu-vẫn-phải-dùng)).
