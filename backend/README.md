# backend

Các service **Go** của DengueSense: `gateway`, `identity`, `surveillance`, `workflow`, `notification`
(kiến trúc: [docs/09](../docs/09-kien-truc-backend.md), quyết định: [docs/adr](../docs/adr/README.md)).

**Trạng thái:** Đợt 0 xong (thư viện dùng chung `pkg/*`, khung `gateway` xác thực fail-closed). Đợt 1: **`identity` xong**
(login, refresh xoay vòng + phát hiện tái sử dụng, logout, khoá đăng nhập, JWKS, token dịch vụ) và **`surveillance` xong**
(danh mục tỉnh, ranh giới, phiên bản dữ liệu BẤT BIẾN + tải panel, quan sát; đã nhập panel v0.2.0 thật vào Postgres); cả hai
kiểm trên Postgres thật. `gateway` vẫn trả `501` cho mọi operation và dùng khoá công khai tĩnh — nối upstream/JWKS là việc
kế tiếp; `forecast` thật chưa làm. Các service còn lại dựng theo đợt (docs/09 §18).

## Cấu trúc

```
backend/
├── go.mod                       # 1 module cho mọi service Go (ADR-0007)
├── .golangci.yml                # lint + depguard (luật ranh giới service)
├── build/Dockerfile             # dùng chung: --build-arg SERVICE=<tên>
├── cmd/
│   ├── gateway/main.go          # điểm vào từng service (mỏng: đọc cấu hình, dựng, chạy)
│   ├── identity/main.go         #   (+ lệnh con `migrate`, cờ -healthcheck)
│   ├── surveillance/main.go     #   (+ `migrate`, `seed`, `import-panel`)
│   └── devtool/main.go          # CHỈ dev: sinh khoá, cấp token thử
├── pkg/                         # thư viện dùng chung, KHÔNG chứa nghiệp vụ
│   ├── configx/                 # cấu hình từ env, fail-fast, không lộ giá trị trong lỗi
│   ├── obsx/                    # log JSON (ts, level, service, version, request_id)
│   ├── httpx/                   # problem+json, middleware, health, Serve (tắt êm)
│   ├── authx/                   # JWT EdDSA, Verifier/Signer, JWKS/kid, token dịch vụ, middleware fail-closed, RBAC
│   ├── contracttest/            # đối chiếu phản hồi của service với hợp đồng OpenAPI của chính nó
│   ├── eventx/                  # phong bì CloudEvents + kiểu dữ liệu sự kiện (khớp contracts/events)
│   └── dbx/                     # pgx pool + InTx (commit/rollback/panic)
└── services/
    ├── gateway/
    │   ├── api/                 # SINH từ contracts/openapi/public-v1.yaml — không sửa tay
    │   ├── app/                 # cấu hình + router (ghép xác thực, lỗi, hợp đồng)
    │   └── handler/             # hiện thực StrictServerInterface (hiện là NotImplemented → 501)
    └── identity/
        ├── api/                 # SINH từ contracts/openapi/identity-internal.yaml
        ├── domain/              # quy tắc (Argon2id, khoá đăng nhập, xoay vòng token) — không biết HTTP/SQL
        ├── app/                 # use case + port (repository, đồng hồ…)
        ├── adapters/            # httpapi, memory, postgres
        ├── migrations/          # golang-migrate, nhúng vào binary (có down)
        ├── repotest/            # BỘ TEST HỢP ĐỒNG repository — chạy trên cả memory lẫn Postgres thật
        └── config/
    └── surveillance/            # cùng bố cục; domain/panel.go đọc + kiểm Parquet, migration có trigger bất biến
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
| Test tích hợp DB | (identity, surveillance) Tạo DB thử một lần: `docker compose -f infra/docker-compose.yml exec -T postgres bash -s < infra/scripts/create-test-db.sh`, rồi `TEST_DATABASE_URL="postgres://svc_identity:<mật khẩu>@127.0.0.1:<cổng>/denguesense_test?sslmode=disable" go test ./services/identity/... ./pkg/dbx/...` (với surveillance: user `svc_surveillance`, `./services/surveillance/...`) — bộ test **xoá dữ liệu** nên từ chối chạy nếu tên DB không kết thúc `_test` |
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
