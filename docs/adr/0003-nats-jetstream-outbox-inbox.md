# ADR-0003 — NATS JetStream + transactional outbox / inbox cho sự kiện

**Trạng thái:** accepted · 2026-09-25 · Thay đổi so với README gốc ("Redis chỉ thêm khi pilot")

## Bối cảnh
Có luồng bất đồng bộ cần **bền** và **phát lại được**: dữ liệu mới → dự báo → cảnh báo → duyệt → gửi. Sự kiện không được mất khi một service chết (đặc biệt `order.approved` → gửi thông báo).

## Quyết định
- Bus: **NATS JetStream** (1 binary nhỏ, RAM thấp, consumer group, retention, DLQ bằng stream riêng).
- Phong bì: CloudEvents 1.0 JSON; `data` chỉ chứa ID và tóm tắt.
- **Transactional outbox**: ghi thay đổi nghiệp vụ và sự kiện trong cùng transaction; tiến trình nền relay sang NATS. Không publish trực tiếp trong handler.
- **Giao ít nhất một lần + consumer idempotent** (bảng `inbox(event_id)`); retry lũy thừa, quá 5 lần vào `DLQ.<type>`.

## Phương án đã cân nhắc
- **Redis Streams:** dùng được, nhưng phải tự quản nhiều hơn (consumer group, trim, DLQ) và Redis khi đó thành hạ tầng bắt buộc thay vì tuỳ chọn.
- **Kafka/RabbitMQ:** nặng hơn nhiều so với nhu cầu (vài trăm sự kiện / tháng).
- **Chỉ REST đồng bộ giữa service:** mất sự kiện khi bên nhận chết; buộc retry phức tạp ở bên gửi.
- **Không dùng bus, đọc bảng outbox trực tiếp giữa service:** phá ranh giới dữ liệu (ADR-0002).

## Hệ quả
- (+) Không mất sự kiện; phát lại được; tách rời thời gian sống của các service.
- (−) Thêm 1 thành phần hạ tầng; mọi consumer phải idempotent (có test bắt buộc).
- Redis vẫn chỉ thêm khi có số đo chứng minh cần cache.
