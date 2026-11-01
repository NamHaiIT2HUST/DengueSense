# Hạ tầng Docker localhost

**Hướng dẫn chạy từ đầu đến cuối:** [README.md ở thư mục gốc](../README.md). File này giải thích cấu hình Compose để gỡ lỗi; mọi lệnh chạy từ thư mục gốc repo.

## Thành phần

- `postgres`: một PostgreSQL 16 với schema và user DB riêng cho từng service. Các job `*-migrate` áp migration trước khi service phục vụ.
- `nats` và `nats-init`: JetStream lưu sự kiện dự báo. `forecast-relay` chuyển outbox dự báo sang NATS; `workflow` đọc bằng consumer bền vững, tạo cảnh báo có ID ổn định để xử lý sự kiện lặp.
- `identity`, `gateway`, `surveillance`, `workflow`, `notification`: service Go. Gateway là cửa API duy nhất của Dashboard.
- `forecast`, `optimize`, `genai`: service Python. Forecast chạy lại mô hình trên panel lịch sử đã nạp; Optimize giải ràng buộc ngân sách; GenAI tạo **dự thảo mô phỏng** và kiểm tra guardrail.
- `dashboard`: Nginx phục vụ bundle React được build với `VITE_APP_MODE=console`; `/api/` được proxy cùng origin tới Gateway. Chế độ này không dùng MSW.

`docker-compose.dev.yml` chỉ publish cổng trên `127.0.0.1`. Mặc định Dashboard `3000`, Gateway `8080`; file `.env` trên máy demo hiện đặt Gateway `18080`. Các cổng khác đổi được trong `infra/.env`. Không mở trực tiếp các cổng này cho mạng ngoài khi demo localhost.

## Cấu hình bí mật

Trên Windows, `infra/scripts/setup-local.ps1` sinh `infra/.env` từ `.env.example` bằng mật khẩu ngẫu nhiên, khóa Ed25519 và ba cặp bí mật dịch vụ. Nếu `.env` đã có, script kiểm tra rồi **không ghi đè**. Cần Go trong `PATH` cho lần tạo đầu tiên. File `.env` và `.env.devtool` bị Git bỏ qua.

Trên Linux/macOS có thể tạo thủ công: sao chép `.env.example`, thay toàn bộ `change-me`, chạy `go run ./cmd/devtool keygen` một lần và `go run ./cmd/devtool secret` ba lần từ `backend/`. Ghép `PUBLIC` với `GATEWAY_JWT_PUBLIC_KEY`, `PRIVATE` với `IDENTITY_JWT_PRIVATE_KEY`. Mỗi `SECRET` và `SHA256` phải đặt đúng cặp Gateway, Forecast hoặc Workflow theo chú thích trong `.env.example`. Không đưa khóa vào Git hoặc frontend.

`GENAI_DEMO_MODE=true` chỉ mở dự thảo B2G mô phỏng phục vụ cuộc thi. `GEMINI_API_KEY` là tùy chọn: không có khóa, service dùng mẫu cố định và không nhận là đã gọi Gemini. Mọi khóa đã lộ cần được thu hồi trước khi sử dụng khóa mới. Danh mục căn cứ pháp lý là danh mục tĩnh đã rà soát, không phải RAG pháp luật live.

## Dữ liệu và kiểm tra

`surveillance-cli` (profile `tools`) đọc panel từ `ai-service/data/processed/v0.2.0/` qua volume chỉ đọc. Panel không nằm trong Git. Script `seed-surveillance.ps1` hoặc `seed-surveillance.sh` nạp 34 tỉnh, ranh giới và panel vào database, chạy lại được. **Không thay panel thiếu bằng dữ liệu mock.**

```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml ps
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml logs --tail=100 forecast-relay workflow
```

Kiểm tra phân quyền database khi cần bằng `infra/scripts/check-db-isolation.sh`. Khi chạy một stack thử nghiệm Compose song song, phải dùng **cả** project name (`-p`) **và** `DENGUESENSE_NETWORK_NAME` riêng; chỉ đổi project name sẽ khiến hai stack dùng chung network và có nguy cơ nối nhầm DB/NATS.

Dừng bằng `docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml down` để giữ volume. `down -v` xóa volume database và **không phải** bước xử lý lỗi thông thường.
