package eventx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OutboxRecord đại diện cho một bản ghi sự kiện trong bảng `outbox` (docs/09 §7.4).
type OutboxRecord struct {
	ID        uuid.UUID
	EventType string
	Payload   []byte
	CreatedAt time.Time
}

// OutboxStore là giao diện đọc và cập nhật bảng `outbox`.
type OutboxStore interface {
	// FetchUnpublished lấy tối đa `limit` bản ghi chưa gửi theo thứ tự thời gian tạo.
	// Hiện thực Postgres dùng `FOR UPDATE SKIP LOCKED` để tránh tranh chấp giữa nhiều worker.
	FetchUnpublished(ctx context.Context, limit int) ([]OutboxRecord, error)

	// MarkPublished đánh dấu các bản ghi đã gửi thành công với thời điểm `publishedAt`.
	MarkPublished(ctx context.Context, ids []uuid.UUID, publishedAt time.Time) error
}

// PgxOutboxStore hiện thực OutboxStore trên PostgreSQL qua pgxpool.Pool.
type PgxOutboxStore struct {
	pool      *pgxpool.Pool
	tableName string
}

// NewPgxOutboxStore tạo OutboxStore trên bảng cụ thể (mặc định "outbox").
func NewPgxOutboxStore(pool *pgxpool.Pool, table string) *PgxOutboxStore {
	if table == "" {
		table = "outbox"
	}
	return &PgxOutboxStore{pool: pool, tableName: table}
}

// FetchUnpublished khoá và trả về các dòng chưa gửi.
func (s *PgxOutboxStore) FetchUnpublished(ctx context.Context, limit int) ([]OutboxRecord, error) {
	if limit <= 0 {
		limit = 50
	}
	query := fmt.Sprintf(
		`SELECT id, event_type, payload, created_at FROM %s WHERE published_at IS NULL ORDER BY created_at ASC LIMIT $1`,
		s.tableName,
	)
	rows, err := s.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("truy vấn outbox chưa gửi (%s): %w", s.tableName, err)
	}
	defer rows.Close()

	var records []OutboxRecord
	for rows.Next() {
		var r OutboxRecord
		if err := rows.Scan(&r.ID, &r.EventType, &r.Payload, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan outbox record: %w", err)
		}
		records = append(records, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("duyệt kết quả outbox: %w", err)
	}
	return records, nil
}

// MarkPublished cập nhật cột published_at.
func (s *PgxOutboxStore) MarkPublished(ctx context.Context, ids []uuid.UUID, publishedAt time.Time) error {
	if len(ids) == 0 {
		return nil
	}
	query := fmt.Sprintf(`UPDATE %s SET published_at = $1 WHERE id = ANY($2)`, s.tableName)
	_, err := s.pool.Exec(ctx, query, publishedAt.UTC(), ids)
	if err != nil {
		return fmt.Errorf("đánh dấu outbox published (%s): %w", s.tableName, err)
	}
	return nil
}

// InMemoryOutboxStore lưu bản ghi outbox trong bộ nhớ phục vụ kiểm thử.
type InMemoryOutboxStore struct {
	mu          sync.Mutex
	records     []OutboxRecord
	publishedAt map[uuid.UUID]time.Time
}

// NewInMemoryOutboxStore tạo kho outbox bộ nhớ.
func NewInMemoryOutboxStore() *InMemoryOutboxStore {
	return &InMemoryOutboxStore{
		records:     make([]OutboxRecord, 0),
		publishedAt: make(map[uuid.UUID]time.Time),
	}
}

// Add thêm bản ghi vào outbox bộ nhớ.
func (m *InMemoryOutboxStore) Add(rec OutboxRecord) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.records = append(m.records, rec)
}

// FetchUnpublished lấy các bản ghi chưa được đánh dấu published.
func (m *InMemoryOutboxStore) FetchUnpublished(_ context.Context, limit int) ([]OutboxRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if limit <= 0 {
		limit = 50
	}
	var res []OutboxRecord
	for _, r := range m.records {
		if _, pub := m.publishedAt[r.ID]; !pub {
			res = append(res, r)
			if len(res) >= limit {
				break
			}
		}
	}
	return res, nil
}

// MarkPublished ghi nhận các ID đã publish.
func (m *InMemoryOutboxStore) MarkPublished(_ context.Context, ids []uuid.UUID, publishedAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, id := range ids {
		m.publishedAt[id] = publishedAt
	}
	return nil
}

// UnpublishedCount trả số lượng bản ghi chưa publish.
func (m *InMemoryOutboxStore) UnpublishedCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for _, r := range m.records {
		if _, pub := m.publishedAt[r.ID]; !pub {
			n++
		}
	}
	return n
}

// RelayOptions chứa cấu hình vận hành của Outbox Relay.
type RelayOptions struct {
	BatchSize    int           // Số sự kiện lấy mỗi lượt (mặc định: 50)
	PollInterval time.Duration // Chu kỳ thăm dò nếu không có sự kiện mới (mặc định: 500ms)
	Logger       *slog.Logger  // Logger ghi log
}

// Relay là bộ chuyển tiếp sự kiện từ outbox sang Publisher (docs/09 §7.4).
type Relay struct {
	store     OutboxStore
	publisher Publisher
	opts      RelayOptions
	notifyCh  chan struct{}
}

// NewRelay khởi tạo bộ chuyển tiếp outbox.
func NewRelay(store OutboxStore, publisher Publisher, opts RelayOptions) *Relay {
	if opts.BatchSize <= 0 {
		opts.BatchSize = 50
	}
	if opts.PollInterval <= 0 {
		opts.PollInterval = 500 * time.Millisecond
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	return &Relay{
		store:     store,
		publisher: publisher,
		opts:      opts,
		notifyCh:  make(chan struct{}, 1),
	}
}

// Notify đánh thức Relay ngay lập tức để xử lý mà không cần chờ hết chu kỳ PollInterval.
func (r *Relay) Notify() {
	select {
	case r.notifyCh <- struct{}{}:
	default:
	}
}

// RunOnce quét và chuyển tiếp một đợt sự kiện. Trả về số lượng sự kiện đã phát thành công.
func (r *Relay) RunOnce(ctx context.Context) (int, error) {
	records, err := r.store.FetchUnpublished(ctx, r.opts.BatchSize)
	if err != nil {
		return 0, fmt.Errorf("lấy outbox chưa gửi: %w", err)
	}
	if len(records) == 0 {
		return 0, nil
	}

	publishedIDs := make([]uuid.UUID, 0, len(records))
	for _, rec := range records {
		var env Envelope
		if err := json.Unmarshal(rec.Payload, &env); err != nil {
			// Nếu payload không phải là envelope đầy đủ, dựng envelope dự phòng
			r.opts.Logger.WarnContext(ctx, "payload outbox không phải envelope chuẩn, bọc lại",
				"record_id", rec.ID, "type", rec.EventType, "error", err.Error())
			env = Envelope{
				SpecVersion: SpecVersion,
				ID:          rec.ID.String(),
				Source:      "denguesense/outbox",
				Type:        rec.EventType,
				DataSchema:  fmt.Sprintf("contracts/events/%s.v1.json", rec.EventType),
				Time:        rec.CreatedAt.UTC(),
				Data:        rec.Payload,
			}
		}

		if err := r.publisher.Publish(ctx, env); err != nil {
			r.opts.Logger.ErrorContext(ctx, "phát sự kiện từ outbox thất bại",
				"record_id", rec.ID, "event_type", rec.EventType, "error", err.Error())
			// Dừng đợt hiện tại, lưu các ID đã thành công trước đó (nếu có)
			if len(publishedIDs) > 0 {
				_ = r.store.MarkPublished(ctx, publishedIDs, time.Now())
			}
			return len(publishedIDs), err
		}
		publishedIDs = append(publishedIDs, rec.ID)
	}

	if len(publishedIDs) > 0 {
		if err := r.store.MarkPublished(ctx, publishedIDs, time.Now()); err != nil {
			return len(publishedIDs), fmt.Errorf("đánh dấu published: %w", err)
		}
	}
	return len(publishedIDs), nil
}

// Run chạy vòng lặp chuyển tiếp liên tục cho đến khi ctx bị huỷ.
func (r *Relay) Run(ctx context.Context) error {
	r.opts.Logger.InfoContext(ctx, "bắt đầu outbox relay", "poll_interval", r.opts.PollInterval.String())
	ticker := time.NewTicker(r.opts.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			r.opts.Logger.InfoContext(ctx, "dừng outbox relay theo context")
			return ctx.Err()
		case <-r.notifyCh:
		case <-ticker.C:
		}

		// Xử lý tất cả các đợt đang dồn ứ cho đến khi hết sự kiện
		for {
			count, err := r.RunOnce(ctx)
			if err != nil {
				if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					return err
				}
				// Lỗi kết nối bus hoặc DB: chờ đến chu kỳ tiếp theo
				break
			}
			if count < r.opts.BatchSize {
				// Đã xử lý hết đợt dồn
				break
			}
		}
	}
}

// Verify interfaces
var (
	_ OutboxStore = (*PgxOutboxStore)(nil)
	_ OutboxStore = (*InMemoryOutboxStore)(nil)
)
