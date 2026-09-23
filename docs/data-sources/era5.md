# ERA5-Land monthly averaged data (Copernicus CDS)

- **URL dataset:** https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-monthly-means
- **URL API:** `https://cds.climate.copernicus.eu/api` (đổi sau đợt migrate API 02/2025 — URL cũ
  `/api/v2` không còn dùng được)
- **Cách tải:** thư viện `cdsapi` (Python), key cá nhân trong `~/.cdsapirc`. Code thật:
  `ai-service/app/data/ingest_era5.py`.
- **Dataset ID:** `reanalysis-era5-land-monthly-means`, `product_type: monthly_averaged_reanalysis`,
  biến: `2m_temperature`, `total_precipitation`, `2m_dewpoint_temperature` (độ ẩm không có sẵn, tự tính
  qua công thức Magnus từ nhiệt độ + điểm sương).
- **Độ phủ thực tế đã kiểm chứng:** 1994-01 → 2025-12 (32 năm × 12 tháng, đã tải đủ 32/32 file thật,
  không thiếu năm nào), bbox `[23.7, 101.8, 7.0, 118.2]` (N, W, S, E — bao trọn ranh giới 34 tỉnh kể
  cả Trường Sa/Hoàng Sa).
- **Độ phân giải:** ~9km lưới, gộp về 34 tỉnh bằng zonal mean (`app/data/zonal_stats.py`).
- **Giấy phép:** Copernicus licence — phải chấp nhận **2 lần riêng biệt**: ToS chung lúc đăng ký tài
  khoản CDS, VÀ licence riêng của dataset này (`.../reanalysis-era5-land-monthly-means?tab=download
  #manage-licences`). Thiếu bước 2 → lỗi `403 required licences not accepted`, không phải lỗi code.
- **Ngày kiểm chứng:** 23/09/2026 — tải thật 32 năm, verify: nhiệt độ 9.2-31.1°C, độ ẩm 44-97%, mưa
  0-1160mm/tháng (đúng thực tế khí hậu VN), 0 giá trị ngoài khoảng hợp lý trên 13.056 dòng zonal stats.

## Bẫy đã gặp thật (không phải lý thuyết)

1. **403 "required licences not accepted"** — xem mục Giấy phép ở trên.
2. **File `.nc` tải về thực chất là ZIP.** Hạ tầng CDS mới (sau 2025) đôi khi trả file đặt tên `.nc`
   nhưng nội dung là ZIP chứa 1 file `.nc` bên trong (tên `data_stream-moda.nc`), dù request đã khai
   đúng `data_format: "netcdf"`. `xarray.open_dataset()` báo lỗi "không tìm được engine phù hợp" nếu
   không xử lý. **Đã fix:** `load_and_convert()` tự phát hiện (đọc magic bytes ZIP `PK\x03\x04`) và
   tự giải nén trước khi mở, trong suốt với người gọi.
3. **Bbox hẹp làm sai zonal stat ở tỉnh có đảo xa.** Bbox áng chừng "đất liền VN" (vd
   `[23.5,102,8.2,110]`) hẹp hơn ranh giới hành chính thật — Khánh Hòa (Trường Sa) vươn tới 117.8E, Đà
   Nẵng (Hoàng Sa) tới 112.7E. Request theo bbox hẹp → zonal stat 2 tỉnh này bị "boundless read" sai
   lệch. Đã sửa bbox lấy theo `total_bounds` thật của `provinces.geojson` + biên an toàn.
4. **Đơn vị:** nhiệt độ Kelvin (trừ 273.15 ra °C), `total_precipitation` là mét/ngày trung bình của
   tháng (phải nhân 1000 × số ngày trong tháng để ra mm/tháng, không phải chỉ nhân 1000).
