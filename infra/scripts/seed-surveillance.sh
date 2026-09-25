#!/usr/bin/env bash
# Nạp dữ liệu tham chiếu và panel v0.2.0 vào `surveillance` (chạy lại được: idempotent, phiên bản bất biến).
#
#   bash infra/scripts/seed-surveillance.sh            # từ thư mục gốc repo
#
# Cần: stack đã dựng (`docker compose ... up -d --build`) và ai-service/data/processed/v0.2.0/ đã có
# (dữ liệu nằm ngoài git: dựng bằng `python -m app.data.build_panel` ở ai-service).
set -euo pipefail

# Git Bash (Windows) tự đổi "/data/..." thành đường dẫn Windows — tắt để đường dẫn trong container giữ nguyên.
export MSYS_NO_PATHCONV=1

COMPOSE=(docker compose -f infra/docker-compose.yml)
CLI=("${COMPOSE[@]}" --profile tools run --rm --no-deps surveillance-cli)

echo "== Nạp danh mục 34 tỉnh + ranh giới 2025-07"
"${CLI[@]}" seed -provinces /data/province_metadata.csv -geometry /data/provinces.geojson -geometry-version 2025-07

echo "== Nhập panel v0.2.0 (kiểm đầy đủ như API công bố)"
"${CLI[@]}" import-panel -panel /data/processed/v0.2.0/panel_monthly.parquet \
  -manifest /data/processed/v0.2.0/manifest.json -version v0.2.0
