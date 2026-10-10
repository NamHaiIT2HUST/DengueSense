#!/usr/bin/env bash
# Khởi tạo các tài khoản người dùng chuẩn cho thử nghiệm DengueSense (idempotent)
set -euo pipefail

create_user() {
  local user="$1"
  local pass="$2"
  local name="$3"
  local org="$4"
  local roles="$5"

  echo "== Khởi tạo tài khoản: $user ($roles)..."
  out=$(docker compose -f infra/docker-compose.yml exec -T -e IDENTITY_NEW_PASSWORD="$pass" identity /service create-user -username "$user" -display-name "$name" -org "$org" -roles "$roles" 2>&1 || true)
  if [[ "$out" == *"tên đăng nhập đã tồn tại"* ]]; then
    echo "   -> Tài khoản '$user' đã tồn tại sẵn trong hệ thống."
  else
    echo "   -> $out"
  fi
}

create_user "officer" "officer123456" "Cán bộ điều hành CDC" "cdc-hcm" "officer"
create_user "approver" "approver123456" "Lãnh đạo phê duyệt CDC" "cdc-hcm" "approver"
create_user "dev-analyst" "ujMOTLmI2sRHa7X-oN7L9oky" "Chuyên viên dịch tễ" "cdc-hcm" "analyst"
create_user "dev-viewer" "a6BlIE3BM_whDmzRPxIbMK6O" "Người theo dõi" "cdc-hcm" "viewer"

echo "== Khởi tạo tài khoản hoàn tất!"
