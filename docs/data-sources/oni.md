# Chỉ số ENSO — ONI (NOAA CPC)

- **URL:** `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt`
  (⚠️ khác URL trong bản kế hoạch ban đầu — `origin.cpc.ncep.noaa.gov/.../ensostage/ONI_v5.php` là
  trang HTML hiển thị, không phải file dữ liệu tải trực tiếp được; URL trên mới đúng là file thô)
- **Cách tải:** `requests.get()` với header `User-Agent` (NOAA có lúc chặn request không có header
  này). Code thật: `ai-service/app/data/ingest_oni.py`.
- **Định dạng:** text, phân cách khoảng trắng, 4 cột `SEAS YR TOTAL ANOM`. `SEAS` là mã mùa 3 tháng
  trượt (DJF, JFM, FMA...), gắn với tháng **giữa** mùa đó (DJF → tháng 1, JFM → tháng 2, ...). Dùng cột
  `ANOM` (độ lệch nhiệt độ mặt biển so với chuẩn) làm giá trị ONI, không dùng `TOTAL`.
- **Độ phủ thực tế đã kiểm chứng:** 1950-01 → 2026-07 (919 dòng, cập nhật liên tục, không lỗ hổng
  tháng nào).
- **Giấy phép:** dữ liệu chính phủ Mỹ (NOAA), công khai, không cần đăng ký.
- **Dự phòng:** bản đã tải commit vào `ai-service/data/external/oni_raw.txt` (nhẹ, ~15KB) —
  `download()` tự fallback đọc file này nếu request lỗi.
- **Ngày kiểm chứng:** 23/09/2026 — tải thật, parse thật, 919 dòng, 0 null, 0 trùng lặp (year, month),
  tháng đúng đủ 1-12.
