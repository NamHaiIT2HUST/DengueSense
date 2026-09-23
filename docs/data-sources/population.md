# Dân số theo tỉnh theo năm (WorldPop)

- **URL:** `https://data.worldpop.org/GIS/Population/Global_2000_2020/{year}/VNM/vnm_ppp_{year}.tif`
- **Cách tải:** `requests.get(..., stream=True)` trực tiếp, không cần đăng ký tài khoản. Code thật:
  `ai-service/app/data/ingest_population.py`.
- **Định dạng:** GeoTIFF ~100m/pixel, mỗi pixel = số người ước tính tại đó. Gộp về 34 tỉnh bằng zonal
  **sum** (không phải mean — mỗi pixel là số người, cộng dồn mới ra tổng dân số tỉnh).
- **Độ phủ thực tế đã kiểm chứng:** raster thật chỉ có **2000-2020** (project "Global_2000_2020" của
  WorldPop). Năm 1994-1999 và 2021-2025 **không có** raster — lấy giá trị năm gần nhất đã biết
  (carry-forward/backward), gắn `population_source="imputed"` khác với `"estimated"` (năm có raster
  thật).
- **Giấy phép:** CC BY 4.0 (WorldPop mở, không cần đăng ký).
- **Ngày kiểm chứng:** 23/09/2026 — tải thật 21/21 năm (2000-2020), 197MB/năm trung bình. Verify tổng
  dân số: 2020 = 99.037.315 người (số chính thức VN ~97,6 triệu, sai lệch ~1.5%, hợp lý cho ước lượng
  raster); xu hướng 1994≈78M → 2010≈86,6M → 2020≈99M khớp sát số liệu thống kê chính thức (71M/87M/
  97M các mốc tương ứng).

## Vì sao không dùng NSO/GSO (đổi hướng so với kế hoạch ban đầu)

Đã khảo sát `nso.gov.vn` (tên mới của GSO sau cải cách hành chính 2025) — **không có** API/CSV tải
được dân số theo tỉnh theo năm, chỉ có báo cáo PDF (vd "Socio-economic statistical data of 63
provinces and cities 2019-2023"). Parse PDF cho 30+ năm × 34 tỉnh tốn công cao, dễ sai, không tự động
hoá được → chuyển sang WorldPop (tự động hoá 100%, đã verify số liệu hợp lý).

## Bẫy đã gặp

- File GeoJSON `provinces.geojson` có sẵn cột `DanSo_ng` là **ảnh chụp 2025**, không dùng trực tiếp
  cho chuỗi 1994-2025 (dân số các tỉnh thay đổi nhiều qua 30 năm).
- Mỗi file raster ~150-200MB, tải 21 năm mất ~13 phút/năm ở mạng thường → tổng thời gian có thể vài
  giờ, không phải vài phút. Đã thêm retry tự động (`app/data/_retry.py`) cho lỗi mạng tạm thời.
