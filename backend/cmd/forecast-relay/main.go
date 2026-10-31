// forecast-relay chuyển outbox của forecast sang JetStream theo cơ chế at-least-once.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
)

// Một giao dịch giữ khóa đến khi JetStream xác nhận và published_at được ghi.
// Nếu tiến trình chết giữa publish và commit, sự kiện sẽ được gửi lại.
func relayOne(ctx context.Context, db *pgxpool.Pool, publisher eventx.Publisher) (bool, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()
	var id uuid.UUID
	var eventType string
	var payload []byte
	err = tx.QueryRow(ctx, `SELECT id, event_type, payload FROM outbox WHERE published_at IS NULL ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1`).Scan(&id, &eventType, &payload)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var env eventx.Envelope
	if err := json.Unmarshal(payload, &env); err != nil {
		return false, fmt.Errorf("outbox %s: envelope không hợp lệ: %w", id, err)
	}
	if env.ID != id.String() || env.Type != eventType || env.ID == "" {
		return false, fmt.Errorf("outbox %s: ID hoặc loại sự kiện không khớp", id)
	}
	if err := publisher.Publish(ctx, env); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx, `UPDATE outbox SET published_at = now() WHERE id = $1`, id); err != nil {
		return false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := pgxpool.New(ctx, os.Getenv("FORECAST_DB_URL"))
	if err != nil {
		slog.Error("không thể cấu hình DB", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	publisher, err := eventx.NewJetStreamPublisher(os.Getenv("NATS_URL"))
	if err != nil {
		slog.Error("không thể kết nối NATS", "error", err)
		os.Exit(1)
	}
	defer func() { _ = publisher.Close() }()
	for ctx.Err() == nil {
		found, err := relayOne(ctx, db, publisher)
		if err != nil && ctx.Err() == nil {
			slog.Error("chuyển tiếp outbox thất bại", "error", err)
		}
		if err != nil || !found {
			select {
			case <-ctx.Done():
			case <-time.After(time.Second):
			}
		}
	}
}
