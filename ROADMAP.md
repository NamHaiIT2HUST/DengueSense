# Roadmap kỹ thuật — DengueSense

Cập nhật lần cuối: 2026-09-21

**Tài liệu phương pháp luận đi kèm (đọc trước khi làm phase tương ứng):** [docs/](docs/README.md)

> 👉 **Đang làm gì ngay bây giờ:** [PHASE-1-CHECKLIST.md](PHASE-1-CHECKLIST.md) — checklist thi hành chi tiết cho phase hiện tại.

---

## Cách dùng file này

- Mỗi task có checkbox `- [ ]` — tick `- [x]` khi xong, commit (`chore(docs): update roadmap`).
- Owner: 🔧 = Nam Hải · 🧬 = Minh Dương · 🤝 = cả hai.
- **Mỗi phase có cổng nghiệm thu (Definition of Done).** Chưa qua cổng thì không sang phase sau — bỏ qua cổng là cách nhanh nhất để 2 tháng sau phải làm lại từ đầu.
- Task nào đủ lớn thì tạo GitHub Issue riêng, gắn milestone, dán link vào dòng đó.

---

## Đường găng (critical path) — đọc kỹ phần này

```
Dữ liệu  ──►  Mô hình Layer 1  ──►  Layer 2  ──►  Layer 3  ──►  Pilot
   ▲
   └── Đây là nút thắt. Mọi thứ phía sau chờ nó.
```

**Bốn sự thật cần đối diện ngay:**

1. 🚨 **Khác biệt của dự án KHÔNG nằm ở độ chính xác dự báo.** D-MOSS đang vận hành tại VN với độ chính xác 0.83–0.94 — con số 89.5% của ta nằm gọn bên trong khoảng đó. Khác biệt thật nằm ở **K1–K5** ([docs/06 §3](docs/06-khao-sat-tai-lieu.md#3-năm-khác-biệt-thật-sự--định-vị-mới)), đặc biệt là **phân bổ theo lợi ích cận biên** và **sinh văn bản chỉ đạo đúng thể thức pháp lý**. Đừng dồn công sức vào việc đẩy thêm vài % độ chính xác.
2. **Phase Dữ liệu sẽ tốn thời gian gấp đôi dự tính.** Luôn luôn như vậy trong mọi dự án ML, và ở đây còn thêm bài toán ánh xạ ranh giới hành chính 2025 ([docs/01 §3](docs/01-chien-luoc-du-lieu.md#3-chuẩn-hoá-đơn-vị-không-gian-bắt-buộc-làm-trước)) — thứ hoá ra lại là **rào cản gia nhập K3**, làm sớm thì thành lợi thế.
3. **Chưa có dữ liệu ca bệnh thật cấp tỉnh cho giai đoạn gần đây.** Đã xác nhận bằng code thật: OpenDengue chỉ có breakdown theo tỉnh tới **2010**, sau đó phải ước lượng (xem docs/01 §2.1c). Công văn (Đường A) và khảo sát NSO cấp tỉnh giờ không còn là "làm cho chắc" — có thể là **nguồn duy nhất** cho ground truth cấp tỉnh giai đoạn 2011+. Gửi công văn **trong tuần này**, không chờ kết quả mới làm tiếp.
4. **Vòng thi Q4/2026 cần một bản demo chạy được, không cần model hoàn hảo.** Tách rõ hai luồng: *luồng demo* (kịp deadline thi) và *luồng nghiêm túc* (cho pilot thật và hồ sơ tài trợ). Đừng để deadline thi ép chất lượng model.

---

## 📍 Tái lập kế hoạch — 21/09/2026

Thực tế đã đi lệch khỏi thứ tự phase ban đầu. Ghi lại cho minh bạch:

| Dự định ban đầu | Thực tế đã xảy ra |
|---|---|
| Phase 0 trước (backend + FastAPI + infra + API contract), rồi mới tới dữ liệu | **Phần lõi dữ liệu của Phase 1 làm trước** (crosswalk 34 tỉnh, OpenDengue, small-area estimation, panel v0.1.0 — 20 test pass) |
| Dashboard là bước cuối Phase 0, nối backend thật | **Dashboard làm sớm dạng prototype**, đọc file JSON tĩnh, phục vụ nộp báo cáo tiến độ cuộc thi |
| Backend Go + FastAPI + docker-compose | **Chưa làm** — và đã quyết định **hoãn có chủ đích** (lý do ở dưới) |

**Quyết định tái lập:** phase hiện tại là **Phase 1 — hoàn thiện tầng dữ liệu**, không quay lại làm Phase 0.

Lý do hoãn Phase 0: backend/FastAPI/docker-compose **không nằm trên đường găng**. Chưa có model thật thì chưa có gì để phục vụ, dựng API bây giờ là dựng vỏ rỗng rồi phải sửa lại khi biết model thật trả ra cái gì. Prototype đã chứng minh được phần giao diện. Dựng lại khi chuẩn bị pilot, lúc đó đã biết chính xác cần expose gì.

> ⚠️ Panel hiện tại **chỉ có đúng 1 biến: số ca**. Chưa có khí hậu → **chưa thể train model**. Đây là lý do Phase 1 là việc phải làm ngay, chi tiết ở [PHASE-1-CHECKLIST.md](PHASE-1-CHECKLIST.md).

---

## Phase 0 — Solo Bootstrap 🔧 ⏸️ HOÃN CÓ CHỦ ĐÍCH
**Làm lại khi chuẩn bị pilot (dự kiến Q1/2027), không phải bây giờ**

**Mục tiêu (giữ nguyên cho sau này):** một luồng chạy được thật từ dashboard → backend → ai-service → trả kết quả → vẽ bản đồ. Làm để chốt API contract và có khung sẵn cho model thật cắm vào.

**Phần đã xong sớm:** dashboard (bản prototype, đọc JSON tĩnh — xem [dashboard/README.md](dashboard/README.md)).
**Phần hoãn:** infra docker-compose, backend Go, FastAPI serving, API contract.

### 0.1 Hạ tầng local
- [ ] `infra/docker-compose.yml` với `postgis/postgis:16-3.4`
- [ ] Init script bật extension `vector` (pgvector)
- [ ] **Done:** `docker compose up postgres` chạy, connect được bằng `psql`

### 0.2 Backend skeleton
- [ ] `go mod init github.com/NamHaiIT2HUST/DengueSense/backend`, thêm Gin
- [ ] `cmd/api/main.go` với route `GET /healthz`
- [ ] Dockerfile multi-stage
- [ ] **Done:** `curl localhost:8080/healthz` trả 200, `docker build` thành công

### 0.3 AI service skeleton
- [ ] `requirements.txt` (ghim version chính xác): fastapi, uvicorn, pydantic, pandas, scikit-learn, xgboost, ortools
- [ ] `app/main.py` với `GET /healthz`
- [ ] **Done:** `localhost:8000/docs` hiện Swagger UI

### 0.4 Chốt API contract ⭐ bước quan trọng nhất phase này
- [ ] `app/schemas/forecast.py` — `ForecastRequest/Response` (gồm `risk_score`, và **`risk_score_lower/upper`** cho khoảng tin cậy — thêm ngay từ đầu, Layer 2 sẽ cần ở [docs/04 §4](docs/04-phuong-phap-toi-uu.md#4-đánh-giá-dưới-bất-định--phần-quan-trọng-bị-bỏ-sót))
- [ ] `app/schemas/optimize.py` — `OptimizeRequest/Response` (gồm cả trường giải thích ở [docs/04 §6](docs/04-phuong-phap-toi-uu.md#6-giải-thích-kết-quả-cho-người-dùng))
- [ ] Route `POST /forecast`, `POST /optimize` trả đúng shape (logic naive)
- [ ] Export `docs/api-contract.json` từ `/openapi.json` và commit
- [ ] **Done:** gọi bằng curl ra đúng shape đã định nghĩa

### 0.5 Layer 1 & 2 bản naive (tạm, sẽ bị thay)
- [ ] Layer 1 naive: trả `risk_score` theo trung bình lịch sử tháng, seed cố định
- [ ] Layer 2 naive: greedy theo tỉ lệ `R/C` cho tới khi hết ngân sách
- [ ] Đánh dấu rõ: `# TODO(Phase 2/3): thay bằng model thật — xem docs/02, docs/04`

### 0.6 Nối backend ↔ ai-service
- [ ] `backend/internal/client/aiservice.go`
- [ ] Endpoint cho dashboard: `GET /api/risk-map`, `POST /api/optimize`
- [ ] JWT cơ bản (user tạm trong `.env`, chưa cần bảng user)

### 0.7 Dashboard
- [ ] Vite + React + TS, Tailwind, Leaflet
- [ ] Bản đồ tô màu theo `risk_score` từ API thật
- [ ] **Done:** mở dashboard thấy bản đồ tô màu bằng dữ liệu chạy qua đủ 3 service

### 0.8 CI
- [ ] 3 workflow chạy thật (không còn bị skip vì thiếu manifest)
- [ ] **Done:** cả 3 xanh trên PR

### 🚪 Cổng nghiệm thu Phase 0
> Bấm 1 nút trên dashboard → đi qua đủ 3 service → vẽ lên bản đồ. Số liệu chưa cần đúng, nhưng **API contract đã chốt và commit**.

---

## Phase 1 — Dữ liệu 🤝 ⬅️ **ĐANG LÀM**
**21/09 – 12/10/2026 · ~3 tuần · Đây là đường găng**

📖 Đọc trước: [docs/01-chien-luoc-du-lieu.md](docs/01-chien-luoc-du-lieu.md)
✅ **Checklist thi hành chi tiết: [PHASE-1-CHECKLIST.md](PHASE-1-CHECKLIST.md)** — dùng file đó để làm việc hằng ngày, mục dưới đây chỉ là bản tóm tắt

> ⚡ **Đã xong sớm (20–21/09):** chuẩn hoá 34 tỉnh (1.3) và phần lõi OpenDengue + small-area estimation (1.4) — code thật, 20 test pass, panel v0.1.0 chạy được bằng 1 lệnh.
>
> 🔴 **Còn thiếu mấu chốt:** panel mới chỉ có cột `cases`. **Chưa có khí hậu → chưa train được model.** Đây là trọng tâm 3 tuần tới.

### 1.1 Xin dữ liệu chính thức (làm ngay tuần đầu, chạy nền)
- [ ] Soạn công văn xin dữ liệu HCDC/Bộ Y tế qua kênh GVHD/Khoa 🤝
- [ ] Ghi rõ phạm vi cần: cấp quận/xã, theo tuần/tháng, càng dài càng tốt
- [ ] **Không chờ kết quả** — các mục dưới chạy song song

### 1.2 Kiểm chứng nguồn công khai
- [x] OpenDengue — kiểm chứng thật, tải + xử lý thành công, xem 1.4 🔧
- [x] HCDC — kiểm chứng thật: không phải bảng, là văn xuôi theo tuần, cần NLP parse (xem [docs/01 §2.1b](docs/01-chien-luoc-du-lieu.md#21b-kế-hoạch-trích-xuất-hcdc-parse-văn-bản-không-phải-scrape-bảng)) 🔧
- [x] ⚠️ Phát hiện: GSO đã đổi tên/tổ chức lại thành **NSO** (Cục Thống kê, Bộ Tài chính), subdomain cấp tỉnh cũ đã chết — cần khảo sát lại cấu trúc `nso.gov.vn` mới 🔧
- [ ] **Khảo sát NSO cấp tỉnh** — ưu tiên cao, có thể là nguồn `real` DUY NHẤT cho cấp tỉnh giai đoạn gần đây (xem [docs/01 §2.1](docs/01-chien-luoc-du-lieu.md#21-dữ-liệu-dịch-tễ-biến-mục-tiêu)) 🧬
- [ ] File note trong `docs/data-sources/` cho ERA5, WorldPop, ranh giới GIS
- [x] **Done:** biết chính xác có bao nhiêu năm × bao nhiêu đơn vị dữ liệu thật — **6.776 dòng thật (34 tỉnh × 1994-2010)**, xem [docs/00 §C.4](docs/00-review-hien-trang.md#c4--quy-mô-dữ-liệu-quyết-định-lựa-chọn-model--đã-đo-thật-không-còn-ước-lượng)

### 1.3 Chuẩn hoá đơn vị không gian ⭐ bắt buộc làm trước mọi thứ khác — ✅ XONG
- [x] Chốt đơn vị phân tích chuẩn: **34 tỉnh mới** (NQ 202/2025/QH15) 🤝
- [x] `crosswalk_province.csv` — 63 tỉnh cũ → 34 tỉnh mới, đối chiếu 2 nguồn, khớp số chính thức (52 gộp + 11 giữ nguyên) 🔧
- [x] `province_metadata.csv` — vùng miền, TP trực thuộc TW 🔧
- [x] `opendengue_province_alias.csv` — xử lý thêm lớp phức tạp "HA TAY" (sáp nhập Hà Nội 2008, khác đợt 2025) 🔧
- [x] Hàm `to_canonical_unit()` trong `app/data/crosswalk.py` + **14 unit test** (bảo toàn tổng, đủ 63→34, raise lỗi khi tên lạ) — pass 100% 🔧
- [x] **Done:** mọi dataset đi qua một hàm duy nhất để về đơn vị chuẩn

### 1.4 Pipeline thu thập
- [x] **Ingest OpenDengue** — `app/data/ingest_opendengue.py`, tải zip thật từ GitHub, lọc VN, tách Admin0 (quốc gia, thật tới 2025)/Admin1 (tỉnh, thật chỉ tới 2010) 🔧
- [x] **Small-area estimation** cho 2011-2025 — `app/data/estimate_province.py`, benchmarking theo tỉ trọng lịch sử tính riêng theo tháng-trong-năm, **6 unit test bảo toàn tổng** (việc mới phát sinh, không có trong kế hoạch gốc — xem [docs/01 §2.1c](docs/01-chien-luoc-du-lieu.md#21c-ước-lượng-cấp-tỉnh-cho-giai-đoạn-2011-2025-đã-chốt-phương-án-2--small-area-estimation)) 🔧
- [x] **`build_panel.py`** — ghép real + estimated, ghi `panel_monthly.parquet` + `manifest.json` tự động, gắn `data_source` mọi dòng 🔧
- [x] **Done một phần:** `python -m app.data.build_panel` chạy ra **v0.1.0: 9.326 dòng, 34/34 tỉnh, 1994-2025, 72,7% real** — nhưng **chưa có cột khí hậu/dân số**, xem việc còn lại dưới
- [ ] Ingest HCDC: crawl + **parse NLP/regex** — chỉ cho chuỗi cấp thành phố + tín hiệu phường nóng, không đủ làm nhãn cấp phường 🧬
- [ ] Ingest ERA5-Land qua `cdsapi` (**cần đăng ký tài khoản CDS trước**) + gộp không gian theo trọng số dân số 🧬
- [ ] Ingest ONI (nhẹ, làm nhanh), WorldPop, ranh giới GIS 34 tỉnh mới 🧬
- [ ] Ghép cột khí hậu/dân số vào panel → lên v0.2.0 🧬

### 1.5 Chia tập & chống rò rỉ
- [ ] `splits.py`: rolling-origin, expanding window, embargo, nested CV 🧬
- [ ] Unit test chứng minh **không điểm tương lai nào lọt vào train** 🧬
- [ ] Cài đặt độ trễ báo cáo `D` như tham số config ([docs/01 §6 Bẫy 3](docs/01-chien-luoc-du-lieu.md#6-các-bẫy-rò-rỉ-dữ-liệu-phải-tránh)) 🧬
- [ ] ⚠️ Xác nhận trong code: tập test cấp tỉnh chỉ được lấy từ 1994-2010 (`data_source=="real"`) — xem [docs/03 §8](docs/03-quy-trinh-thuc-nghiem.md#8-quy-tắc-dùng-tập-test) 🧬

### 1.6 EDA
- [ ] Notebook: chuỗi thời gian theo vùng, tính mùa vụ, tương quan chéo khí hậu–ca bệnh theo độ trễ, bản đồ, thống kê khuyết thiếu 🧬
- [ ] Xác nhận bằng dữ liệu: độ trễ khí hậu nào mạnh nhất? (đừng giả định 1–3 tháng, hãy đo)

### 1.7 Metric & Baseline 🧬 — *chuyển từ Phase 2 sang*

Chuyển về đây vì [docs/01 §9](docs/01-chien-luoc-du-lieu.md#9-checklist-nghiệm-thu-phase-dữ-liệu) đã quy định baseline là **điều kiện nghiệm thu Phase 1**, và vì nhóm này **chỉ cần cột `cases` đã có** → làm được ngay, không phải chờ dữ liệu khí hậu.

- [ ] `app/forecast/metrics.py` — MASE, MAE, RMSE, Poisson deviance, PR-AUC, Brier, lead time + unit test
- [ ] ⚠️ Mẫu số MASE phải tính **chỉ trên tập train**, tính trên toàn bộ dữ liệu là rò rỉ
- [ ] `exp_001` — 4 baseline (persistence, seasonal naive ⭐, climatology, GLM Poisson) trên 4 horizon
- [ ] `RESULTS.md` đầy đủ theo template [docs/03 §4](docs/03-quy-trinh-thuc-nghiem.md#4-resultsmd--bắt-buộc-cho-mọi-thí-nghiệm)

### 🚪 Cổng nghiệm thu Phase 1
> Toàn bộ checklist [docs/01 §9](docs/01-chien-luoc-du-lieu.md#9-checklist-nghiệm-thu-phase-dữ-liệu) đã pass, **bao gồm baseline seasonal naive đã chạy và có số**.
>
> Chi tiết 6 điểm nghiệm thu + cách kiểm tra: [PHASE-1-CHECKLIST.md](PHASE-1-CHECKLIST.md). Hiện đã qua ~40% (chuẩn hoá 34 tỉnh + OpenDengue + estimation xong; còn khí hậu/dân số/splits/baseline/EDA).

---

## Phase 2 — Mô hình Layer 1 🧬
**13/10 – 22/11/2026 · ~6 tuần**

📖 Đọc trước: [docs/02](docs/02-phuong-phap-mo-hinh.md) và [docs/03](docs/03-quy-trinh-thuc-nghiem.md)

### 2.0 Chuẩn bị hạ tầng thí nghiệm 🤝
- [ ] MLflow chạy local, cấu trúc `experiments/` theo [docs/03 §1](docs/03-quy-trinh-thuc-nghiem.md#1-cấu-trúc-thư-mục-thực-nghiệm)
- [ ] Template `config.yaml` + `RESULTS.md`
- [x] ~~`metrics.py`~~ → **đã chuyển sang Phase 1 mục 1.7** (baseline là điều kiện nghiệm thu Phase 1)
- [ ] `app/forecast/features.py` — sinh đặc trưng + **unit test tính nhân quả** ([docs/02 §2](docs/02-phuong-phap-mo-hinh.md#2-kỹ-thuật-đặc-trưng-feature-engineering))

### 2.1 ~~`exp_001` — Baseline~~ → **đã chuyển sang Phase 1 mục 1.7**
Baseline phải có **trước** khi vào Phase 2 — không có mốc so sánh thì mọi con số ở `exp_002` trở đi đều không diễn giải được.

### 2.2 `exp_002` — Model zoo Tier 1 (**4 model**, đã cắt gọn theo [docs/06 §4](docs/06-khao-sat-tai-lieu.md#4-chốt-lựa-chọn-model--cắt-bớt-để-tiết-kiệm-thời-gian))
- [ ] M1 GLM Negative Binomial phân cấp · M2 XGBoost + LightGBM (mặc định) · M3 bán cơ giới hhh4 · M4 ensemble
- [ ] ❌ Không chạy: Random Forest, CatBoost, SARIMAX, Prophet, TFT — **tiết kiệm ~2 tuần**
- [ ] Cùng feature set, cùng fold, cùng metric, siêu tham số mặc định
- [ ] Báo cáo tách theo horizon (h=1,2,3,6) + độ lệch chuẩn qua các origin
- [ ] Đối chiếu với mốc tài liệu: ≥69% @ 3 tháng (ĐBSCL), 0.83–0.94 (D-MOSS)
- [ ] **Done:** biết **một** model đáng đầu tư tuning (không phải hai)

### 2.3 `exp_003` — Ablation đặc trưng
- [ ] Bỏ từng nhóm đặc trưng, đo mức tụt → nhóm nào đóng góp thật?
- [ ] Đối chiếu SHAP với hiểu biết sinh học (Minh Dương rà soát) — feature vô lý mà quan trọng = cờ đỏ rò rỉ

### 2.4 `exp_004` — Tuning (**2 phương pháp**, đã cắt theo [docs/06 §5](docs/06-khao-sat-tai-lieu.md#5-chốt-phương-pháp-tuning--cắt-từ-4-xuống-2-1-tuỳ-chọn))
- [ ] T1 mặc định (đối chứng) · T2 **Optuna TPE + ASHA pruner** (100 trial)
- [ ] 🔶 T3 Random Search 30 trial — chỉ nếu còn thời gian
- [ ] ❌ Không chạy Hyperband riêng (đã nằm trong ASHA pruner) và Grid Search
- [ ] ⭐ **Chỉ tune model thắng ở `exp_002`**, không tune tất cả
- [ ] Vẽ đường hội tụ — phẳng từ trial 30 thì dừng
- [ ] **Done:** biết tuning có đáng tiền không (T1 đã đủ tốt cũng là kết quả hợp lệ)

### 2.5 `exp_005` — Ensemble
- [ ] E1 trung bình · E2 có trọng số · E3 stacking (OOF từ rolling-origin) · E4 theo chế độ
- [ ] Chỉ giữ nếu cải thiện ≥ 3% MASE **và** ổn định qua các origin

### 2.6 `exp_006` — Hiệu chỉnh xác suất
- [ ] Không hiệu chỉnh vs Platt vs Isotonic, đo bằng Brier + reliability diagram

### 2.7 `exp_007` — Leave-one-province-out
- [ ] **Đây là bằng chứng cho luận điểm "nhân rộng chi phí biên gần 0"** — kết quả quyết định cách phát biểu luận điểm kinh doanh

### 2.8 `exp_008` — Độ vững
- [ ] Nhiễu khí hậu ±5/±10% · khuyết thiếu 10/20% · năm bất thường (2020–21 COVID, 2023 Hà Nội)

### 2.9 `exp_009` — Tier 2 (**chỉ nếu xong sớm**)
- [ ] M5 LSTM/GRU + khí hậu · M6 Bayes spatiotemporal đầy đủ (hỗ trợ khác biệt K4)
- [ ] Áp dụng quy tắc dừng ở [docs/02 §3](docs/02-phuong-phap-mo-hinh.md#quy-tắc-dừng) — đừng chạy cho đủ số

### 2.10 `exp_010` — CHẠY TEST (chạm 1 lần) 🚨
- [ ] Ghi vào `docs/test-set-access-log.md` trước khi chạy
- [ ] Đánh giá theo 7 cổng ở [docs/02 §10](docs/02-phuong-phap-mo-hinh.md#10-cổng-quyết-định--điều-kiện-promote-model)
- [ ] Viết model card đầy đủ
- [ ] Kiểm tra tái lập chéo (Nam Hải chạy lại được kết quả của Minh Dương)

### 2.11 Đưa vào production
- [ ] Port logic từ `experiments/` sang `app/forecast/` 🧬
- [ ] Thay Layer 1 naive bằng model thật — **không đổi shape API** ([docs/api-contract.json](docs/api-contract.json)) 🧬
- [ ] Cập nhật số liệu trong bản thuyết minh bằng con số thật đo được 🤝

### 🚪 Cổng nghiệm thu Phase 2
> Model qua đủ 7 cổng G1–G7. **Nếu không đạt G1 (không thắng nổi seasonal naive): báo cáo trung thực và điều tra nguyên nhân — không đổi metric cho tới khi ra số đẹp.**

---

## Phase 3 — Tối ưu Layer 2 🧬
**23/11 – 13/12/2026 · ~3 tuần**

📖 Đọc trước: [docs/04](docs/04-phuong-phap-toi-uu.md)

- [ ] 🚨 Chốt P1/P2/P3 — **khuyến nghị P2 (lợi ích cận biên)**, không phải P1 🤝
- [ ] Định nghĩa `ΔCasesᵢ(xᵢ) = Ĉasesᵢ · eᵢ · f(xᵢ)`, chốt dạng hàm lõm `f` và giả định `eᵢ` 🧬
- [ ] Xấp xỉ tuyến tính từng khúc hàm lõm để giải bằng CP-SAT 🧬
- [ ] Cài đặt 6 solver: S0 xếp hạng rủi ro (baseline), greedy cận biên, CP-SAT, SCIP, SA, Tabu 🧬
- [ ] Bộ bài toán test ở N = 34 / 100 / 570 / 3.321 / 10.000 🧬
- [ ] Đo: giá trị mục tiêu, optimality gap, thời gian, tính ổn định 🧬
- [ ] Test brute-force N ≤ 20 (test duy nhất chứng minh cài đặt đúng) 🧬
- [ ] ⭐ **`exp_020` — Thí nghiệm then chốt: P2 có hơn P1 không?** ([docs/04 §4b](docs/04-phuong-phap-toi-uu.md#4b-thí-nghiệm-then-chốt-p2-có-thật-sự-hơn-p1-không-)) — ra con số "cùng ngân sách, cứu thêm X% ca" + phân tích độ nhạy theo `eᵢ` và `k` 🧬
- [ ] Đánh giá dưới bất định: deterministic vs stochastic vs robust (khác biệt K4) 🧬
- [ ] Trường giải thích kết quả (xếp hạng, ngưỡng cắt, shadow price) 🧬
- [ ] Thay Layer 2 naive bằng bản thật 🧬
- [ ] **Cập nhật bản thuyết minh:** thay "MILP + SA + Tabu" bằng "tối ưu số ca cứu được có tính lợi ích cận biên giảm dần, tối ưu chứng minh được < 1s" 🤝

### 🚪 Cổng nghiệm thu Phase 3
> Đạt O1–O7 ở [docs/04 §7](docs/04-phuong-phap-toi-uu.md#7-cổng-quyết-định-layer-2), **bao gồm O5: có bằng chứng bằng số rằng P2 hơn P1**.

---

## Phase 4 — GenAI RAG Layer 3 🤝
**14/12/2026 – 31/01/2027 · ~6 tuần**

📖 Đọc trước: [docs/05](docs/05-phuong-phap-genai-rag.md)

### 4.1 Kho tri thức
- [ ] Thu thập văn bản: QĐ 02/2016, hướng dẫn HCDC, mẫu văn bản hành chính 🧬
- [ ] Metadata hiệu lực cho từng văn bản (ngày ban hành/hiệu lực/trạng thái) 🧬
- [ ] Chunking theo cấu trúc Điều/Khoản (không cắt theo ký tự) 🧬
- [ ] Index vào pgvector + BM25 (hybrid search) 🔧

### 4.2 Đánh giá truy hồi (làm trước phần sinh)
- [ ] Bộ câu hỏi kiểm thử + đo Recall@k, MRR 🧬
- [ ] So sánh: kích thước chunk × model embedding × có/không hybrid

### 4.3 Sinh văn bản
- [ ] Luồng B2B trước (rủi ro thấp) 🧬
- [ ] Luồng B2G sau (điền mẫu + LLM viết phần diễn giải) 🧬
- [ ] So sánh cấu hình: LLM × chiến lược prompt × nhiệt độ × có/không RAG 🧬

### 4.4 Guardrail ⭐
- [ ] G1 kiểm tra số (regex + so khớp tập hợp, **không dùng LLM tự kiểm tra**) 🔧
- [ ] G2–G6 theo [docs/05 §4](docs/05-phuong-phap-genai-rag.md#4-guardrail--kiểm-tra-bắt-buộc-trước-khi-hiện-cho-cán-bộ) 🔧

### 4.5 Bộ vàng & đánh giá
- [ ] 30–50 kịch bản + văn bản tham chiếu do Minh Dương soạn 🧬
- [ ] Đo tính trung thực, chính xác số liệu, thể thức, hữu dụng 🤝

### 4.6 Duyệt & phản hồi
- [ ] Dashboard: Accept / Edit / Deny 🔧
- [ ] **Lưu dữ liệu chỉnh sửa ngay từ đầu** — bỏ qua là mất vĩnh viễn 🔧
- [ ] Kiểm chứng bằng code: không có đường nào ban hành mà không qua duyệt 🔧

### 🚪 Cổng nghiệm thu Phase 4
> Đạt R1–R7 ở [docs/05 §7](docs/05-phuong-phap-genai-rag.md#7-cổng-quyết-định-layer-3). **R1 và R2 là 100%, không thương lượng.**

---

## Phase 5 — Tích hợp & Sẵn sàng Pilot 🔧
**01/02 – 15/03/2027 · ~6 tuần**

> 📦 **Phần Phase 0 hoãn lại được gộp vào đây** — lúc này đã biết chính xác model trả ra gì nên dựng API không còn là đoán mò:
> - [ ] `infra/docker-compose.yml` (Postgres + PostGIS + pgvector) 🔧
> - [ ] `ai-service`: FastAPI app + Pydantic schemas (API contract) 🔧
> - [ ] `backend` Go: API gateway, auth JWT, client gọi ai-service 🔧
> - [ ] Dashboard: chuyển từ JSON tĩnh sang gọi API thật 🔧

- [ ] Dispatch: Gmail/SMS cảnh báo cá nhân hoá 🔧
- [ ] Dispatch: xuất lệnh điều động CDC 🔧
- [ ] Đa tenant (tách dữ liệu giữa các đơn vị khách hàng) 🔧
- [ ] Offline-first: caching + fallback nội suy khi mất kết nối 🤝
- [ ] Bảo mật: mã hoá AES-256, rà OWASP Top 10, audit log 🔧
- [ ] Hạ tầng pilot: VM cloud, deploy docker-compose, backup DB, monitoring/alert 🔧
- [ ] Tài liệu hướng dẫn sử dụng cho cán bộ y tế 🤝
- [ ] Diễn tập demo end-to-end 🤝

---

## Phase 6 — Pilot thực địa 🤝
**Q2/2027 trở đi**

- [ ] Onboard 1–2 bệnh viện / CDC pilot
- [ ] Theo dõi độ chính xác trên dữ liệu thực vs holdout ban đầu — **kiểm chứng có trôi mô hình không**
- [ ] Theo dõi **tỉ lệ chấp nhận không sửa** của Layer 3 ([docs/05 §5.5](docs/05-phuong-phap-genai-rag.md#55-chỉ-số-quan-trọng-nhất-khi-vận-hành))
- [ ] Vòng lặp re-training từ phản hồi thực tế
- [ ] Thu thập KPI cho case study: thời gian phản ứng, lead time, ước tính tiết kiệm
- [ ] Cập nhật TRL từ 4 lên 5 với bằng chứng thật

---

## Luồng song song — Chuẩn bị đối ngoại 🤝

Không phụ thuộc phase kỹ thuật, nhưng có deadline riêng:

- [ ] **Tuần này:** sửa các mâu thuẫn số liệu trong bản thuyết minh ([docs/00 §D](docs/00-review-hien-trang.md#d-việc-phải-làm-trước-khi-nộp-bản-thuyết-minh-tiếp-theo))
- [ ] **Tuần này:** gửi công văn xin dữ liệu
- [ ] **T10/2026:** hồ sơ Nafosted/quỹ trường-viện
- [ ] **T10–T12/2026:** vòng triển khai Sáng tạo Trẻ — cần bản demo chạy được (dùng kết quả Phase 0 + Phase 1, chưa cần Phase 2 xong)
- [ ] **Liên tục:** làm việc với Sở Y tế TP.HCM/Hà Nội, tiếp cận bệnh viện tư

---

## Rủi ro theo dõi xuyên suốt

| Rủi ro | Dấu hiệu sớm | Phương án |
|---|---|---|
| **Không xin được dữ liệu thật** | Hết T10 chưa có phản hồi | Đường B (nguồn công khai) phải đủ đứng một mình. Hạ phạm vi xuống cấp tỉnh |
| **Model không thắng baseline** | `exp_002` cho MASE > 0.95 | Báo cáo trung thực. Điều tra: dữ liệu quá thô? cần độ phân giải mịn hơn? Đây là kết quả nghiên cứu hợp lệ |
| **Phase Dữ liệu trượt tiến độ** | Hết tuần 2 chưa xong crosswalk | Cắt phạm vi (ít tỉnh hơn, ít năm hơn), **không cắt chất lượng quy trình** |
| **Trôi mô hình** | Sai số tăng dần trên dữ liệu mới | Lịch re-train hàng tháng, so sánh sliding vs expanding window |
| **Hallucination GenAI** | Guardrail G1 bắt được số lạ | G1 chặn cứng. Không nới ngưỡng để "cho chạy được" |
| **Bảo mật dữ liệu y tế** | — | Không lưu dữ liệu bệnh nhân thật ở môi trường dev. Audit trước pilot |
