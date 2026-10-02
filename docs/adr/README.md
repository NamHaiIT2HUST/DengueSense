# Architecture Decision Records (ADR)

Mỗi quyết định kiến trúc quan trọng là 1 file `NNNN-tieu-de.md`. Quy định ở [docs/09 §17.2](../09-kien-truc-backend.md#172-adr-architecture-decision-record).

**Bắt buộc viết ADR khi:** thêm/bỏ service, thêm hạ tầng (DB, queue, cache), đổi cách xác thực, đổi một nguyên tắc ở docs/09 §2, phá vỡ hợp đồng sang `/v2`.

**Mẫu:** Trạng thái → Bối cảnh → Quyết định → Phương án đã cân nhắc → Hệ quả.
**Trạng thái:** `proposed` · `accepted` · `superseded by NNNN`. ADR đã `accepted` không sửa nội dung; muốn đổi thì viết ADR mới và đánh dấu cái cũ `superseded`.

| ADR | Quyết định | Trạng thái |
|---|---|---|
| [0001](0001-microservice-8-service.md) | Kiến trúc microservice 8 service + 1 worker, triển khai theo đợt | accepted |
| [0002](0002-mot-cum-postgres-schema-rieng.md) | Một cụm Postgres, schema + user riêng mỗi service | accepted |
| [0003](0003-nats-jetstream-outbox-inbox.md) | NATS JetStream + outbox/inbox cho sự kiện | accepted |
| [0004](0004-rest-openapi-contract-first.md) | REST/OpenAPI contract-first, chưa dùng gRPC | accepted |
| [0005](0005-jwt-eddsa-refresh-cookie.md) | JWT EdDSA + refresh token xoay vòng qua cookie HttpOnly | accepted |
| [0006](0006-du-bao-theo-lo-backtest-replay.md) | Dự báo tính theo lô, API chỉ đọc; backtest replay là chế độ demo chính | accepted |
| [0007](0007-go-mot-module-python-mot-package.md) | Go: 1 module nhiều service; Python: 1 package nhiều image | accepted |
