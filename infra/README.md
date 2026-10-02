# infra

Hạ tầng dùng chung: Docker Compose cho dev/pilot (docs/09 §3, §16).

## Thành phần hiện có (Đợt 0)

| Service compose | Vai trò | Ghi chú |
|---|---|---|
| `postgres` | Postgres 16 + PostGIS + pgvector | 1 cụm, **mỗi service một schema + một user DB** (ADR-0002); khởi tạo bởi `postgres/init/01-roles-and-schemas.sh` |
| `nats` (+ `nats-init`) | NATS JetStream | `nats-init` tạo stream `EVENTS` (giữ 30 ngày) và `DLQ` (90 ngày), chạy 1 lần, idempotent |
| `identity-migrate` → `identity` | Xác thực (Go): người dùng, phiên, JWKS, token dịch vụ | Migration chạy xong (thoát) rồi `identity` mới khởi động; cần `IDENTITY_JWT_PRIVATE_KEY`, `IDENTITY_SERVICE_SECRET_SHA256_GATEWAY` |
| `surveillance-migrate` → `surveillance` | Danh mục tỉnh, ranh giới, phiên bản dữ liệu bất biến, quan sát (Go) | Kiểm token dịch vụ bằng khoá công khai `GATEWAY_JWT_PUBLIC_KEY` (dev). Dữ liệu nạp bằng `bash infra/scripts/seed-surveillance.sh` (idempotent; cần `ai-service/data/processed/v0.2.0/`) |
| `forecast-migrate` → `forecast` | Chạy dự báo M4-R2 thật (Python/FastAPI), lưu kết quả bất biến | Cần `FORECAST_SERVICE_CLIENT_SECRET` + `IDENTITY_SERVICE_SECRET_SHA256_FORECAST` (cặp sinh bằng `go run ./cmd/devtool secret`, xem `.env.example`). Image ~1 GB (thư viện ML); một lượt backtest ~20 giây; cần `surveillance` đã nạp dữ liệu |
| `gateway` | Cửa vào duy nhất (Go, cổng 8080): xác thực, chuyển tiếp, ghép `/risk-map`, cookie refresh HttpOnly, giới hạn đăng nhập theo IP | Lấy JWKS từ `identity`; cần `GATEWAY_SERVICE_CLIENT_SECRET` (+ băm ở `IDENTITY_SERVICE_SECRET_SHA256_GATEWAY`); khởi động sau `identity`, `surveillance`, `forecast` |

Redis **chưa thêm** — chỉ khi có số đo chứng minh cần (ADR-0003). Các service còn lại được thêm theo đợt (docs/09 §18).

## Chạy lần đầu

```bash
cp infra/.env.example infra/.env        # rồi ĐỔI mọi giá trị "change-me" (mật khẩu mạnh, ngẫu nhiên)
```

Tạo cặp khoá Ed25519 cho gateway (chỉ dev; ở pilot khoá do `identity` quản lý):

```bash
cd backend && go run ./cmd/devtool keygen
```

- Dán dòng `PUBLIC=...` vào `infra/.env` (biến `GATEWAY_JWT_PUBLIC_KEY`) và dòng `PRIVATE=...` vào `IDENTITY_JWT_PRIVATE_KEY` (dev dùng chung một cặp để gateway kiểm được token do `identity` ký).
- `cd backend && go run ./cmd/devtool secret` in `SECRET=...` (vào `GATEWAY_SERVICE_CLIENT_SECRET`) và `SHA256=...` (vào `IDENTITY_SERVICE_SECRET_SHA256_GATEWAY`).
- Lưu dòng `PRIVATE=...` vào `infra/.env.devtool` dưới dạng `DEV_JWT_PRIVATE_KEY=...` (file này bị `.gitignore`; **không commit, không dán vào chat/issue**).

Rồi chạy stack:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --build
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml ps
```

`docker-compose.dev.yml` chỉ mở cổng ra `127.0.0.1` (Postgres 5432, NATS 4222/8222, gateway 8080). Cổng bị chiếm hoặc bị Windows giữ chỗ →
đặt `POSTGRES_HOST_PORT`, `NATS_HOST_PORT`, `NATS_MONITOR_HOST_PORT`, `GATEWAY_HOST_PORT`, `IDENTITY_HOST_PORT`, `SURVEILLANCE_HOST_PORT` trong `infra/.env`.

## Chạy console trên backend thật

```bash
# 1. Stack đang chạy + đã nạp dữ liệu (bash infra/scripts/seed-surveillance.sh) — xem trên.
# 2. Tạo tài khoản dev (mật khẩu sinh ngẫu nhiên, ghi vào infra/.env.devtool — file bị .gitignore, KHÔNG commit):
#    docker compose ... exec -T -e IDENTITY_NEW_PASSWORD=<mk> identity /service create-user -username dev-analyst -display-name "Dev analyst" -org cdc-dev -roles analyst
# 3. Trỏ dev server tới gateway rồi chạy:
echo "DEV_API_PROXY=http://127.0.0.1:${GATEWAY_HOST_PORT:-8080}" > dashboard/.env.console.local   # bị .gitignore
cd dashboard && npm run dev:console        # http://127.0.0.1:5173 (Vite proxy /api → gateway, cùng origin để cookie refresh hoạt động)
E2E_ANALYST_PASSWORD=… E2E_VIEWER_PASSWORD=… npm run test:e2e:real   # 6 E2E trên stack thật
```

## Kiểm tra sau khi dựng

```bash
# Cô lập dữ liệu giữa các service (quyền tạo/đọc chéo schema, đặc quyền, extension, mật khẩu sai) — phải in "TẤT CẢ ĐẠT"
docker compose -f infra/docker-compose.yml exec -T postgres bash -s < infra/scripts/check-db-isolation.sh

# Database thử nghiệm cho test tích hợp (repository contract test của identity...) — chạy lại được, idempotent
docker compose -f infra/docker-compose.yml exec -T postgres bash -s < infra/scripts/create-test-db.sh

# Stream JetStream
docker run --rm --network denguesense-core natsio/nats-box:0.14.5 nats --server nats://nats:4222 stream ls
```

Đổi `01-roles-and-schemas.sh` chỉ có tác dụng khi khởi tạo **volume mới** (`docker compose down -v` xoá dữ liệu dev để chạy lại từ đầu).

## Quy tắc

- Không commit `.env`, `.env.*` (trừ `.env.example`), `*.local.yml` — đã có trong `.gitignore`.
- Mật khẩu/khoá chỉ trong file env ngoài git; ở CI dùng GitHub Actions Secrets (docs/09 §11.4).
- Thay đổi hạ tầng ảnh hưởng dev khác (đổi cổng, đổi biến env bắt buộc) phải báo trước, không âm thầm đổi.
- File `.sh`, `Dockerfile`, `*.conf`, `*.sql` phải là kết thúc dòng **LF** (đã ép bằng `.gitattributes`; máy Windows bật `autocrlf` sẽ không làm hỏng script trong container).
- Ở pilot/staging chỉ reverse proxy (Caddy, thêm ở đợt sau) được publish cổng; **không** dùng `docker-compose.dev.yml`.
