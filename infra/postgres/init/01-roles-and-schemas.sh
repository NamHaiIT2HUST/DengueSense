#!/bin/bash
# Khởi tạo Postgres cho DengueSense (docs/09 §9.1, ADR-0002):
#   - mỗi service một schema + một user DB chỉ có quyền trên schema của mình;
#   - thu hồi quyền mặc định của PUBLIC (không service nào tạo được bảng ở `public`);
#   - bật extension PostGIS/pgvector ở schema `public` (chỉ dùng, không sở hữu).
# Chạy 1 lần khi khởi tạo volume mới (cơ chế docker-entrypoint-initdb.d), viết idempotent để chạy lại được.
# Mật khẩu lấy từ biến môi trường SVC_<TÊN>_PASSWORD, KHÔNG nằm trong file này.
set -euo pipefail

SERVICES=(identity surveillance forecast optimize workflow genai notification)

psql_admin() {
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" "$@"
}

for svc in "${SERVICES[@]}"; do
  var="SVC_$(echo "$svc" | tr '[:lower:]' '[:upper:]')_PASSWORD"
  pw="${!var:-}"
  if [ -z "$pw" ]; then
    echo "LỖI: thiếu biến môi trường $var" >&2
    exit 1
  fi

  psql_admin -v role="svc_${svc}" -v schema="${svc}" -v pw="$pw" -v db="$POSTGRES_DB" <<'SQL'
-- Tạo role nếu chưa có, luôn đặt lại mật khẩu theo biến môi trường hiện tại.
SELECT format('CREATE ROLE %I LOGIN', :'role')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'role', :'pw') \gexec

-- Schema riêng do chính role đó sở hữu; search_path mặc định trỏ vào schema của service.
SELECT format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', :'schema', :'role') \gexec
SELECT format('ALTER ROLE %I SET search_path = %I, public', :'role', :'schema') \gexec

-- Chỉ được kết nối DB này; được dùng (không tạo) ở `public` để gọi hàm của extension.
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db', :'role') \gexec
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'role') \gexec
SQL
done

psql_admin <<'SQL'
-- Thu hồi quyền mặc định rộng của PUBLIC.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE :"DBNAME" FROM PUBLIC;
SQL

psql_admin <<'SQL'
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
SQL

echo "Đã khởi tạo ${#SERVICES[@]} schema/role: ${SERVICES[*]}"
