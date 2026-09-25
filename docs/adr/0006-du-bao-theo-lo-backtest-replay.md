# ADR-0006 — Dự báo tính theo lô, API chỉ đọc; backtest replay là chế độ demo chính

**Trạng thái:** accepted · 2026-09-25

## Bối cảnh
- Dữ liệu dịch tễ theo tháng, cập nhật theo đợt (docs/09 R2).
- Dữ liệu ca bệnh **thật** cấp tỉnh chỉ tới 2010; 2011–2025 là ước lượng (docs/01 §2.1c). Model card §2: không dùng cho quyết định tự động; kết quả tin cậy nhất là ở giai đoạn có dữ liệu thật.
- Fit M4-R2 cho 34 tỉnh × 4 tầm dự báo mất phút, không phải mili-giây.

## Quyết định
1. Dự báo là **forecast run** chạy nền (job), lưu kết quả bất biến; API đọc chỉ trả kết quả đã lưu (p95 < 300 ms). Mô hình **không bao giờ chạy trong request đồng bộ**.
2. Hai chế độ cùng một code path: `backtest` (tháng neo trong quá khứ có dữ liệu thật — **chế độ demo và đánh giá chính**) và `live_experimental` (đầu vào gần hiện tại có dữ liệu ước lượng — luôn gắn cờ `out_of_validated_period` / `estimated_inputs`).
3. Mọi số trả ra kèm provenance (`model_version`, `data_version`, `origin_month`, `run_id`); xác suất kèm `base_rate`; `cases_pred_interval` = `null` cho tới khi có khoảng đã kiểm chứng độ phủ.
4. Chỉ `model_version` ở trạng thái `approved` (có đánh giá nhiều mùa + cập nhật model card) được chạy live.

## Phương án đã cân nhắc
- **Chạy model theo request:** độ trễ cao, tốn RAM, khó tái lập; bị loại.
- **Chỉ có chế độ live:** không có dữ liệu thật gần đây để kiểm chứng ⇒ demo dựa trên số ước lượng, dễ gây hiểu lầm; bị loại.
- **Nạp thẳng file kết quả thí nghiệm vào DB:** nhanh nhưng bỏ qua đường code thật; chỉ cho phép dưới dạng job nhập có nhãn `source_experiment` để demo nhanh.

## Hệ quả
- (+) Trung thực về độ tin cậy; tái lập được (cùng origin + data + model ⇒ cùng kết quả, có test đối chiếu số exp_016).
- (−) Cần hạ tầng job (hàng đợi nội bộ trong `forecast`, 1 run cùng lúc).
