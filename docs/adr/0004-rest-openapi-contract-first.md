# ADR-0004 — REST/OpenAPI contract-first cho cả công khai và nội bộ; chưa dùng gRPC

**Trạng thái:** accepted · 2026-09-25

## Bối cảnh
Hai runtime, hai người phụ trách, cần làm song song (frontend chờ backend, backend chờ service AI). Sai lệch hợp đồng là nguồn lỗi tích hợp lớn nhất.

## Quyết định
- Mọi giao tiếp đồng bộ là REST/JSON theo OpenAPI 3.1; hợp đồng nằm ở `contracts/` và là **nguồn sự thật**.
- Go sinh server từ hợp đồng (`oapi-codegen`); dashboard sinh type (`openapi-typescript`); Python viết FastAPI và CI so `/openapi.json` với hợp đồng bằng `oasdiff`.
- Thay đổi phá vỡ bị `oasdiff breaking` chặn; muốn đổi phải thêm trường song song hoặc lên `/v2`.
- Lỗi theo RFC 9457 (`problem+json`) với `code` ổn định (`contracts/errors.md`).

## Phương án đã cân nhắc
- **gRPC nội bộ:** hiệu năng tốt hơn nhưng thêm loại hợp đồng thứ hai (protobuf), khó gỡ lỗi bằng curl; độ trễ nội bộ không phải nút thắt (dự báo tính theo lô). Xem lại khi có số đo.
- **Code-first (sinh OpenAPI từ code):** nhanh khởi đầu, nhưng hợp đồng thành sản phẩm phụ, frontend không thể bắt đầu trước backend.
- **GraphQL:** không có nhu cầu truy vấn linh hoạt; thêm độ phức tạp cho cache và phân quyền.

## Hệ quả
- (+) Frontend làm song song bằng mock sinh từ hợp đồng; lệch hợp đồng lộ ra ở CI, không phải ở tích hợp.
- (−) Thêm bước "PR hợp đồng riêng" trước khi code (đã đưa vào quy trình, docs/09 §17.1).
