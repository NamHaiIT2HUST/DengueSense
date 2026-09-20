# 01 — Chiến lược dữ liệu

> Dữ liệu quyết định trần chất lượng của model. Không có thuật toán nào cứu được dữ liệu sai đơn vị, rò rỉ tương lai, hoặc không tái lập được.

---

## 1. Nguyên tắc

1. **Hai đường song song.** Đường A (dữ liệu chính thức HCDC/Bộ Y tế) không chắc chắn về thời gian → không được chặn tiến độ. Đường B (nguồn công khai) phải đủ để ra sản phẩm đứng một mình.
2. **Raw không bao giờ bị sửa.** Dữ liệu tải về giữ nguyên trạng ở `data/raw/`, chỉ đọc. Mọi biến đổi sinh ra file mới ở `data/interim/` → `data/processed/`. Lỗi pipeline thì chạy lại từ raw, không vá tay.
3. **Mọi dataset có version.** Một con số kết quả phải truy được về đúng phiên bản dữ liệu sinh ra nó.
4. **Nguồn nào cũng phải kiểm chứng trước khi phụ thuộc.** Danh sách dưới đây là điểm khởi đầu — bước đầu tiên của Phase Dữ liệu là xác minh từng nguồn còn sống, còn cho tải, và giấy phép cho phép dùng.

---

## 2. Danh mục nguồn dữ liệu

### 2.1 Dữ liệu dịch tễ (biến mục tiêu)

| Nguồn | Phạm vi / độ phân giải | Ưu tiên | Ghi chú |
|---|---|---|---|
| **OpenDengue** (LSHTM) | Việt Nam: cấp tỉnh (admin1) **CHỈ 1994-02 → 2010-12**; cấp quốc gia (admin0) 1960-2025 | 🥇 Cao nhất | ✅ **Đã tải & xử lý thật 20/09/2026** — không còn là kế hoạch, đã có code chạy được (`app/data/ingest_opendengue.py`). Kết quả đo thật: **6.776 dòng (tỉnh×tháng)** phủ đủ 34/34 tỉnh mới cho 1994-2010; **KHÔNG có** breakdown theo tỉnh cho 2011-2025 (chỉ có tổng quốc gia, xem §2.1c) |
| **HCDC** (hcdc.vn) | TP.HCM, cấp quận/phường, theo tuần | 🥇 Cao | ⚠️ **Đã kiểm chứng 20/09/2026**: không phải bảng/CSV tải được — mỗi tuần là **1 bài viết dạng văn xuôi** (vd *"tuần 19 ghi nhận 466 ca SXH... các phường tỷ lệ mắc cao: An Nhơn Tây, Tây Nam..."*). Phải: (1) crawl toàn bộ URL bài theo tuần từ 2019, (2) **parse bằng regex/NLP** để trích số + tên phường ra khỏi câu văn — không phải scrape bảng HTML đơn giản, (3) chuẩn hoá tên phường/quận. Tốn công hơn dự tính ban đầu — xem §2.1b. **Chưa code, còn ở dạng kế hoạch** |
| **Cục Y tế Dự phòng / Bộ Y tế** | Toàn quốc, báo cáo định kỳ | 🥈 Trung bình | Định dạng không thống nhất, nhiều bản PDF → tốn công parse |
| **NSO cấp tỉnh** (trước là GSO) | Có thể tới cấp tỉnh, theo tháng (báo cáo "Tình hình KT-XH") | 🥈 Trung bình — **CHƯA XÁC MINH** | ⚠️ **Phát hiện 20/09/2026**: Tổng cục Thống kê (GSO) đã đổi tên/tổ chức lại thành **Cục Thống kê (NSO)** thuộc Bộ Tài chính, cùng đợt cải cách hành chính 2025. Toàn bộ subdomain cấp tỉnh cũ (`cucthongke<tinh>.gso.gov.vn`) **đã chết**. Có bằng chứng gián tiếp (qua kết quả tìm kiếm cũ) rằng các cục thống kê tỉnh từng công bố báo cáo tháng có mục số ca SXH — **đây có thể là nguồn DUY NHẤT cho dữ liệu cấp tỉnh THẬT của giai đoạn gần đây**, quan trọng hơn cả HCDC. Cần khảo sát lại cấu trúc trang mới `nso.gov.vn` — xem §2.1c và việc cần làm ở ROADMAP Phase 1 |
| **WHO WPRO Dengue Situation Update** | Cấp quốc gia | 🥉 Thấp | Dùng để sanity-check tổng toàn quốc |
| **HCDC/Bộ Y tế qua công văn chính thức** | Cấp quận/xã, theo tuần/tháng | 🎯 Đường A | Mục tiêu lý tưởng. Gửi công văn sớm, đừng chờ. Không chặn tiến độ |

> **Việc đầu tiên phải làm:** với mỗi nguồn trên, viết 1 note ngắn trong `docs/data-sources/<ten-nguon>.md` ghi: URL, cách tải, độ phủ thực tế (năm nào đến năm nào, bao nhiêu đơn vị), giấy phép, ngày kiểm chứng. Nguồn nào không xác minh được thì gạch khỏi kế hoạch, không để trong tài liệu như thể đã có.

### 2.1b Kế hoạch trích xuất HCDC (parse văn bản, không phải scrape bảng)

Vì dữ liệu HCDC nằm trong văn xuôi chứ không phải bảng, việc lấy dữ liệu này là một **mini-pipeline NLP** riêng, không phải 1 dòng `pandas.read_html()`:

```
1. Crawl danh sách URL bài "Tình hình dịch bệnh SXH..." theo tuần
   (mẫu URL: hcdc.vn/tinh-hinh-dich-benh-sot-xuat-huyet-...-tuan-<N><year>-<hash>.html)
   → liệt kê được qua sitemap hoặc mục "Sốt xuất huyết - Chikungunya"

2. Với mỗi bài, trích 2 loại thông tin bằng regex có kiểm tra thủ công mẫu đầu:
   a. Số liệu cấp thành phố:  "<N> trường hợp mắc bệnh sốt xuất huyết"
                              "giảm/tăng <X>%"
                              "tích lũy ... <N> ca"
   b. Danh sách phường/xã tỷ lệ mắc cao — CHỈ LÀ TÊN, không có số cụ thể theo phường
      → đây là dữ liệu ĐỊNH TÍNH (phường nào đang nóng), không phải ĐỊNH LƯỢNG
        (không dùng làm nhãn hồi quy được, chỉ dùng làm tín hiệu bổ sung/validate)

3. Chuẩn hoá tên phường/xã qua bảng crosswalk (§3) — tên trong bài viết
   có thể dùng tên cũ (trước sáp nhập 2025)

4. QA bắt buộc: lấy ngẫu nhiên 15-20 bài, đối chiếu tay số đã parse với
   văn bản gốc — sai số cho phép: 0 (đây là số liệu y tế, không làm tròn)
```

⚠️ **Hệ quả quan trọng cần biết trước:** vì HCDC chỉ nêu **tổng số ca cấp thành phố** + **danh sách tên phường nóng** (không có số ca theo từng phường), nguồn này **không tự nó tạo ra được** bảng `(phường, tuần) → số ca` đầy đủ. Nó chỉ dùng để:
- Có chuỗi thời gian **cấp thành phố** đáng tin (đối chiếu/hiệu chỉnh OpenDengue)
- Có tín hiệu **phường nào đang là điểm nóng** (dùng làm nhãn phụ, không phải nhãn chính)

**Muốn có bảng số ca đầy đủ theo quận/phường thì vẫn cần Đường A (công văn xin dữ liệu thô từ HCDC/Bộ Y tế)** — đây chính là lý do đường công văn không chỉ là "làm cho chắc" mà là **con đường duy nhất tới dữ liệu đủ chi tiết cho MVP**, nếu muốn phân bổ nguồn lực ở độ phân giải dưới cấp tỉnh.

### 2.1c Ước lượng cấp tỉnh cho giai đoạn 2011-2025 (ĐÃ CHỐT: Phương án 2 — small-area estimation)

**Bối cảnh:** OpenDengue chỉ có breakdown theo tỉnh tới 2010. Sau 2010 chỉ có tổng quốc gia (thật, đầy đủ tới 2025). Ba phương án đã cân nhắc — xem thảo luận đầy đủ ở lịch sử quyết định dự án; **đã chốt Phương án 2**.

**Phương pháp (đã code, đã test — `app/data/estimate_province.py`):**

```
Với mỗi tháng gần đây (2011+):
    ước_lượng[tỉnh, tháng] = tổng_quốc_gia_THẬT[tháng] × tỉ_trọng[tỉnh, tháng-trong-năm]

Trong đó tỉ_trọng[tỉnh, tháng-trong-năm] = trung bình lịch sử (1994-2010) của
    dengue_total[tỉnh, tháng-trong-năm] / tổng cả nước cùng tháng-trong-năm
```

Điểm quan trọng: tỉ trọng tính **theo từng tháng trong năm riêng** (1-12), không phải 1 con số cố định cả năm — để giữ được khác biệt mùa vụ giữa các tỉnh (vd tỉnh nào đỉnh dịch tháng 7-9, tỉnh nào tháng 10-12).

**Property bắt buộc, đã có unit test:** tổng ước lượng của 34 tỉnh trong 1 tháng phải **khớp đúng** tổng quốc gia thật của tháng đó (bảo toàn tổng) — `tests/test_data/test_estimate_province.py::test_conservation_of_total_per_month`.

**Hạn chế đã biết — PHẢI ghi trong mọi báo cáo dùng số này:**

- Giả định phân bố dịch theo tỉnh **không đổi qua 15+ năm** — không đúng ở năm bất thường. Ví dụ cụ thể: năm 2023 dịch bùng ở **Hà Nội** thay vì tập trung miền Nam như thông lệ lịch sử ([docs/00 §C.0](00-review-hien-trang.md#c0--con-số-895-không-sống-nổi-khi-đặt-cạnh-tài-liệu-mới)) — tỉ trọng đóng băng 1994-2010 sẽ **đánh giá thấp** rủi ro Hà Nội năm đó.
- Đây là lý do §2.1c cần được **thay thế dần** bằng tỉ trọng gần đây hơn — ngay khi nguồn NSO cấp tỉnh (§2.1) được xác minh dùng được.

**Quy tắc gắn nhãn — không thương lượng:**

Mọi dòng sinh ra từ bước này gắn `data_source = "estimated"` — khác `"real"` (đo trực tiếp) và `"imputed"`/`"simulated"` (xem §8). Không được gộp chung "estimated" vào "real" trong bất kỳ báo cáo nào.

**Kết quả chạy thật (v0.1.0, 20/09/2026):**

| | |
|---|---|
| Dòng `real` (1994-2010, từ OpenDengue Admin1) | 6.776 |
| Dòng `estimated` (2011-2025, disaggregate từ Admin0) | 2.550 |
| Tổng | 9.326 dòng, phủ đủ 34/34 tỉnh |
| Tỉ lệ dữ liệu thật | **72,7%** |

### 2.2 Dữ liệu khí hậu (biến giải thích chính)

| Nguồn | Biến | Độ phân giải | Cách lấy |
|---|---|---|---|
| **ERA5-Land** (Copernicus CDS) | Nhiệt độ 2m, lượng mưa, điểm sương (→ độ ẩm) | ~9km, theo giờ → gộp theo tháng | API `cdsapi`, cần đăng ký tài khoản CDS free |
| **CHIRPS** (UCSB) | Lượng mưa | 0.05°, theo ngày | Tải trực tiếp, dùng để đối chiếu chéo với ERA5 |
| **NOAA CPC — ONI / Niño 3.4** | Chỉ số ENSO | Toàn cầu, theo tháng | File text công khai, rất nhẹ |
| **Google Earth Engine** | ERA5 + CHIRPS | — | Phương án thay thế nếu tải cục bộ quá nặng |

Lưu ý kỹ thuật: ERA5 là dữ liệu **lưới (raster)**, cần gộp không gian (zonal statistics) về đơn vị hành chính bằng ranh giới ở §2.4. Gộp theo **trung bình có trọng số dân số** hợp lý hơn trung bình đơn thuần — vì muỗi và người tập trung ở khu dân cư, không rải đều trên diện tích tỉnh.

### 2.3 Dữ liệu dân số / kinh tế xã hội

| Nguồn | Dùng làm gì |
|---|---|
| **WorldPop** | Dân số theo lưới → gộp về đơn vị hành chính, dùng làm mẫu số tính tỉ lệ mắc (incidence rate) và trọng số gộp khí hậu |
| **GSO** | Dân số, mật độ, tỉ lệ đô thị hoá theo tỉnh |

Quan trọng: **biến mục tiêu nên là tỉ lệ mắc trên 100.000 dân, không phải số ca tuyệt đối** — nếu không, model sẽ chỉ học được "tỉnh đông dân thì nhiều ca", một điều hiển nhiên và vô dụng cho việc phân bổ nguồn lực.

### 2.4 Ranh giới hành chính (GIS)

| Nguồn | Ghi chú |
|---|---|
| **GADM** | Phổ biến, nhưng nhiều khả năng là ranh giới **trước 2025** → dùng cho dữ liệu lịch sử |
| **OCHA HDX — COD-AB Vietnam** | Bộ ranh giới chuẩn nhân đạo, kiểm tra xem đã cập nhật 34 tỉnh chưa |
| **Cổng dữ liệu quốc gia / Bộ TN&MT** | Nguồn chính thức cho ranh giới sau sáp nhập 2025 |

---

## 3. Chuẩn hoá đơn vị không gian (BẮT BUỘC LÀM TRƯỚC)

Đây là task nền móng — làm sai thì mọi thứ phía sau sai theo, và sửa về sau rất đắt.

### Vấn đề

```
Dữ liệu lịch sử 2001-2024  →  63 tỉnh, ~700 huyện   (ranh giới cũ)
Pitch hiện tại              →  570 quận/huyện        (đơn vị không còn tồn tại)
Triển khai thật 2026+       →  34 tỉnh, 3.321 xã     (ranh giới mới, NQ 202/2025/QH15)
```

### Quyết định cần chốt

**Khuyến nghị: dùng 34 tỉnh mới làm đơn vị phân tích chuẩn cho MVP.**

Lý do:
- Là đơn vị **đang tồn tại** → nói chuyện với Sở Y tế được ngay, không phải giải thích
- Dữ liệu lịch sử cấp tỉnh **gộp lên được** (tổng số ca của các tỉnh cũ → tỉnh mới), trong khi cấp xã thì **không tách xuống được** từ dữ liệu cũ
- 34 chuỗi × 288 tháng đủ để train model global pooled
- Khi có dữ liệu chi tiết hơn (đường A), hạ xuống cấp xã sau — kiến trúc không cần đổi

### Việc phải làm

- [x] Xây bảng `crosswalk_province.csv`: `old_province_name, new_province_code, new_province_name, merge_type, notes` — **63 tỉnh cũ → 34 tỉnh mới**, đối chiếu 2 nguồn, khớp số chính thức (52 gộp thành 23 + 11 giữ nguyên = 63)
- [x] `province_metadata.csv` — vùng miền (Bắc/Trung/Nam), có phải TP trực thuộc TW (6 thành phố: Hà Nội, Hải Phòng, Đà Nẵng, HCM, Cần Thơ, Huế)
- [x] Viết hàm `to_canonical_unit(df, province_col, value_cols, agg)` trong `app/data/crosswalk.py` — mọi dataset đi qua hàm này trước khi vào `data/processed/`
- [x] Unit test bảo toàn tổng — `tests/test_data/test_crosswalk.py`, 14 test, tất cả pass
- [x] Trường hợp không phải 1-1 (Hồ Chí Minh ← 3 tỉnh cũ, Ninh Bình ← 3 tỉnh cũ...) — xử lý bằng `groupby().sum()`, không cần phân bổ theo dân số/diện tích vì đây là ca bệnh tuyệt đối (cộng dồn đúng, không phải chia nhỏ)
- [x] Alias riêng cho tên viết tắt/ASCII của OpenDengue (`opendengue_province_alias.csv`) — phát hiện thêm 1 lớp phức tạp: **"HA TAY"** xuất hiện trong dữ liệu lịch sử (tỉnh đã sáp nhập vào Hà Nội từ 2008, khác đợt cải cách 2025) — đã map riêng, có ghi chú rõ trong file

---

## 4. Cấu trúc thư mục dữ liệu

**Trạng thái thật hiện tại** (khác vài chỗ so với kế hoạch ban đầu — đã build và chạy được):

```
ai-service/
├── app/data/                     # CODE — đã viết, đã test (20 test pass)
│   ├── crosswalk.py               # to_canonical_unit(), load_crosswalk()
│   ├── ingest_opendengue.py       # download() + load_admin0/admin1()
│   ├── estimate_province.py       # small-area estimation, xem §2.1c
│   └── build_panel.py             # orchestrate -> panel_monthly.parquet
├── data/
│   ├── raw/opendengue/            # zip tải về, gitignored
│   │   └── Spatial_extract_V1_3.zip
│   ├── processed/v0.1.0/          # gitignored
│   │   ├── panel_monthly.parquet  # ĐÃ SINH RA THẬT — 9.326 dòng
│   │   └── manifest.json          # xem §5, số liệu thật không phải ví dụ
│   └── external/                  # CÓ commit — nhẹ, quan trọng
│       ├── crosswalk_province.csv
│       ├── province_metadata.csv
│       └── opendengue_province_alias.csv
└── tests/test_data/
    ├── test_crosswalk.py          # 14 test
    └── test_estimate_province.py  # 6 test
```

Chạy lại toàn bộ từ đầu bằng 1 lệnh: `python -m app.data.build_panel` (tự tải OpenDengue nếu chưa có, tự ghi panel + manifest).

**Bảng chính `panel_monthly.parquet` — trạng thái hiện tại (v0.1.0):**

| Cột | Kiểu | Mô tả | Trạng thái |
|---|---|---|---|
| `province_id` | str | Mã tỉnh chuẩn (34 tỉnh mới) | ✅ có |
| `month` | date | Tháng đầu kỳ | ✅ có |
| `cases` | float | Số ca (real 1994-2010 hoặc estimated 2011-2025) | ✅ có |
| `data_source` | str | `real` / `estimated` — xem §8 để biết đủ 4 giá trị có thể có | ✅ có |
| `population` | int | Dân số ước tính (WorldPop) | ⏳ chưa — Phase 1 tiếp theo |
| `incidence_per_100k` | float | **Biến mục tiêu chính** (tính từ cases/population) | ⏳ chưa — cần population trước |
| `temp_mean`, `precip_total`, `humidity_mean` | float | Khí hậu (ERA5) | ⏳ chưa — cần đăng ký CDS API key |
| `oni` | float | Chỉ số ENSO | ⏳ chưa — nguồn nhẹ, làm nhanh được |
| `reported_at` | date | Độ trễ báo cáo, xem §6 | ⏳ chưa cần thiết ở v0.1.0 (chưa train model) |

---

## 5. Versioning dữ liệu

Dùng quy ước thư mục + `manifest.json` (chưa cần DVC ở quy mô hiện tại — cân nhắc thêm khi số version tăng nhiều).

Manifest **thật**, sinh tự động bởi `build_panel.py` (không phải ví dụ minh hoạ):

```json
{
  "version": "0.1.0",
  "created_at": "2026-09-20T15:18:58Z",
  "sources": [
    {
      "name": "opendengue_admin1",
      "role": "real (province-month ground truth)",
      "coverage": "1994-02-01 .. 2010-12-01",
      "n_rows": 6776
    },
    {
      "name": "opendengue_admin0 + small-area estimation",
      "role": "estimated (KHÔNG PHẢI số đo thật — xem docs/01 §2.1c)",
      "coverage": "sau 2010-12-01",
      "n_rows": 2550
    }
  ],
  "spatial_unit": "province_34_2025",
  "temporal_range": ["1994-02-01", "2025-03-01"],
  "n_rows": 9326,
  "n_provinces": 34,
  "real_data_pct": 72.7,
  "known_issues": [
    "Cột khí hậu (ERA5) chưa có ở version này.",
    "Cột HCDC/NSO cấp tỉnh gần đây chưa có — đang khảo sát.",
    "Phần 'estimated' dùng tỉ trọng lịch sử 1994-2010, có thể sai ở năm bất thường (vd 2023 Hà Nội)."
  ]
}
```

Quy tắc tăng version: `MAJOR` khi đổi đơn vị không gian/schema · `MINOR` khi thêm nguồn/biến (vd thêm khí hậu → v0.2.0) · `PATCH` khi sửa lỗi dữ liệu.

---

## 6. Các bẫy rò rỉ dữ liệu phải tránh

> Rò rỉ dữ liệu là nguyên nhân số 1 khiến model đẹp trên giấy và sụp khi deploy. Với bài toán dịch tễ, có 5 bẫy cụ thể:

### Bẫy 1 — Xáo trộn ngẫu nhiên (random shuffle) ❌ NGHIÊM TRỌNG NHẤT

`train_test_split(shuffle=True)` hay `KFold` thông thường đặt dữ liệu tương lai vào tập train. Kết quả sẽ **rất đẹp** và **hoàn toàn vô nghĩa**.

✅ Chỉ dùng chia theo thời gian: `TimeSeriesSplit`, hoặc rolling-origin tự viết (xem §7).

### Bẫy 2 — Tiền xử lý fit trên toàn bộ dữ liệu

Chuẩn hoá (`StandardScaler`), điền khuyết (imputer), chọn feature... nếu `fit` trên toàn bộ dataset rồi mới chia tập → thống kê của tương lai đã rò vào train.

✅ Mọi bước tiền xử lý phải nằm **trong `sklearn.Pipeline`**, và pipeline đó được `fit` **chỉ trên fold train** của mỗi vòng CV.

### Bẫy 3 — Độ trễ báo cáo (quan trọng, dễ bỏ sót)

Ở thời điểm thật `t`, hệ thống **chưa có** số ca tháng `t` (độ trễ 2–4 tuần theo đúng bản thuyết minh nêu). Nếu backtest cho model dùng `cases[t-1]` mà thực tế lúc đó chưa có, kết quả là ảo.

✅ Quy tắc: khi dự báo cho tháng `t + h`, feature chỉ được dùng dữ liệu ca bệnh đến hết tháng `t − D`, với `D` = độ trễ báo cáo (mặc định **D = 1 tháng**, ghi rõ trong config).
✅ Dữ liệu khí hậu/ENSO có độ trễ ngắn hơn → cho phép `D_climate = 0`, nhưng ghi rõ giả định.

### Bẫy 4 — Số liệu bị hiệu chỉnh về sau (revision)

Số ca của tháng 3 công bố lần đầu khác với con số chốt lại sau 6 tháng. Train trên số đã chốt nhưng deploy lại nhận số sơ bộ → lệch phân phối.

✅ Lý tưởng: lưu "dữ liệu như đã biết tại thời điểm đó" (vintage data) qua cột `reported_at`.
✅ Thực tế nếu không có: ghi nhận đây là **hạn chế đã biết** trong model card, đừng giả vờ không tồn tại.

### Bẫy 5 — Rò rỉ không gian

Các tỉnh lân cận tương quan mạnh. Nếu chia tập ngẫu nhiên theo tỉnh, thông tin từ tỉnh kề có thể rò sang.

✅ Khi kiểm tra khái quát hoá không gian, giữ nguyên **cả tỉnh** ở một phía (leave-one-province-out), không trộn.

---

## 7. Thiết kế chia tập

### 7.1 Chia ba tầng theo thời gian

Giả định dữ liệu 2001–2024:

```
├──────────── TRAIN ────────────┤├─── VALIDATION ───┤├────── TEST (KHOÁ) ──────┤
        2001 — 2016                  2017 — 2020            2021 — 2024
         (16 năm)                     (4 năm)                 (4 năm)
                                  ↑ tuning, chọn model      ↑ CHỈ MỞ 1 LẦN
```

| Tập | Dùng để | Quy tắc |
|---|---|---|
| **Train** | Học tham số model | — |
| **Validation** | Tuning siêu tham số, chọn model, chọn ngưỡng cảnh báo | Chạy bao nhiêu lần cũng được |
| **Test** | Con số cuối cùng đưa vào hồ sơ/báo cáo | **Chạm đúng 1 lần** ở cổng quyết định. Mỗi lần chạm thêm phải ghi vào log và số liệu mất dần giá trị |

**Embargo:** giữa train và validation chừa khoảng trống = horizon dự báo dài nhất (6 tháng), tránh việc nhãn của điểm train cuối cùng nằm trong khoảng validation.

### 7.2 Rolling-origin backtest (dùng trong train + validation)

Đây là cách đánh giá đúng cho dự báo chuỗi thời gian — mô phỏng đúng cách model sẽ được dùng thật: đứng tại một thời điểm, chỉ biết quá khứ, dự báo tương lai.

```
Vòng 1:  train[2001-2014]  →  dự báo 2015          
Vòng 2:  train[2001-2015]  →  dự báo 2016          (cửa sổ mở rộng)
Vòng 3:  train[2001-2016]  →  dự báo 2017
...
Vòng k:  train[2001-2019]  →  dự báo 2020
```

- Dùng **cửa sổ mở rộng (expanding)** làm mặc định — dữ liệu dịch tễ ít, vứt bỏ quá khứ là lãng phí.
- Thử thêm **cửa sổ trượt (sliding, ví dụ 10 năm gần nhất)** như một thí nghiệm riêng: nếu sliding thắng, đó là bằng chứng có **trôi khái niệm (concept drift)** — một phát hiện đáng báo cáo, liên quan trực tiếp tới rủi ro "trôi mô hình" trong đề án.
- Tối thiểu **5 origin** để số liệu có ý nghĩa thống kê. Báo cáo cả trung bình lẫn độ lệch chuẩn giữa các vòng.

### 7.3 Nested CV khi tuning

Tuning siêu tham số trên cùng tập dùng để đánh giá → số liệu lạc quan giả.

```
Vòng ngoài (đánh giá):  rolling-origin trên validation
  └── Vòng trong (tuning): rolling-origin trên phần train của vòng ngoài
```

Tốn thời gian tính toán hơn, nhưng là khác biệt giữa "số liệu dùng được" và "số liệu tự lừa mình". Nếu quá chậm: giảm số origin vòng trong xuống 3, đừng bỏ nested.

---

## 8. Xử lý dữ liệu không phải "real" — 4 loại, không được lẫn lộn

Cột `data_source` có đúng 4 giá trị hợp lệ, ý nghĩa khác nhau rõ ràng — dùng sai loại là báo cáo sai:

| Giá trị | Định nghĩa | Ví dụ trong dự án | Độ tin cậy |
|---|---|---|---|
| `real` | Đo trực tiếp, có nguồn xác định | OpenDengue Admin1 1994-2010; số liệu HCDC/NSO nếu xác minh được | Cao nhất |
| `estimated` | Suy diễn từ 1 số liệu thật khác qua phương pháp thống kê **có công thức rõ ràng, tổng được bảo toàn** | Cấp tỉnh 2011-2025, disaggregate từ tổng quốc gia thật — xem §2.1c | Trung bình, có sai số hệ thống đã biết |
| `imputed` | Điền khuyết cho lỗ hổng ngắn trong chuỗi vốn đã có dữ liệu thật xung quanh | Thiếu 1-2 tháng giữa chuỗi, nội suy tuyến tính/ARIMA | Trung bình, chỉ dùng cho lỗ hổng ngắn |
| `simulated` | Sinh hoàn toàn nhân tạo, không neo vào số đo thật nào của kỳ đó | Chỉ dùng nếu bắt buộc và phải ghi rõ mô hình sinh | Thấp nhất, tránh dùng nếu có thể |

Quy tắc áp dụng cho toàn bộ:

1. **Báo cáo tách theo từng loại**, không gộp `real` với 3 loại còn lại thành "có dữ liệu". Ít nhất phải tách `real` riêng khỏi phần còn lại.
2. **Không dùng `estimated`/`imputed`/`simulated` cho biến mục tiêu ở tập test.** Test phải 100% `real`, nếu không con số test vô nghĩa — xem hệ quả cụ thể ở [docs/03 §8](03-quy-trinh-thuc-nghiem.md#8-quy-tắc-dùng-tập-test): với hiện trạng dữ liệu, **tập test cấp tỉnh chỉ lấy được từ giai đoạn 1994-2010** cho tới khi có nguồn thật mới (NSO hoặc Đường A).
3. **Ghi rõ phương pháp sinh** trong manifest — với `estimated`, đã có sẵn code + test chứng minh; với `simulated` (nếu bắt buộc dùng), phải nêu rõ mô hình sinh — hội đồng sẽ hỏi.

---

## 9. Checklist nghiệm thu Phase Dữ liệu

Chỉ chuyển sang Phase Mô hình khi tất cả các mục sau đã xong:

- [x] `crosswalk_province.csv` + `province_metadata.csv` hoàn chỉnh + unit test bảo toàn tổng pass (14 test)
- [x] `panel_monthly.parquet` sinh ra được bằng **một lệnh**: `python -m app.data.build_panel` — v0.1.0 đã có, 9.326 dòng
- [x] `manifest.json` đầy đủ, ghi rõ `real_data_pct` (72,7%)
- [x] Phương pháp ước lượng cấp tỉnh (`estimate_province.py`) có unit test bảo toàn tổng (6 test) — xem §2.1c
- [ ] Mỗi nguồn dữ liệu còn lại (HCDC, NSO, ERA5, WorldPop) có 1 file note trong `docs/data-sources/` đã kiểm chứng
- [ ] Khảo sát nguồn NSO cấp tỉnh — xác định có dùng được để thay tỉ trọng đóng băng 1994-2010 không (ưu tiên cao, xem §2.1)
- [ ] Ghép thêm cột khí hậu (ERA5), dân số (WorldPop), ONI vào panel — cần đăng ký tài khoản CDS API trước
- [ ] Notebook EDA: chuỗi thời gian theo vùng, tính mùa vụ, tương quan chéo khí hậu–ca bệnh theo độ trễ, bản đồ phân bố, thống kê khuyết thiếu
- [ ] Hàm chia tập `make_splits()` (rolling-origin) có unit test chứng minh **không có điểm nào của tương lai lọt vào train**
- [ ] Baseline seasonal naive đã chạy và có số — đây là mốc để so mọi thứ về sau
