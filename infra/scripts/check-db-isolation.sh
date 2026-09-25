#!/usr/bin/env bash
# Kiểm tra cô lập dữ liệu giữa các service (docs/09 §9.1, ADR-0002) trên Postgres THẬT.
# Chạy (từ thư mục gốc repo):
#   docker compose -f infra/docker-compose.yml exec -T postgres bash -s < infra/scripts/check-db-isolation.sh
# Thoát 0 nếu mọi kiểm tra đạt, 1 nếu có kiểm tra thất bại.
#
# Kết nối qua IP của container (không phải localhost) vì image mặc định `trust` cho 127.0.0.1 —
# đi qua IP container mới bắt buộc xác thực mật khẩu như service thật.
set -uo pipefail

SERVICES=(identity surveillance forecast optimize workflow genai notification)
HOST="$(hostname -i | awk '{print $1}')"
fail=0
pass() { echo "  OK   $*"; }
bad() { echo "  FAIL $*"; fail=1; }

# q <service> <sql> : chạy SQL bằng đúng user DB của service; in kết quả (cả lỗi) ra stdout.
q() {
  local svc="$1" sql="$2" var
  var="SVC_$(echo "$svc" | tr '[:lower:]' '[:upper:]')_PASSWORD"
  PGPASSWORD="${!var}" psql -h "$HOST" -U "svc_${svc}" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tA -c "$sql" 2>&1
}

echo "1) Mỗi service tạo/ghi/đọc/xoá được bảng trong schema CỦA MÌNH"
for s in "${SERVICES[@]}"; do
  out="$(q "$s" "CREATE TABLE ${s}._probe(i int); INSERT INTO ${s}._probe VALUES (1); SELECT count(*) FROM ${s}._probe; DROP TABLE ${s}._probe;")"
  if echo "$out" | grep -q '^1$'; then pass "svc_${s}"; else bad "svc_${s}: $out"; fi
done

echo "2) Không service nào tạo được bảng ở schema của service KHÁC hoặc ở public"
for s in "${SERVICES[@]}"; do
  for t in "${SERVICES[@]}" public; do
    [ "$s" = "$t" ] && continue
    out="$(q "$s" "CREATE TABLE ${t}._intruder(i int);")"
    if echo "$out" | grep -qi 'permission denied'; then :; else bad "svc_${s} tạo được bảng ở ${t}: $out"; fi
  done
  pass "svc_${s} bị chặn ở mọi schema khác"
done

echo "3) Không đọc được dữ liệu của service khác"
q workflow "CREATE TABLE workflow._secret(v text); INSERT INTO workflow._secret VALUES ('mat');" >/dev/null
for s in "${SERVICES[@]}"; do
  [ "$s" = "workflow" ] && continue
  out="$(q "$s" "SELECT v FROM workflow._secret;")"
  if echo "$out" | grep -qi 'permission denied'; then :; else bad "svc_${s} đọc được workflow._secret: $out"; fi
done
pass "6 service còn lại đọc workflow._secret đều bị từ chối"
q workflow "DROP TABLE workflow._secret;" >/dev/null

echo "4) Role không có đặc quyền nguy hiểm"
for s in "${SERVICES[@]}"; do
  out="$(q "$s" "SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname = current_user;")"
  if [ "$out" = "f" ]; then :; else bad "svc_${s} có đặc quyền (superuser/createdb/createrole): $out"; fi
done
pass "không role nào là superuser / createdb / createrole"

echo "5) search_path mặc định trỏ vào schema của service"
for s in "${SERVICES[@]}"; do
  out="$(q "$s" "SHOW search_path;")"
  if [ "$out" = "${s}, public" ]; then :; else bad "svc_${s} search_path = '$out'"; fi
done
pass "search_path đúng cho cả 7 service"

echo "6) Extension: PostGIS (surveillance) và pgvector (genai) dùng được"
out="$(q surveillance "SELECT ST_AsText(ST_MakePoint(105.8, 21.0));")"
if [ "$out" = "POINT(105.8 21)" ]; then pass "PostGIS"; else bad "PostGIS: $out"; fi
out="$(q genai "SELECT '[1,2,3]'::vector <-> '[1,2,4]'::vector;")"
if [ "$out" = "1" ]; then pass "pgvector"; else bad "pgvector: $out"; fi

echo "7) Sai mật khẩu bị từ chối"
out="$(PGPASSWORD=sai-mat-khau psql -h "$HOST" -U svc_forecast -d "$POSTGRES_DB" -tA -c 'SELECT 1' 2>&1)"
if echo "$out" | grep -qi 'authentication failed'; then pass "từ chối mật khẩu sai"; else bad "chấp nhận mật khẩu sai: $out"; fi

echo
if [ "$fail" -eq 0 ]; then echo "TẤT CẢ ĐẠT"; else echo "CÓ KIỂM TRA THẤT BẠI"; fi
exit "$fail"
