#!/usr/bin/env bash
# Linux/macOS: đặt bốn mật khẩu trong môi trường trước khi chạy; không lưu trong Git.
set -euo pipefail

: "${DEMO_OFFICER_PASSWORD:?thiếu DEMO_OFFICER_PASSWORD}"
: "${DEMO_APPROVER_PASSWORD:?thiếu DEMO_APPROVER_PASSWORD}"
: "${DEV_ANALYST_PASSWORD:?thiếu DEV_ANALYST_PASSWORD}"
: "${DEV_VIEWER_PASSWORD:?thiếu DEV_VIEWER_PASSWORD}"

create_user() {
  local user="$1" password="$2" name="$3" role="$4" output
  if output=$(IDENTITY_NEW_PASSWORD="$password" docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml \
    exec -T -e IDENTITY_NEW_PASSWORD identity /service create-user \
    -username "$user" -display-name "$name" -org cdc-hcm -roles "$role" 2>&1); then
    echo "Đã tạo $user ($role)."
  elif [[ "$output" == *"tên đăng nhập đã tồn tại"* ]]; then
    echo "$user đã tồn tại; giữ mật khẩu cũ."
  else
    echo "Không tạo được $user: $output" >&2
    return 1
  fi
}

create_user local-officer "$DEMO_OFFICER_PASSWORD" 'Cán bộ điều hành CDC' officer
create_user local-approver "$DEMO_APPROVER_PASSWORD" 'Lãnh đạo phê duyệt CDC' approver
create_user dev-analyst "$DEV_ANALYST_PASSWORD" 'Chuyên viên dịch tễ' analyst
create_user dev-viewer "$DEV_VIEWER_PASSWORD" 'Người theo dõi' viewer
