# ADR-0002 — Một cụm Postgres, schema + user riêng cho mỗi service

**Trạng thái:** accepted · 2026-09-25

## Bối cảnh
README gốc chốt "1 DB duy nhất cho MVP" (PostgreSQL + PostGIS + pgvector) để giảm chi phí vận hành. Nhưng microservice đòi mỗi service sở hữu dữ liệu của mình (docs/09 §2 nguyên tắc 1).

## Quyết định
Một cụm Postgres 16 (image PostGIS, cài thêm pgvector). **Mỗi service một schema và một user DB** chỉ có quyền trên schema đó (`REVOKE` mặc định trên `public`). Tham chiếu chéo service chỉ bằng ID, không khoá ngoại xuyên schema. Bảng kết quả (dự báo, quan sát, audit) append-only.

## Phương án đã cân nhắc
- **DB riêng cho từng service:** cô lập tuyệt đối nhưng 8 cụm trên 1 VM 16 GB là lãng phí; bị loại ở giai đoạn pilot.
- **Schema chung, mọi service đọc bảng của nhau:** nhanh viết nhưng phá vỡ ranh giới, khiến tách cụm về sau không thể.

## Hệ quả
- (+) Vận hành 1 cụm; tách cụm về sau chỉ là đổi connection string vì không có JOIN/FK xuyên schema.
- (+) Lộ mật khẩu 1 service không cho đọc dữ liệu service khác.
- (−) Không truy vấn JOIN xuyên service — dùng API/sự kiện hoặc BFF ghép ở `gateway`.
- Migration chạy như bước riêng khi deploy, theo kiểu expand → migrate → contract (docs/09 §9.3).
