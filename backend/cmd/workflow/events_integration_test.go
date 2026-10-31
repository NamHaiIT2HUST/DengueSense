package main

import (
	"context"
	"errors"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
)

type flakyForecast struct{ calls atomic.Int32 }

func (f *flakyForecast) CheckRunAlerts(context.Context, uuid.UUID) ([]string, error) {
	if f.calls.Add(1) == 1 {
		return nil, errors.New("forecast temporarily unavailable")
	}
	return []string{"ha_noi"}, nil
}

// Chỉ chạy trên PostgreSQL và NATS thử nghiệm riêng, không dùng môi trường đang vận hành.
func TestForecastEventsIntegration(t *testing.T) {
	dsn, natsURL := os.Getenv("TEST_WORKFLOW_EVENTS_DB"), os.Getenv("TEST_WORKFLOW_EVENTS_NATS")
	if dsn == "" || natsURL == "" {
		t.Skip("cần PostgreSQL và NATS thử nghiệm riêng")
	}
	ctx := context.Background()
	require.NoError(t, postgres.MigrateUp(dsn))
	db, err := pgxpool.New(ctx, dsn)
	require.NoError(t, err)
	defer db.Close()
	nc, err := nats.Connect(natsURL)
	require.NoError(t, err)
	defer nc.Close()
	js, err := nc.JetStream()
	require.NoError(t, err)
	_, err = js.AddStream(&nats.StreamConfig{Name: "EVENTS", Subjects: []string{"forecast.>"}})
	require.NoError(t, err)
	publisher, err := eventx.NewJetStreamPublisherFromConn(nc)
	require.NoError(t, err)
	runID := uuid.New()
	newEvent := func() eventx.Envelope {
		env, err := eventx.New("denguesense/forecast", eventx.TypeForecastRunCompleted, 1, "run/"+runID.String(), eventx.ForecastRunCompleted{RunID: runID.String()})
		require.NoError(t, err)
		return env
	}
	// Sự kiện được phát trước khi workflow kết nối vẫn phải được xử lý.
	require.NoError(t, publisher.Publish(ctx, newEvent()))
	forecast := &flakyForecast{}
	svc := app.NewWorkflowService(postgres.NewRepo(db), forecast)
	consumer := eventx.NewConsumer(eventx.NewPgxInboxStore(db, "inbox"), svc.HandleForecastRunCompleted, eventx.ConsumerOptions{MaxAttempts: 1})
	sub, err := subscribeForecastEvents(js, consumer)
	require.NoError(t, err)
	defer func() { _ = sub.Unsubscribe() }()
	count := func() int {
		var n int
		require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM alerts WHERE run_id=$1`, runID).Scan(&n))
		return n
	}
	require.Eventually(t, func() bool { return count() == 1 }, 20*time.Second, 100*time.Millisecond)
	require.GreaterOrEqual(t, forecast.calls.Load(), int32(2))
	// Sự kiện ID khác nhưng cùng run không được tạo cảnh báo trùng.
	require.NoError(t, publisher.Publish(ctx, newEvent()))
	require.Eventually(t, func() bool {
		var n int
		require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM inbox`).Scan(&n))
		return n == 2
	}, 5*time.Second, 100*time.Millisecond)
	require.Equal(t, 1, count())
}
