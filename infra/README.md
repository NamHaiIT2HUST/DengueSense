# infra

Cấu hình hạ tầng dùng chung: Docker Compose cho local dev, script deploy cho giai đoạn pilot.

## Kế hoạch

- `docker-compose.yml`: Postgres (+ PostGIS, + pgvector), `backend`, `ai-service`, `dashboard` — thêm khi từng service đã có manifest chạy được.
- Redis: **chưa thêm ở MVP** — chỉ đưa vào khi thực sự cần cache/queue ở giai đoạn pilot/scale (xem README gốc, mục Tech stack).
- Deploy pilot (2 tỉnh): 1 VM Cloud (AWS/GCP), chạy qua Docker Compose — chưa cần Kubernetes.

## Quy tắc

- Không commit file env/secret thật (`*.local.yml`, `.env`) — đã có trong `.gitignore`.
- Thay đổi hạ tầng ảnh hưởng dev khác (đổi port, đổi biến env bắt buộc) phải báo trước trong nhóm, không âm thầm đổi.
