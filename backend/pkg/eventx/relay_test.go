package eventx_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
)

func TestRelay_RunOnce_Success(t *testing.T) {
	ctx := context.Background()
	store := eventx.NewInMemoryOutboxStore()
	pub := eventx.NewInMemoryPublisher(10)

	id1 := uuid.Must(uuid.NewV7())
	id2 := uuid.Must(uuid.NewV7())

	env1, err := eventx.New("denguesense/surveillance", eventx.TypeDataVersionPublished, 1, "version/v0.3.0", eventx.DataVersionPublished{
		DataVersion: "v0.3.0", FirstMonth: "1994-01", LastMonth: "2025-12", RealShare: 0.727,
	})
	require.NoError(t, err)
	raw1, err := json.Marshal(env1)
	require.NoError(t, err)

	env2, err := eventx.New("denguesense/forecast", eventx.TypeForecastRunCompleted, 1, "run/test", eventx.ForecastRunCompleted{
		RunID: id2.String(), RunMode: "backtest", OriginMonth: "2010-03", ModelVersion: "m4-r2@1.0.0",
		DataVersion: "v0.2.0", ProvinceCount: 34, Horizons: []int{1, 2, 3, 6},
	})
	require.NoError(t, err)
	raw2, err := json.Marshal(env2)
	require.NoError(t, err)

	store.Add(eventx.OutboxRecord{ID: id1, EventType: env1.Type, Payload: raw1, CreatedAt: time.Now().Add(-2 * time.Minute)})
	store.Add(eventx.OutboxRecord{ID: id2, EventType: env2.Type, Payload: raw2, CreatedAt: time.Now().Add(-1 * time.Minute)})

	assert.Equal(t, 2, store.UnpublishedCount())

	relay := eventx.NewRelay(store, pub, eventx.RelayOptions{
		BatchSize:    10,
		PollInterval: 100 * time.Millisecond,
	})

	count, err := relay.RunOnce(ctx)
	require.NoError(t, err)
	assert.Equal(t, 2, count)

	// Kiểm tra đã phát đủ 2 sự kiện
	assert.Equal(t, 2, pub.Count())
	events := pub.Events()
	assert.Equal(t, eventx.TypeDataVersionPublished, events[0].Type)
	assert.Equal(t, eventx.TypeForecastRunCompleted, events[1].Type)

	// Kho outbox không còn bản ghi chưa phát
	assert.Equal(t, 0, store.UnpublishedCount())

	// Lần chạy tiếp theo không có sự kiện nào
	count2, err := relay.RunOnce(ctx)
	require.NoError(t, err)
	assert.Equal(t, 0, count2)
}

func TestRelay_PublisherFails_HaltsAndPreservesUnpublished(t *testing.T) {
	ctx := context.Background()
	store := eventx.NewInMemoryOutboxStore()
	pub := eventx.NewInMemoryPublisher(10)

	id := uuid.Must(uuid.NewV7())
	env, err := eventx.New("denguesense/surveillance", eventx.TypeDataVersionPublished, 1, "version/v0.3.0", eventx.DataVersionPublished{
		DataVersion: "v0.3.0", FirstMonth: "1994-01", LastMonth: "2025-12", RealShare: 0.727,
	})
	require.NoError(t, err)
	raw, err := json.Marshal(env)
	require.NoError(t, err)

	store.Add(eventx.OutboxRecord{ID: id, EventType: env.Type, Payload: raw, CreatedAt: time.Now()})

	// Giả lập lỗi publisher
	pub.SetFailNext(errors.New("nats timeout"))

	relay := eventx.NewRelay(store, pub, eventx.RelayOptions{BatchSize: 10})
	count, err := relay.RunOnce(ctx)
	assert.Error(t, err)
	assert.Equal(t, 0, count)

	// Bản ghi vẫn chưa được đánh dấu published
	assert.Equal(t, 1, store.UnpublishedCount())

	// Thử lại khi publisher hoạt động bình thường
	count, err = relay.RunOnce(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, count)
	assert.Equal(t, 0, store.UnpublishedCount())
}

func TestRelay_Notify_WakesUpImmediately(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	store := eventx.NewInMemoryOutboxStore()
	pub := eventx.NewInMemoryPublisher(10)

	// PollInterval đặt dài 10 giây
	relay := eventx.NewRelay(store, pub, eventx.RelayOptions{
		BatchSize:    10,
		PollInterval: 10 * time.Second,
	})

	go func() {
		_ = relay.Run(ctx)
	}()

	env, err := eventx.New("denguesense/surveillance", eventx.TypeDataVersionPublished, 1, "ver", eventx.DataVersionPublished{
		DataVersion: "v0.3.0", FirstMonth: "1994-01", LastMonth: "2025-12", RealShare: 0.727,
	})
	require.NoError(t, err)
	raw, _ := json.Marshal(env)
	recordID := uuid.MustParse(env.ID)
	store.Add(eventx.OutboxRecord{ID: recordID, EventType: env.Type, Payload: raw, CreatedAt: time.Now()})

	// Gọi Notify đánh thức relay ngay
	relay.Notify()

	// Chờ sự kiện xuất hiện trong kênh PublishedChan (không quá 500ms)
	select {
	case msg := <-pub.PublishedChan():
		assert.Equal(t, env.ID, msg.Envelope.ID)
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Relay không thức dậy kịp thời sau khi gọi Notify")
	}
}
