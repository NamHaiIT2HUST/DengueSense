# ADR-0001 — Kiến trúc microservice: 8 service + 1 worker, triển khai theo đợt

**Trạng thái:** accepted · 2026-09-25 · Người quyết: Nam Hải (Tech Lead)

## Bối cảnh
Hệ thống có 3 lớp AI (Python) và phần nghiệp vụ (xác thực, duyệt lệnh, gửi thông báo). Đội tech 2 người, pilot chạy 1 VM (docs/09 §1). Yêu cầu bắt buộc: con người duyệt cuối, cô lập khoá LLM, model thay đổi theo nhịp khác nghiệp vụ.

## Quyết định
Tách thành 8 service: Go — `gateway`, `identity`, `surveillance`, `workflow`, `notification`; Python — `forecast`, `optimize`, `genai`; cộng `ingest-worker`. Mỗi service sở hữu dữ liệu của mình (ADR-0002). **Dựng theo đợt** (docs/09 §18): kiến trúc chốt đủ, nhưng chỉ dựng service nào tới lượt cần.

## Lý do tách (không tách cho đẹp)
1. Hai runtime (Go, Python) → bắt buộc là tiến trình riêng.
2. Hồ sơ rủi ro khác nhau: `genai` giữ khoá LLM và `notification` gửi ra ngoài phải cô lập khỏi `identity`; job dự báo nặng không được làm chậm API đọc.
3. Nhịp thay đổi khác nhau: model đổi theo thí nghiệm, nghiệp vụ duyệt lệnh đổi theo yêu cầu CDC.

## Phương án đã cân nhắc
- **Monolith Go + gọi Python qua HTTP:** ít phần chuyển động nhất, nhưng dồn `genai`/`notification` (egress Internet) vào chung tiến trình với xác thực; khó cô lập khoá. Bị loại.
- **Monolith modular (1 Go + 1 Python):** khả thi cho MVP; chấp nhận được nếu đội thu nhỏ. Kiến trúc đã giữ ranh giới (ADR-0007) nên gộp lại về sau rẻ.
- **Nhiều service hơn (audit, map…):** quá nhỏ, chi phí vận hành > lợi ích (docs/09 §4.3).

## Hệ quả
- (+) Ranh giới trách nhiệm và bảo mật rõ; hai người ít giẫm chân nhau.
- (−) Chi phí vận hành/gỡ lỗi phân tán — giảm bằng: chung repo và tooling, chung 1 cụm Postgres, contract-first, observability từ đợt 2.
- Thêm/bỏ service cần ADR mới.
