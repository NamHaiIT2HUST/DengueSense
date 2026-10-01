package eventx_test

import (
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
)

func TestConsumer_Idempotency_SkipsDuplicates(t *testing.T) {
	ctx := context.Background()
	inbox := eventx.NewInMemoryInboxStore()

	var callCount int32
	handler := func(_ context.Context, env eventx.Envelope) error {
		atomic.AddInt32(&callCount, 1)
		return nil
	}

	consumer := eventx.NewConsumer(inbox, handler, eventx.ConsumerOptions{
		MaxAttempts: 3,
		Backoff:     []time.Duration{1 * time.Millisecond},
	})

	env, err := eventx.New("denguesense/surveillance", eventx.TypeDataVersionPublished, 1, "test", eventx.DataVersionPublished{
		DataVersion: "v0.3.0", FirstMonth: "1994-01", LastMonth: "2025-12", RealShare: 0.727,
	})
	require.NoError(t, err)
	raw, err := json.Marshal(env)
	require.NoError(t, err)

	// Lần 1: Xử lý thành công
	err = consumer.HandleMessage(ctx, raw)
	require.NoError(t, err)
	assert.Equal(t, int32(1), atomic.LoadInt32(&callCount))

	eventUUID := uuid.MustParse(env.ID)
	processed, err := inbox.AlreadyProcessed(ctx, eventUUID)
	require.NoError(t, err)
	assert.True(t, processed)

	// Lần 2: Gửi lại cùng sự kiện (mô phỏng giao lại - at-least-once delivery)
	err = consumer.HandleMessage(ctx, raw)
	require.NoError(t, err)
	// Handler KHÔNG được gọi lại
	assert.Equal(t, int32(1), atomic.LoadInt32(&callCount))
}

func TestConsumer_RetriesAndRoutesToDLQ(t *testing.T) {
	ctx := context.Background()
	inbox := eventx.NewInMemoryInboxStore()
	dlqPub := eventx.NewInMemoryPublisher(10)

	var attempts int32
	handler := func(_ context.Context, _ eventx.Envelope) error {
		atomic.AddInt32(&attempts, 1)
		return errors.New("lỗi tạm thời xử lý dữ liệu")
	}

	consumer := eventx.NewConsumer(inbox, handler, eventx.ConsumerOptions{
		MaxAttempts:  3,
		Backoff:      []time.Duration{1 * time.Millisecond, 2 * time.Millisecond},
		DLQPublisher: dlqPub,
		DLQPrefix:    "DLQ.",
	})

	env, err := eventx.New("denguesense/surveillance", eventx.TypeDataVersionPublished, 1, "test", eventx.DataVersionPublished{
		DataVersion: "v0.3.0", FirstMonth: "1994-01", LastMonth: "2025-12", RealShare: 0.727,
	})
	require.NoError(t, err)
	raw, err := json.Marshal(env)
	require.NoError(t, err)

	err = consumer.HandleMessage(ctx, raw)
	assert.Error(t, err)
	assert.Equal(t, int32(3), atomic.LoadInt32(&attempts))

	// Kiểm tra đã phát vào DLQ
	assert.Equal(t, 1, dlqPub.Count())
	dlqMsgs := dlqPub.Messages()
	assert.Equal(t, "DLQ."+eventx.TypeDataVersionPublished, dlqMsgs[0].Subject)
	assert.Equal(t, env.ID, dlqMsgs[0].Envelope.ID)

	// Sự kiện được đánh dấu trong inbox để tránh lặp vô hạn (poison pill)
	eventUUID := uuid.MustParse(env.ID)
	processed, _ := inbox.AlreadyProcessed(ctx, eventUUID)
	assert.True(t, processed)
}
