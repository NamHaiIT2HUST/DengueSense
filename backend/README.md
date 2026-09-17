# backend

API Gateway + business logic + dispatch service, viết bằng **Go**.

## Trách nhiệm

- Auth (JWT) cho Admin Dashboard, phân quyền theo vai trò (CDC/tỉnh, bệnh viện B2B)
- Expose REST API cho `dashboard`
- Gọi `ai-service` (REST nội bộ) để lấy kết quả forecast / optimize / bản nháp GenAI
- Dispatch: gửi lệnh điều phối tới CDC, cảnh báo tới bệnh viện (HIS), cảnh báo cá nhân hoá tới người dân (Gmail/SMS)
- Lưu trạng thái duyệt lệnh (human-in-the-loop: Accept/Deny trên Admin Dashboard)

## Scaffold (khi bắt đầu code)

```bash
go mod init github.com/<org>/denguesense/backend
```

Dùng Gin làm HTTP framework. Cấu trúc đề xuất:

```
backend/
├── cmd/api/main.go
├── internal/
│   ├── handler/        # HTTP handlers
│   ├── service/         # business logic
│   ├── client/            # HTTP client gọi ai-service
│   ├── dispatch/          # gửi lệnh CDC/HIS/Gmail-SMS
│   └── repository/         # truy cập Postgres
├── migrations/
└── go.mod
```

## Quy tắc

Xem [../CONTRIBUTING.md](../CONTRIBUTING.md) — `gofmt` + `golangci-lint` bắt buộc pass trước khi merge.
