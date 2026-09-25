#!/bin/sh
# Tạo stream JetStream cho DengueSense (idempotent). Chạy trong container natsio/nats-box.
#   EVENTS : mọi sự kiện nghiệp vụ, giữ 30 ngày (để phát lại / gỡ lỗi).
#   DLQ    : sự kiện consumer xử lý thất bại quá số lần retry (docs/09 §7.4), giữ 90 ngày.
set -eu

NATS_URL="${NATS_URL:-nats://nats:4222}"

ensure_stream() {
  name="$1"; shift
  if nats --server "$NATS_URL" stream info "$name" >/dev/null 2>&1; then
    echo "stream $name đã tồn tại — bỏ qua"
  else
    nats --server "$NATS_URL" stream add "$name" "$@" --defaults
    echo "đã tạo stream $name"
  fi
}

ensure_stream EVENTS \
  --subjects "surveillance.>,forecast.>,optimize.>,workflow.>,genai.>,notification.>" \
  --storage file --retention limits --max-age 30d --discard old \
  --dupe-window 2m --replicas 1

ensure_stream DLQ \
  --subjects "DLQ.>" \
  --storage file --retention limits --max-age 90d --discard old --replicas 1
