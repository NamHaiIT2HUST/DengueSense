# DengueSense — chạy demo trên localhost

DengueSense gồm Dashboard React, Gateway và các service Go, Forecast/Optimize/GenAI Python, PostgreSQL và NATS. Hướng dẫn này chạy **toàn bộ hệ thống trên máy cá nhân bằng Docker Compose**. Dashboard tại `http://127.0.0.1:3000` được build ở chế độ `console`, gọi API và database thật; không dùng MSW cho nghiệp vụ. Trang giới thiệu vẫn có nội dung minh họa tĩnh; trang Vercel công khai là bản demo tĩnh riêng, không đại diện cho stack localhost.

> **Phạm vi dữ liệu:** lượt dự báo tái hiện trên số liệu giám sát lịch sử 1994–2010, không phải giám sát dịch hiện tại. Số ca ngăn ngừa và chi phí can thiệp là kết quả mô hình mô phỏng. Công điện B2G là **bản dự thảo mô phỏng**, dùng danh mục trích dẫn pháp lý tĩnh và quy trình duyệt 4 mắt; chưa phải văn bản có chữ ký số CA hoặc hệ thống RAG tra cứu pháp luật trực tiếp. Xem [giới hạn và nguồn dữ liệu](docs/competition-readiness.md).

## 1. Chuẩn bị

- Windows PowerShell, Docker Desktop đang chạy (Docker Compose v2), Go trong `PATH` để sinh khóa lần đầu. Nên có ít nhất 8 GB RAM trống và kết nối Internet để tải/build image lần đầu.
- Chạy các lệnh dưới đây **từ thư mục gốc repo**.
- Cần panel lịch sử `ai-service/data/processed/v0.2.0/panel_monthly.parquet` cùng `manifest.json`. Hai file này nằm ngoài Git; máy demo hiện có sẵn. Khi dùng bản clone khác, phải mang theo panel được cấp phép và đối chiếu manifest, hoặc dựng lại từ dữ liệu nguồn theo [hướng dẫn AI service](ai-service/README.md). Script nạp dữ liệu sẽ dừng rõ ràng nếu thiếu file, không thay bằng số mock.

## 2. Khởi động lần đầu trên Windows

```powershell
# Tạo infra/.env với mật khẩu ngẫu nhiên, khóa Ed25519 và cặp bí mật dịch vụ.
# Nếu file đã tồn tại, script chỉ kiểm tra và giữ nguyên mọi bí mật.
.\infra\scripts\setup-local.ps1

# Build lại image từ code hiện tại và chờ service sẵn sàng; image cũ có thể trả schema lỗi.
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --build --wait --wait-timeout 180

# Nạp danh mục 34 tỉnh, ranh giới và panel lịch sử vào Surveillance.
.\infra\scripts\seed-surveillance.ps1

# Tạo bốn tài khoản trong Identity thật, mật khẩu ngẫu nhiên lưu tại infra/.env.devtool.
.\infra\scripts\seed-users.ps1

docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml ps
```

Mở **[http://127.0.0.1:3000](http://127.0.0.1:3000)**. File `infra/.env.devtool` chứa mật khẩu local, đã bị Git bỏ qua: xem trên máy của bạn và **không gửi vào chat hoặc commit**. Tên đăng nhập:

| Vai trò | Tên đăng nhập | Khóa mật khẩu trong `infra/.env.devtool` |
| --- | --- | --- |
| Phân tích | `dev-analyst` | `DEV_ANALYST_PASSWORD` |
| Cán bộ xử lý | `local-officer` | `DEMO_OFFICER_PASSWORD` |
| Lãnh đạo duyệt | `local-approver` | `DEMO_APPROVER_PASSWORD` |
| Chỉ xem | `dev-viewer` | `DEV_VIEWER_PASSWORD` |

`seed-users.ps1` chạy lại được và không đổi mật khẩu tài khoản đã tồn tại. Nếu một tài khoản cũ đã tồn tại nhưng không có mật khẩu trong file local, script sẽ cảnh báo; dùng tài khoản `local-*` mới cho hai vai trò xử lý/duyệt.

### Linux/macOS

Tạo `infra/.env` theo `infra/.env.example` bằng bí mật riêng (hướng dẫn tạo khóa ở [infra/README.md](infra/README.md)), rồi chạy cùng lệnh `docker compose` phía trên. Nạp panel bằng `bash infra/scripts/seed-surveillance.sh`. Script `bash infra/scripts/seed-users.sh` yêu cầu bốn biến mật khẩu `DEMO_OFFICER_PASSWORD`, `DEMO_APPROVER_PASSWORD`, `DEV_ANALYST_PASSWORD`, `DEV_VIEWER_PASSWORD` do bạn tự đặt; script không chứa mật khẩu mặc định.

## 3. Trình tự demo nghiệp vụ

1. Đăng nhập `dev-analyst`, tạo lượt **backtest** với tháng neo `03/2010`. Chờ trạng thái hoàn tất, mở bản đồ/chi tiết tỉnh và kiểm tra nguồn `v0.2.0` cùng phiên bản mô hình.
2. Đăng nhập `local-officer`, mở cảnh báo từ lượt dự báo, **xác nhận cảnh báo** để tạo hồ sơ. Tạo phương án phân bổ từ số ca dự báo của hồ sơ, nhập ngân sách và hạn mức từng tỉnh; **xác nhận phương án** trước khi đưa số liệu vào dự thảo.
3. Tạo dự thảo B2G cho hồ sơ. Màn hình phải hiển thị guardrail và các căn cứ pháp lý mẫu. Nếu chưa có `GEMINI_API_KEY`, service dùng mẫu kiểm soát cố định và **không ghi nhận đã dùng Gemini**.
4. Đăng nhập `local-approver` để duyệt phiên bản hiện tại. Tác giả không thể tự duyệt; dự thảo bị yêu cầu sửa phải tạo phiên bản mới trước khi duyệt. Đây là luồng mô phỏng hành chính, không phát hành công điện thật.

Để thử Gemini, **thu hồi khóa từng xuất hiện trong chat trước**, tạo khóa mới và tự đặt `GEMINI_API_KEY=...` trong `infra/.env`. Sau đó chạy `docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --force-recreate genai`. Khóa chỉ nằm phía server, không đặt vào biến `VITE_*` hay mã nguồn. Không có khóa vẫn demo được luồng dự thảo mô phỏng bằng mẫu cố định.

## 4. Vận hành và xử lý lỗi

```powershell
# Xem trạng thái và log (thay tên service nếu cần).
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml ps
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs --tail=100 gateway workflow forecast genai

# Dừng sau buổi demo; volume PostgreSQL vẫn được giữ.
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down
```

- Nếu cổng bị chiếm, đổi `DASHBOARD_HOST_PORT`, `GATEWAY_HOST_PORT`, `POSTGRES_HOST_PORT` hoặc cổng service tương ứng trong `infra/.env`, rồi chạy lại Compose. Cổng mặc định Dashboard là `3000`, Gateway là `8080`; file `.env` trên máy demo hiện đặt Gateway `18080`. Các cổng dev chỉ bind `127.0.0.1`.
- Nếu tạo dự thảo trả 503 sau khi cập nhật code, rebuild GenAI và Workflow bằng `docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --build --force-recreate genai workflow`. Workflow từ chối phản hồi của image GenAI cũ khi schema/guardrail không còn khớp.
- Nếu bản đồ rỗng hoặc tạo lượt báo thiếu dữ liệu, kiểm tra hai file panel ở mục 1 và chạy lại `seed-surveillance.ps1`. Nhập panel là thao tác idempotent.
- Nếu B2G bị chặn 422, kiểm tra `GENAI_DEMO_MODE=true` trong `infra/.env`, khởi động lại `genai`, và xem guardrail trả về. Phương án chưa xác nhận không được gắn vào dự thảo.
- Nếu thấy bản nháp B2G cũ không có ID tác giả dạng UUID, hãy tạo bản mới bằng tài khoản local; hệ thống cố ý chặn duyệt bản cũ vì không thể xác minh tác giả.
- **Không chạy `docker compose down -v`** nếu muốn giữ database. Không commit `infra/.env`, `infra/.env.devtool` hay panel dữ liệu chưa được phép phân phối.

## 5. Kiểm thử trước buổi thi

```powershell
cd dashboard
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run depcruise
npm test
npm run build
npm run test:e2e
cd ..\backend
go vet ./...
go test ./...
cd ..
```

Contract OpenAPI: chạy `npx --yes @redocly/cli@2 lint` trong `contracts/`. Python: trong `ai-service/`, dùng virtualenv để chạy `ruff check .`, `black --check .`, `mypy`, `lint-imports`, `pytest -q`. Bài E2E dùng backend thật nằm ở `dashboard/e2e-real/` và cần mật khẩu analyst/viewer từ `infra/.env.devtool`; xem `dashboard/playwright.real.config.ts`.

Kiểm thử trình duyệt trên stack thật (PowerShell, từ thư mục gốc; không in mật khẩu):

```powershell
$saved = @{}
Get-Content infra/.env.devtool | ForEach-Object {
  if ($_ -match '^([A-Z0-9_]+)=(.*)$') { $saved[$matches[1]] = $matches[2] }
}
$env:E2E_ANALYST_PASSWORD = $saved['DEV_ANALYST_PASSWORD']
$env:E2E_VIEWER_PASSWORD = $saved['DEV_VIEWER_PASSWORD']
$env:DEV_API_PROXY = 'http://127.0.0.1:18080' # thay bằng GATEWAY_HOST_PORT trong infra/.env
cd dashboard
npm run test:e2e:real
cd ..
Remove-Item Env:E2E_ANALYST_PASSWORD, Env:E2E_VIEWER_PASSWORD, Env:DEV_API_PROXY
```

## Cấu trúc dự án

| Thư mục | Nội dung |
| --- | --- |
| `dashboard/` | React 19, TypeScript, Feature-Sliced Design |
| `backend/` | Gateway, Identity, Surveillance, Workflow, Notification và forecast relay (Go) |
| `ai-service/` | Dự báo, tối ưu phân bổ, GenAI guardrails (Python) |
| `infra/` | Docker Compose, PostgreSQL, NATS, script khởi tạo |
| `contracts/` | OpenAPI public/internal và mã sinh API |
| `docs/` | Kiến trúc, model card, giới hạn khoa học và phạm vi cuộc thi |

Giấy phép mã nguồn: [MIT](LICENSE). Quyền sử dụng dữ liệu được trình bày riêng trong [competition-readiness.md](docs/competition-readiness.md).
