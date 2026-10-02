#!/usr/bin/env bash
# Tạo database THỬ NGHIỆM `<POSTGRES_DB>_test` với đủ schema/role như DB chính (chạy lại được, idempotent).
# Các bộ kiểm tích hợp (vd services/identity/adapters/postgres) XOÁ dữ liệu nên CHỈ chạy trên DB tên kết thúc `_test`.
#
# Chạy (từ thư mục gốc repo):
#   docker compose -f infra/docker-compose.yml exec -T postgres bash -s < infra/scripts/create-test-db.sh
set -euo pipefail

TEST_DB="${POSTGRES_DB}_test"

exists="$(psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${TEST_DB}'")"
if [ "$exists" != "1" ]; then
  createdb -U "$POSTGRES_USER" "$TEST_DB"
  echo "đã tạo database ${TEST_DB}"
else
  echo "database ${TEST_DB} đã có"
fi

# Dùng lại đúng script khởi tạo của DB chính, trỏ sang DB thử nghiệm (script viết idempotent).
POSTGRES_DB="$TEST_DB" bash /docker-entrypoint-initdb.d/01-roles-and-schemas.sh
