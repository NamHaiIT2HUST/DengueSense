# backend

Các service **Go** của DengueSense: `gateway`, `identity`, `surveillance`, `workflow`, `notification`
(kiến trúc: [docs/09](../docs/09-kien-truc-backend.md), quyết định: [docs/adr](../docs/adr/README.md)).

**Trạng thái (Đợt 0 — nền móng):** đã có thư viện dùng chung `pkg/*` và khung `gateway` chạy được (xác thực
fail-closed, lỗi problem+json, health, tắt êm; mọi operation trả `501` cho tới khi hiện thực ở Đợt 1).
Các service còn lại được dựng theo đợt (docs/09 §18).

## Cấu trúc

```
backend/
├── go.mod                       # 1 module cho mọi service Go (ADR-0007)
├── .golangci.yml                # lint + depguard (luật ranh giới service)
├── build/Dockerfile             # dùng chung: --build-arg SERVICE=<tên>
├── cmd/
│   ├── gateway/main.go          # điểm vào từng service (mỏng: đọc cấu hình, dựng, chạy)
│   └── devtool/main.go          # CHỈ dev: sinh khoá, cấp token thử
├── pkg/                         # thư viện dùng chung, KHÔNG chứa nghiệp vụ
│   ├── configx/                 # cấu hình từ env, fail-fast, không lộ giá trị trong lỗi
│   ├── obsx/                    # log JSON (ts, level, service, version, request_id)
│   ├── httpx/                   # problem+json, middleware, health, Serve (tắt êm)
│   ├── authx/                   # JWT EdDSA, Verifier/Signer, middleware fail-closed, RBAC
│   ├── eventx/                  # phong bì CloudEvents + kiểu dữ liệu sự kiện (khớp contracts/events)
│   └── dbx/                     # pgx pool + InTx (commit/rollback/panic)
└── services/
    └── gateway/
        ├── api/                 # SINH từ contracts/openapi/public-v1.yaml — không sửa tay
        ├── app/                 # cấu hình + router (ghép xác thực, lỗi, hợp đồng)
        └── handler/             # hiện thực StrictServerInterface (hiện là NotImplemented → 501)
```

## Chạy local

Yêu cầu: Go (theo `go.mod`; máy cũ hơn sẽ tự tải toolchain), Docker.

```bash
# 1. hạ tầng + gateway (từ thư mục gốc repo). Lần đầu: tạo infra/.env — xem infra/README.md
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --build

# 2. thử gateway bằng token dev (khoá riêng nằm trong infra/.env.devtool, không commit)
cd backend
set -a; . ../infra/.env.devtool; set +a
TOKEN=$(go run ./cmd/devtool token -key "$DEV_JWT_PRIVATE_KEY" -sub dev -roles viewer,analyst -org dev-org)
curl -i -H "Authorization: Bearer $TOKEN" http://127.0.0.1:${GATEWAY_HOST_PORT:-8080}/api/v1/provinces   # 501 not_implemented
curl -i http://127.0.0.1:${GATEWAY_HOST_PORT:-8080}/api/v1/provinces                                    # 401
```

## Lệnh thường dùng (chạy trong `backend/`)

| Việc | Lệnh |
|---|---|
| Sinh lại mã từ hợp đồng (sau khi sửa `contracts/`) | `go generate ./...` |
| Format | `gofmt -w .` |
| Lint (gồm depguard) | `go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.14.0 run ./...` |
| Test (race) | `go test ./... -race -count=1` |
| Test tích hợp DB | `TEST_DATABASE_URL="postgres://svc_forecast:<mật khẩu>@127.0.0.1:<cổng>/denguesense?sslmode=disable" go test ./pkg/dbx/...` |
| Quét lỗ hổng | `go run golang.org/x/vuln/cmd/govulncheck@latest ./...` |

CI (`ci-backend.yml`) chạy đúng các bước trên, cộng: mã sinh còn đồng bộ, `go mod tidy` gọn, build image + Trivy.

## Luật quan trọng (đã có test/CI chặn)

1. **Hợp đồng trước, code sau.** Đổi API = PR `contracts/` riêng ([contracts/README.md](../contracts/README.md)); mã `api.gen.go` sinh từ đó. Thêm operation vào hợp đồng mà chưa hiện thực trong `handler/` thì **không biên dịch được** — đó là chủ đích.
2. **Xác thực fail-closed.** Mọi route dưới `/api/v1` đòi token trừ danh sách công khai (`publicRoutes` trong `services/gateway/app/router.go`). Test đối chiếu danh sách đó với các operation `security: []` của hợp đồng và gọi **từng operation của hợp đồng** không kèm token, kỳ vọng 401.
3. **Xác thực chạy TRƯỚC khi mã sinh kiểm tham số** — middleware gắn ở *nhóm route*, không ở `GinServerOptions.Middlewares` (nếu không, request chưa đăng nhập nhận 400 thay vì 401; đã bị test bắt).
4. **Lỗi luôn là problem+json với `code` ổn định** (`contracts/errors.md`); lỗi không lường trước chỉ để lại chi tiết trong log. Test kiểm mọi `code` do `httpx` phát ra đều có trong danh mục.
5. **Ranh giới service bằng `depguard`:** `pkg/*` không import `services/*`; `services/X` không import `services/Y`.
6. **Không log** token, mật khẩu, khoá, query string, thân request. Lỗi cấu hình chỉ nêu *tên* biến, không nêu giá trị.

## Thêm một service mới (checklist)

1. PR hợp đồng: `contracts/openapi/<tên>-internal.yaml` (+ sự kiện, mã lỗi) — review xong mới code.
2. `cmd/<tên>/main.go` (mẫu: `cmd/gateway`, có cờ `-healthcheck`) và `services/<tên>/{domain,app,adapters,migrations}` theo docs/09 §14.2.
3. Thêm rule `<tên>-isolated` vào `.golangci.yml` (depguard).
4. Thêm schema + user DB vào `infra/postgres/init/01-roles-and-schemas.sh` và biến `SVC_<TÊN>_PASSWORD` vào `infra/.env.example`; chạy `infra/scripts/check-db-isolation.sh`.
5. Thêm service vào `infra/docker-compose.yml` (mẫu: `gateway`: `read_only`, `cap_drop: ALL`, healthcheck).
6. Bổ sung `RUNBOOK.md` ngắn cho service (docs/09 §17.5).

## Quy tắc chung

Xem [../CONTRIBUTING.md](../CONTRIBUTING.md) — `gofmt` + `golangci-lint` bắt buộc pass trước khi merge.
