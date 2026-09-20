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
| **OpenDengue** (LSHTM) | Toàn cầu, có Việt Nam cấp tỉnh (admin1), 1924–2023 | 🥇 Cao nhất | ⚠️ **Đã kiểm chứng 20/09/2026**: có thật 4.5 triệu ca VN ([Nature Sci Data 2024](https://www.nature.com/articles/s41597-024-03120-7)), nhưng độ phân giải **không đồng nhất theo năm/tỉnh**, và ít nhất 1 nghiên cứu khác đã phải **loại Việt Nam khỏi phân tích vì thiếu năm**. Điểm khởi đầu tốt nhất cho đường B, nhưng **phải tự vẽ bản đồ độ phủ** (năm nào/tỉnh nào có, năm nào thiếu) trước khi cam kết dùng — đừng giả định đầy đủ |
| **HCDC** (hcdc.vn) | TP.HCM, cấp quận/phường, theo tuần | 🥇 Cao | ⚠️ **Đã kiểm chứng 20/09/2026**: không phải bảng/CSV tải được — mỗi tuần là **1 bài viết dạng văn xuôi** (vd *"tuần 19 ghi nhận 466 ca SXH... các phường tỷ lệ mắc cao: An Nhơn Tây, Tây Nam..."*). Phải: (1) crawl toàn bộ URL bài theo tuần từ 2019, (2) **parse bằng regex/NLP** để trích số + tên phường ra khỏi câu văn — không phải scrape bảng HTML đơn giản, (3) chuẩn hoá tên phường/quận. Tốn công hơn dự tính ban đầu — xem §2.1b |
| **Cục Y tế Dự phòng / Bộ Y tế** | Toàn quốc, báo cáo định kỳ | 🥈 Trung bình | Định dạng không thống nhất, nhiều bản PDF → tốn công parse |
| **Tổng cục Thống kê (GSO)** | Cấp tỉnh, theo năm | 🥉 Thấp | Chỉ theo năm → quá thô cho dự báo tháng, nhưng tốt để đối chiếu/hiệu chỉnh tổng |
| **WHO WPRO Dengue Situation Update** | Cấp quốc gia | 🥉 Thấp | Dùng để sanity-check tổng toàn quốc |
| **HCDC/Bộ Y tế qua công văn chính thức** | Cấp quận/xã, theo tuần/tháng | 🎯 Đường A | Mục tiêu lý tưởng. Gửi công văn sớm, đừng chờ |

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

- [ ] Xây bảng `crosswalk_province.csv`: `old_province_code, old_province_name, new_province_code, new_province_name, merge_type`
- [ ] Xử lý các trường hợp không phải 1-1 (một tỉnh cũ bị tách sang 2 tỉnh mới) — ghi rõ quy tắc phân bổ (theo dân số? theo diện tích?) và **ghi lại giả định đó**
- [ ] Viết hàm `to_canonical_unit(df, from_schema)` — mọi dataset đi qua hàm này trước khi vào `data/processed/`
- [ ] Unit test: tổng số ca trước và sau khi ánh xạ phải bằng nhau (bảo toàn tổng)

---

## 4. Cấu trúc thư mục dữ liệu

```
ai-service/data/
├── raw/                          # tải về, KHÔNG BAO GIỜ SỬA, gitignored
│   ├── opendengue/
│   ├── hcdc/
│   ├── era5/
│   └── boundaries/
├── interim/                      # đã parse, chưa gộp, gitignored
├── processed/                    # sẵn sàng train, gitignored
│   └── v1.0.0/
│       ├── panel_monthly.parquet # bảng chính: (province_id, month) × features
│       └── manifest.json         # metadata version, xem §5
└── external/                     # crosswalk, bảng tra cứu — CÓ commit vào git (nhẹ, quan trọng)
    ├── crosswalk_province.csv
    └── province_metadata.csv
```

**Bảng chính `panel_monthly.parquet`** — dạng panel (bảng dọc), mỗi dòng là một cặp (khu vực, tháng):

| Cột | Kiểu | Mô tả |
|---|---|---|
| `province_id` | str | Mã tỉnh chuẩn (34 tỉnh mới) |
| `month` | date | Tháng đầu kỳ |
| `cases` | int | Số ca (đã hiệu chỉnh về đơn vị chuẩn) |
| `population` | int | Dân số ước tính |
| `incidence_per_100k` | float | **Biến mục tiêu chính** |
| `temp_mean`, `temp_min`, `temp_max` | float | Nhiệt độ, gộp theo trọng số dân số |
| `precip_total`, `precip_days` | float | Lượng mưa |
| `humidity_mean` | float | Độ ẩm tương đối |
| `oni` | float | Chỉ số ENSO tháng đó |
| `data_source` | str | `real` / `imputed` / `simulated` — **bắt buộc có**, xem §7 |
| `reported_at` | date | Thời điểm số liệu này thực sự khả dụng, xem §6 |

---

## 5. Versioning dữ liệu

Dùng **DVC** (hoặc tối thiểu là quy ước thư mục + manifest nếu chưa kịp setup DVC).

Mỗi phiên bản `data/processed/vX.Y.Z/` kèm `manifest.json`:

```json
{
  "version": "1.0.0",
  "created_at": "2026-09-25",
  "git_commit": "e4d5981",
  "sources": [
    {"name": "opendengue", "downloaded_at": "2026-09-20", "coverage": "2001-2023", "rows": 18144},
    {"name": "era5-land",  "downloaded_at": "2026-09-21", "coverage": "2001-2024"}
  ],
  "spatial_unit": "province_34_2025",
  "temporal_range": ["2001-01", "2024-12"],
  "n_rows": 9792,
  "real_data_pct": 87.3,
  "known_issues": ["Thiếu số ca 2020-03 đến 2020-06 cho 4 tỉnh — đã nội suy, cờ data_source=imputed"]
}
```

Quy tắc tăng version: `MAJOR` khi đổi đơn vị không gian/schema · `MINOR` khi thêm nguồn/biến · `PATCH` khi sửa lỗi dữ liệu.

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

## 8. Xử lý dữ liệu mô phỏng (nếu vẫn phải dùng)

Nếu đến hạn vẫn chưa có đủ dữ liệu thật và buộc phải bổ sung dữ liệu mô phỏng:

1. **Cờ bắt buộc:** cột `data_source ∈ {real, imputed, simulated}` trên mọi dòng.
2. **Báo cáo tách đôi:** luôn có 2 bảng kết quả — *chỉ trên dữ liệu thật* và *trên toàn bộ*. Con số đưa ra ngoài là con số trên dữ liệu thật.
3. **Không mô phỏng biến mục tiêu ở tập test.** Test phải 100% `real`, nếu không thì con số test vô nghĩa.
4. **Ghi rõ phương pháp sinh** trong manifest (mô hình SEIR? lấy mẫu bootstrap? nội suy?) — hội đồng sẽ hỏi.

---

## 9. Checklist nghiệm thu Phase Dữ liệu

Chỉ chuyển sang Phase Mô hình khi tất cả các mục sau đã xong:

- [ ] Mỗi nguồn dữ liệu có 1 file note trong `docs/data-sources/` đã kiểm chứng
- [ ] `crosswalk_province.csv` hoàn chỉnh + unit test bảo toàn tổng pass
- [ ] `panel_monthly.parquet` v1.0.0 sinh ra được bằng **một lệnh** từ raw (`make data` hoặc `python -m app.data.build`)
- [ ] `manifest.json` đầy đủ, ghi rõ `real_data_pct`
- [ ] Notebook EDA: chuỗi thời gian theo vùng, tính mùa vụ, tương quan chéo khí hậu–ca bệnh theo độ trễ, bản đồ phân bố, thống kê khuyết thiếu
- [ ] Hàm chia tập `make_splits()` có unit test chứng minh **không có điểm nào của tương lai lọt vào train**
- [ ] Baseline seasonal naive đã chạy và có số — đây là mốc để so mọi thứ về sau
