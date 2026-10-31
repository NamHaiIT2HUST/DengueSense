package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nats-io/nats.go"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
)

// URL này phải trỏ tới database thử nghiệm riêng; test tạo bảng outbox.
func TestRelayPostgres(t *testing.T) {
	dsn := os.Getenv("TEST_FORECAST_RELAY_DB")
	if dsn == "" {
		t.Skip("cần TEST_FORECAST_RELAY_DB là database thử nghiệm riêng")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, dsn)
	require.NoError(t, err)
	defer db.Close()
	_, err = db.Exec(ctx, `CREATE TABLE outbox (id uuid PRIMARY KEY, event_type text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz)`)
	require.NoError(t, err)
	env, err := eventx.New("denguesense/forecast", eventx.TypeForecastRunCompleted, 1, "run/test", eventx.ForecastRunCompleted{})
	require.NoError(t, err)
	raw, err := json.Marshal(env)
	require.NoError(t, err)
	_, err = db.Exec(ctx, `INSERT INTO outbox (id, event_type, payload) VALUES ($1, $2, $3)`, env.ID, env.Type, raw)
	require.NoError(t, err)
	publisher := eventx.NewInMemoryPublisher(0)
	publisher.SetFailNext(errors.New("nats unavailable"))
	_, err = relayOne(ctx, db, publisher)
	require.Error(t, err)
	var published bool
	require.NoError(t, db.QueryRow(ctx, `SELECT published_at IS NOT NULL FROM outbox WHERE id=$1`, env.ID).Scan(&published))
	require.False(t, published)
	found, err := relayOne(ctx, db, publisher)
	require.NoError(t, err)
	require.True(t, found)
	require.Equal(t, env.ID, publisher.Events()[0].ID)
	require.NoError(t, db.QueryRow(ctx, `SELECT published_at IS NOT NULL FROM outbox WHERE id=$1`, env.ID).Scan(&published))
	require.True(t, published)
	found, err = relayOne(ctx, db, publisher)
	require.NoError(t, err)
	require.False(t, found)

	if natsURL := os.Getenv("TEST_FORECAST_RELAY_NATS"); natsURL != "" {
		nc, err := nats.Connect(natsURL)
		require.NoError(t, err)
		defer nc.Close()
		js, err := nc.JetStream()
		require.NoError(t, err)
		_, err = js.StreamInfo("EVENTS")
		if err != nil {
			_, err = js.AddStream(&nats.StreamConfig{Name: "EVENTS", Subjects: []string{"forecast.>"}})
			require.NoError(t, err)
		}
		sub, err := nc.SubscribeSync(eventx.TypeForecastRunCompleted)
		require.NoError(t, err)
		require.NoError(t, nc.Flush())
		realPublisher, err := eventx.NewJetStreamPublisherFromConn(nc)
		require.NoError(t, err)
		second, err := eventx.New("denguesense/forecast", eventx.TypeForecastRunCompleted, 1, "run/test", eventx.ForecastRunCompleted{})
		require.NoError(t, err)
		secondRaw, err := json.Marshal(second)
		require.NoError(t, err)
		_, err = db.Exec(ctx, `INSERT INTO outbox (id, event_type, payload) VALUES ($1, $2, $3)`, second.ID, second.Type, secondRaw)
		require.NoError(t, err)
		found, err = relayOne(ctx, db, realPublisher)
		require.NoError(t, err)
		require.True(t, found)
		msg, err := sub.NextMsg(2 * time.Second)
		require.NoError(t, err)
		var received eventx.Envelope
		require.NoError(t, json.Unmarshal(msg.Data, &received))
		require.Equal(t, second.ID, received.ID)
	}
}
