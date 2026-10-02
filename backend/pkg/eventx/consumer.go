package eventx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// Handler là hàm xử lý nghiệp vụ của consumer khi nhận được sự kiện CloudEvents.
type Handler func(ctx context.Context, env Envelope) error

// ConsumerOptions cấu hình cơ chế xử lý, thử lại và DLQ (docs/09 §7.4).
type ConsumerOptions struct {
	// MaxAttempts là số lần thử tối đa trước khi đưa vào DLQ (mặc định: 5).
	MaxAttempts int

	// Backoff danh sách thời gian chờ giữa các lần thử (mặc định: 1s, 5s, 30s, 2m, 10m).
	Backoff []time.Duration

	// DLQPublisher publisher để phát sự kiện sang stream DLQ khi thất bại quá số lần thử.
	DLQPublisher Publisher

	// DLQPrefix tiền tố subject DLQ (mặc định: "DLQ.").
	DLQPrefix string

	// Logger ghi nhật ký.
	Logger *slog.Logger
}

// DefaultBackoff trả về lịch trình backoff chuẩn theo tài liệu docs/09 §7.4.
func DefaultBackoff() []time.Duration {
	return []time.Duration{
		1 * time.Second,
		5 * time.Second,
		30 * time.Second,
		2 * time.Minute,
		10 * time.Minute,
	}
}

// Consumer thực thi việc nhận sự kiện, kiểm tra Idempotency và điều phối thử lại/DLQ.
type Consumer struct {
	inbox   InboxStore
	handler Handler
	opts    ConsumerOptions
}

// NewConsumer tạo Consumer với các thiết lập an toàn.
func NewConsumer(inbox InboxStore, handler Handler, opts ConsumerOptions) *Consumer {
	if opts.MaxAttempts <= 0 {
		opts.MaxAttempts = 5
	}
	if len(opts.Backoff) == 0 {
		opts.Backoff = DefaultBackoff()
	}
	if opts.DLQPrefix == "" {
		opts.DLQPrefix = "DLQ."
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	return &Consumer{
		inbox:   inbox,
		handler: handler,
		opts:    opts,
	}
}

// HandleMessage nhận một thông điệp dạng byte (JSON Envelope), kiểm tra inbox và xử lý.
func (c *Consumer) HandleMessage(ctx context.Context, raw []byte) error {
	var env Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return fmt.Errorf("giải mã CloudEvents envelope: %w", err)
	}

	eventID, err := uuid.Parse(env.ID)
	if err != nil {
		return fmt.Errorf("id sự kiện không phải UUID hợp lệ (%q): %w", env.ID, err)
	}

	// 1. Kiểm tra Idempotency trong inbox (docs/09 §7.4: nhận trùng thì bỏ qua)
	processed, err := c.inbox.AlreadyProcessed(ctx, eventID)
	if err != nil {
		return fmt.Errorf("kiểm tra inbox cho sự kiện %s: %w", env.ID, err)
	}
	if processed {
		c.opts.Logger.DebugContext(ctx, "sự kiện đã được xử lý trước đó — bỏ qua (idempotent)",
			"event_id", env.ID, "type", env.Type)
		return nil
	}

	// 2. Vòng lặp thử lại với exponential backoff
	var lastErr error
	for attempt := 1; attempt <= c.opts.MaxAttempts; attempt++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		err := c.handler(ctx, env)
		if err == nil {
			// Xử lý thành công -> lưu vào inbox
			if recErr := c.inbox.RecordProcessed(ctx, eventID, env.Type); recErr != nil {
				c.opts.Logger.ErrorContext(ctx, "lưu inbox thất bại sau khi xử lý thành công",
					"event_id", env.ID, "error", recErr.Error())
				return recErr
			}
			return nil
		}

		lastErr = err
		c.opts.Logger.WarnContext(ctx, "xử lý sự kiện thất bại",
			"event_id", env.ID,
			"type", env.Type,
			"attempt", attempt,
			"max_attempts", c.opts.MaxAttempts,
			"error", err.Error(),
		)

		if attempt < c.opts.MaxAttempts {
			backoffIdx := attempt - 1
			if backoffIdx >= len(c.opts.Backoff) {
				backoffIdx = len(c.opts.Backoff) - 1
			}
			waitTime := c.opts.Backoff[backoffIdx]

			select {
			case <-time.After(waitTime):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	// 3. Quá 5 lần thử: chuyển sang stream DLQ.<type> + log error (docs/09 §7.4)
	c.opts.Logger.ErrorContext(ctx, "xử lý sự kiện vượt quá số lần thử tối đa — chuyển sang DLQ",
		"event_id", env.ID,
		"type", env.Type,
		"attempts", c.opts.MaxAttempts,
		"error", lastErr.Error(),
	)

	if c.opts.DLQPublisher != nil {
		dlqSubject := c.opts.DLQPrefix + env.Type
		if pubErr := c.opts.DLQPublisher.PublishToSubject(ctx, dlqSubject, env); pubErr != nil {
			c.opts.Logger.ErrorContext(ctx, "phát sự kiện vào DLQ thất bại",
				"event_id", env.ID, "dlq_subject", dlqSubject, "error", pubErr.Error())
		}
	}

	// Đánh dấu đã qua xử lý trong inbox để tránh poison pill kẹt vĩnh viễn trên bus
	_ = c.inbox.RecordProcessed(ctx, eventID, env.Type)

	return fmt.Errorf("sự kiện %s (%s) thất bại sau %d lần thử: %w", env.Type, env.ID, c.opts.MaxAttempts, lastErr)
}

// ErrConsumerMaxAttempts trả lỗi khi consumer thất bại sau nhiều lần thử.
var ErrConsumerMaxAttempts = errors.New("vượt quá số lần thử tối đa của consumer")
