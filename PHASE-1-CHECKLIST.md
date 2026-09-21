# Phase 1 — Hoàn thiện tầng dữ liệu · Checklist thi hành

> **Trạng thái:** đang làm · Bắt đầu 21/09/2026 · Mục tiêu xong **12/10/2026** (~3 tuần)
> **Tài liệu gốc:** [docs/01-chien-luoc-du-lieu.md](docs/01-chien-luoc-du-lieu.md) · [ROADMAP.md](ROADMAP.md)

---

## Vì sao phase này là việc phải làm ngay

Panel dữ liệu hiện tại (`v0.1.0`) **chỉ có đúng 1 biến: số ca**.

```
province_id | month | cases | data_source        ← đang có
population, incidence_per_100k,
temp_*, precip_*, humidity_*, oni                ← CHƯA CÓ
```

Không có dữ liệu khí hậu thì **không thể train model dự báo** — độ trễ khí hậu (mưa/nhiệt 1–3 tháng trước) chính là biến giải thích mạnh nhất của sốt xuất huyết. Mọi thứ ở Phase 2 đứng sau việc này.

### Định nghĩa HOÀN THÀNH phase (cổng nghiệm thu)

Phase 1 chỉ được coi là xong khi **tất cả** các mục sau đúng:

1. `panel_monthly.parquet` lên **v0.2.0**, có đủ cột khí hậu + dân số + `incidence_per_100k`
2. Sinh lại toàn bộ từ raw bằng **một lệnh**, không bước thủ công nào
3. `make_splits()` có unit test chứng minh **không điểm tương lai nào lọt vào train**
4. **Baseline seasonal naive đã chạy, có số cụ thể** — mốc để so mọi model về sau
5. Mỗi nguồn dữ liệu có 1 file note trong `docs/data-sources/` đã kiểm chứng
6. Kiểm tra tái lập chéo: người kia chạy lại ra cùng kết quả (sai khác < 1%)

---

## ⚠️ Hai việc làm NGAY HÔM NAY (có độ trễ chờ bên ngoài)

Hai việc này không tốn công nhưng **chờ người khác**, làm muộn là chặn cả phase.

### [ ] 0.1 — Đăng ký tài khoản Copernicus CDS 🔧 `~20 phút, chờ duyệt`

Đây là cổng vào toàn bộ dữ liệu khí hậu. **Làm đầu tiên trong ngày.**

- [ ] Đăng ký tài khoản mới tại [cds.climate.copernicus.eu](https://cds.climate.copernicus.eu)
      ⚠️ **Tài khoản CDS cũ (trước 02/2025) KHÔNG dùng được** — hệ thống đã migrate, phải tạo mới
- [ ] Vào trang dataset **ERA5-Land monthly averaged data**, bấm tab *Download* → kéo xuống cuối → **chấp nhận Terms of Use**
      ⚠️ Bước này rất dễ quên. Không chấp nhận điều khoản thì API trả lỗi 403 dù key đúng
- [ ] Lấy Personal Access Token, tạo file `~/.cdsapirc`:
      ```
      url: https://cds.climate.copernicus.eu/api
      key: <personal-access-token>
      ```
      ⚠️ URL mới là `/api` — các hướng dẫn cũ trên mạng ghi `/api/v2`, sai
- [ ] **Done khi:** chạy thử 1 request nhỏ (1 tháng, 1 biến) tải về được file `.nc`

### [ ] 0.2 — Gửi công văn xin dữ liệu chính thức 🤝 `~1 giờ soạn, chờ vài tuần`

- [ ] Soạn công văn qua kênh GVHD (ThS. Hồ Viết Đức Lương) → Khoa Toán-Tin
- [ ] Phạm vi xin **hẹp và cụ thể**: số ca SXH theo tỉnh, theo tháng, 2011–2025, dữ liệu **tổng hợp** (không cần định danh cá nhân — tránh vướng hội đồng đạo đức)
- [ ] Gọi/email hỏi trước Phòng Kế hoạch-Nghiệp vụ HCDC xem gửi đúng ai, mẫu nào
- [ ] **Không chờ kết quả** — toàn bộ checklist dưới chạy song song

> Vì sao vẫn xin dù đã có pipeline công khai: dữ liệu cấp tỉnh giai đoạn 2011–2025 hiện là **ước lượng suy diễn**, không phải số đo thật. Xin được thì thay thẳng vào, chất lượng model lên rõ rệt.

---

## Hai luồng chạy SONG SONG

Sắp xếp để **không ai phải ngồi chờ**:

| | Luồng A — Dữ liệu (chờ CDS) | Luồng B — Nền móng mô hình (không chờ gì) |
|---|---|---|
| Ai | 🔧 Nam Hải | 🧬 Minh Dương |
| Chặn bởi | Tài khoản CDS (mục 0.1) | **Không chặn — bắt đầu được ngay** |
| Nội dung | Dân số, ERA5, ONI, ghép panel v0.2.0 | metrics, splits, baseline, EDA |

> ⭐ Điểm quan trọng: **Luồng B chỉ cần cột `cases` đã có sẵn**. Minh Dương bắt tay được ngay hôm nay, không cần đợi dữ liệu khí hậu.

---

# LUỒNG A — Hoàn thiện dữ liệu 🔧

## A1. Dân số theo tỉnh theo năm

Cần để tính `incidence_per_100k` — biến mục tiêu chính ([docs/01 §2.3](docs/01-chien-luoc-du-lieu.md#23-dữ-liệu-dân-số--kinh-tế-xã-hội)).

- [ ] Chọn nguồn dân số **theo năm** cho 1994–2025 (Niên giám thống kê NSO, hoặc WorldPop annual)
- [ ] ⚠️ **Bẫy:** file GeoJSON đang có sẵn cột `DanSo_ng` nhưng đó là **ảnh chụp 2025**, dùng cho cả chuỗi 30 năm là sai nặng — dân số VN 1994 khác 2025 rất nhiều
- [ ] ⚠️ **Bẫy:** dữ liệu dân số lịch sử ở **ranh giới tỉnh cũ** → phải đi qua `to_canonical_unit()` y như dữ liệu ca bệnh, cộng dồn lên 34 tỉnh mới
- [ ] Viết `app/data/ingest_population.py`
- [ ] Unit test: bảo toàn tổng dân số trước/sau crosswalk
- [ ] Năm nào thiếu → nội suy tuyến tính, gắn `population_source="imputed"`
- [ ] **Done khi:** có bảng `(province_id, year) → population` phủ đủ 34 tỉnh × 1994–2025

## A2. Chỉ số ENSO (ONI) — làm nhanh, lấy đà

Nhẹ nhất trong nhóm, làm trước để có cảm giác tiến triển.

- [ ] Viết `app/data/ingest_oni.py` — tải file text từ NOAA CPC
- [ ] ⚠️ Nguồn NOAA có lúc chặn request tự động → thêm `User-Agent` header, hoặc tải tay 1 lần rồi commit vào `data/external/` (file rất nhẹ, chấp nhận được)
- [ ] Parse về dạng `(year, month) → oni`
- [ ] **Done khi:** có chuỗi ONI phủ 1994–2025

## A3. Khí hậu ERA5-Land — phần nặng nhất

- [ ] Viết `app/data/ingest_era5.py` dùng `cdsapi`
- [ ] ⚠️ **Dùng dataset `reanalysis-era5-land-monthly-means`**, KHÔNG dùng bản theo giờ — bản giờ cho VN 30 năm là hàng trăm GB, tải cả tuần không xong
- [ ] Biến cần: `2m_temperature`, `total_precipitation`, `2m_dewpoint_temperature`
- [ ] Bbox Việt Nam: khoảng `[23.5, 102, 8.2, 110]` (N, W, S, E)
- [ ] Tải theo **từng năm một** rồi ghép — request 30 năm một lần dễ timeout/bị huỷ
- [ ] ⚠️ **Bẫy đơn vị — sẽ sai âm thầm nếu không xử lý:**
  - Nhiệt độ ERA5 là **Kelvin** → trừ 273.15 ra °C
  - `total_precipitation` là **mét/ngày tích luỹ** → nhân 1000 và nhân số ngày trong tháng ra mm/tháng
  - **Không có sẵn độ ẩm tương đối** — phải tự tính từ nhiệt độ + điểm sương (công thức Magnus)
- [ ] **Done khi:** có file `.nc` phủ 1994–2025, kiểm tra 1 tháng bất kỳ ra giá trị hợp lý (VN nhiệt độ ~20–30°C, không ra 300 hay -5)

## A4. Gộp không gian: lưới khí hậu → 34 tỉnh

- [ ] Viết `app/data/zonal_stats.py`: cắt raster ERA5 theo ranh giới tỉnh
- [ ] Phiên bản 1: **trung bình theo diện tích** (đơn giản, chạy trước cho thông luồng)
- [ ] Phiên bản 2 (nâng cấp sau): **trung bình có trọng số dân số** — hợp lý hơn vì muỗi và người tập trung ở khu dân cư, không rải đều trên núi
- [ ] ⚠️ Ranh giới tỉnh dùng đúng file 34 tỉnh đã có ở `dashboard/public/data/provinces.geojson` (đã sửa lỗi nhãn Lạng Sơn/Đồng Tháp) — cân nhắc chuyển file này về `ai-service/data/external/` cho đúng chỗ
- [ ] **Done khi:** có bảng `(province_id, month) → temp_mean, precip_total, humidity_mean`

## A5. Ghép tất cả → panel v0.2.0

- [ ] Cập nhật `build_panel.py`: join thêm dân số + khí hậu + ONI
- [ ] Tính `incidence_per_100k = cases / population * 100000`
- [ ] ⚠️ `data_source` phải **lan truyền đúng**: dòng nào `cases` là `estimated` thì `incidence` cũng là `estimated`, không được "rửa" thành `real`
- [ ] Nâng `VERSION = "0.2.0"`, cập nhật `manifest.json` (thêm nguồn mới, cập nhật `known_issues`)
- [ ] Chạy lại `export_dashboard_data.py` cho dashboard khớp dữ liệu mới
- [ ] **Done khi:** `python -m app.data.build_panel` ra panel đầy đủ cột, không lỗi, không bước tay

---

# LUỒNG B — Nền móng mô hình 🧬

> Toàn bộ luồng này **chỉ cần cột `cases` đã có** — bắt đầu ngay, không chờ Luồng A.

## B1. Bộ chỉ số đánh giá (`app/forecast/metrics.py`)

Làm trước tiên vì mọi thứ sau đều cần nó.

- [ ] `mase()` — Mean Absolute Scaled Error, metric **chính** ([docs/02 §5.1](docs/02-phuong-phap-mo-hinh.md#51-bài-toán-hồi-quy))
- [ ] ⚠️ **Bẫy quan trọng:** mẫu số MASE (sai số của seasonal naive) phải tính **chỉ trên tập train**, không được tính trên toàn bộ dữ liệu — tính sai là rò rỉ thông tin tương lai
- [ ] `mae()`, `rmse()`, `poisson_deviance()`, `bias()`
- [ ] `pr_auc()`, `recall_at_precision()`, `brier_score()` cho bài toán cảnh báo
- [ ] `lead_time()` — trung vị số tuần cảnh báo trước đỉnh dịch (đây là **con số bán hàng**)
- [ ] Unit test cho từng hàm với ví dụ tính tay được
- [ ] **Done khi:** `pytest tests/test_forecast/test_metrics.py` pass

## B2. Chia tập & chống rò rỉ (`app/forecast/splits.py`)

- [ ] `make_splits()` — rolling-origin, cửa sổ mở rộng (expanding), tối thiểu 5 origin
- [ ] Tham số `embargo_months` = horizon dài nhất (6), chừa khoảng trống train↔validation
- [ ] Tham số `reporting_delay_months` (mặc định `D=1`) — mô phỏng đúng độ trễ báo cáo thật ([docs/01 §6 Bẫy 3](docs/01-chien-luoc-du-lieu.md#6-các-bẫy-rò-rỉ-dữ-liệu-phải-tránh))
- [ ] ⚠️ **Ràng buộc cứng phải cài vào code, không chỉ ghi tài liệu:** tập **test** chỉ được lấy từ dòng `data_source == "real"` (tức 1994–2010). Hàm phải **raise lỗi** nếu ai đó vô tình đưa dòng `estimated` vào test
- [ ] Unit test: chứng minh không có điểm nào của tương lai lọt vào train (đưa vào chuỗi có giá trị bất thường ở tương lai → fold train không đổi)
- [ ] Unit test: embargo thật sự có khoảng trống
- [ ] **Done khi:** test pass + in ra được bảng các fold (train từ đâu tới đâu, test từ đâu tới đâu)

## B3. `exp_001` — Bốn baseline ⭐ quan trọng nhất luồng này

Không có baseline thì **mọi con số accuracy về sau đều vô nghĩa** ([docs/02 §3](docs/02-phuong-phap-mo-hinh.md#tier-0--baseline-bắt-buộc-làm-trước)).

- [ ] Dựng `experiments/exp_001_baselines/` theo cấu trúc ở [docs/03 §1](docs/03-quy-trinh-thuc-nghiem.md#1-cấu-trúc-thư-mục-thực-nghiệm)
- [ ] **B1 Persistence** — dự báo `t+h` = giá trị tại `t−D`
- [ ] **B2 Seasonal naive** ⭐ — dự báo `t+h` = cùng tháng năm trước (đây là mốc chuẩn, MASE = 1.0 theo định nghĩa)
- [ ] **B3 Climatology** — trung bình lịch sử của tháng đó tại tỉnh đó
- [ ] **B4 GLM Poisson** — hồi quy Poisson với mùa vụ (chưa cần khí hậu, thêm sau khi Luồng A xong)
- [ ] Chạy trên 4 horizon (h = 1, 2, 3, 6), báo cáo **trung bình ± độ lệch chuẩn** qua các origin
- [ ] Viết `RESULTS.md` đầy đủ theo template ([docs/03 §4](docs/03-quy-trinh-thuc-nghiem.md#4-resultsmd--bắt-buộc-cho-mọi-thí-nghiệm)) — đặc biệt mục *"Điều bất ngờ / nghi vấn"*
- [ ] **Done khi:** có bảng số baseline cho từng horizon — đây là mốc để so mọi model ở Phase 2

## B4. EDA — hiểu dữ liệu trước khi mô hình hoá

- [ ] Notebook `notebooks/01_eda_panel.ipynb`
- [ ] Chuỗi thời gian ca bệnh theo 3 vùng (Bắc/Trung/Nam) — có thật sự khác nhau không?
- [ ] Tính mùa vụ: đỉnh dịch rơi vào tháng nào, có khác giữa các vùng không?
- [ ] Thống kê khuyết thiếu theo tỉnh × năm
- [ ] So sánh phân phối `real` vs `estimated` — ước lượng có lệch hệ thống không?
- [ ] **(Sau khi Luồng A xong)** Tương quan chéo khí hậu ↔ ca bệnh theo từng độ trễ 1–6 tháng
      ⚠️ Đừng giả định "1–3 tháng là mạnh nhất" — **đo rồi mới kết luận**, con số này quyết định thiết kế đặc trưng ở Phase 2
- [ ] Minh Dương rà soát dưới góc nhìn y sinh: có gì vô lý về mặt dịch tễ không?

---

# Việc chốt lại cuối phase 🤝

- [ ] Viết note kiểm chứng cho từng nguồn trong `docs/data-sources/`: URL, cách tải, độ phủ thật, giấy phép, ngày kiểm chứng
      (`opendengue.md`, `era5.md`, `population.md`, `oni.md`, `boundaries.md`, `hcdc.md`, `nso.md`)
- [ ] **Khảo sát nguồn NSO cấp tỉnh** — nguồn `real` tiềm năng duy nhất cho giai đoạn gần đây; trang tỉnh cũ (`*.gso.gov.vn`) đã chết, cần dò lại cấu trúc `nso.gov.vn` mới
- [ ] Cập nhật `docs/01 §9` — tick các mục đã xong
- [ ] **Kiểm tra tái lập chéo:** Nam Hải chạy lại `exp_001` của Minh Dương, Minh Dương chạy lại `build_panel` của Nam Hải — sai khác < 1%
- [ ] Rà soát cổng nghiệm thu 6 điểm ở đầu file này

---

## Hoãn lại có chủ đích (KHÔNG làm ở phase này)

Ghi rõ để khỏi phân tâm — đây là quyết định, không phải bỏ sót:

| Việc | Vì sao hoãn |
|---|---|
| **Backend Go** (`go mod init`, Gin, JWT) | Không nằm trên đường găng. Chưa có model thật thì chưa có gì để phục vụ. Làm khi chuẩn bị pilot |
| **FastAPI serving** (`app/main.py`, routes) | Như trên — Phase 2 xong model mới cần expose |
| **`infra/docker-compose.yml`** | Chỉ cần khi có nhiều service chạy cùng. Hiện pipeline chạy bằng script là đủ |
| **Ingest HCDC (parse NLP)** | Tốn công cao, giá trị thấp: chỉ ra được chuỗi **cấp thành phố** + tên phường nóng, không đủ làm nhãn cấp phường ([docs/01 §2.1b](docs/01-chien-luoc-du-lieu.md#21b-kế-hoạch-trích-xuất-hcdc-parse-văn-bản-không-phải-scrape-bảng)). Để sau khi có kết quả công văn |
| **Nâng dashboard lên dữ liệu động** | Prototype đã đủ cho báo cáo tiến độ. Nối API thật khi có model thật |

---

## Rủi ro của riêng phase này

| Rủi ro | Dấu hiệu sớm | Xử lý |
|---|---|---|
| CDS duyệt chậm / API lỗi | Hết 25/09 chưa tải được file test | Dùng **CHIRPS** (mưa) + nguồn nhiệt độ khác thay tạm; hoặc Google Earth Engine |
| Không tìm được dân số theo năm | Hết tuần 1 chưa có nguồn | Tạm dùng `cases` tuyệt đối làm biến mục tiêu, ghi rõ hạn chế; bổ sung incidence sau |
| ERA5 tải quá lâu | Tải 1 năm > 30 phút | Giảm phạm vi: 2000–2025 thay vì 1994, hoặc hạ độ phân giải |
| Luồng B xong sớm, phải chờ Luồng A | Minh Dương hết việc trước 05/10 | Cho chạy sớm `exp_003` (ablation đặc trưng mùa vụ) hoặc bắt đầu đọc tài liệu Phase 2 |
