# Postgres 16 + PostGIS (dữ liệu địa lý, surveillance) + pgvector (RAG, genai).
# Image postgis/postgis không có pgvector nên cài thêm từ kho PGDG đã cấu hình sẵn trong image gốc.
# Ghim tag để dựng lại được (không dùng `latest`).
FROM postgis/postgis:16-3.4

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-16-pgvector \
    && rm -rf /var/lib/apt/lists/*

# Đưa script khởi tạo vào image với quyền thực thi (bind-mount từ Windows không giữ được bit thực thi).
COPY --chmod=755 init/ /docker-entrypoint-initdb.d/
