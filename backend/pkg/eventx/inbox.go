package eventx

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// InboxStore quản lý trạng thái xử lý sự kiện để đảm bảo tính Idempotent (docs/09 §7.4).
type InboxStore interface {
	// AlreadyProcessed kiểm tra xem sự kiện với `eventID` đã được xử lý thành công trước đó chưa.
	AlreadyProcessed(ctx context.Context, eventID uuid.UUID) (bool, error)

	// RecordProcessed ghi nhận sự kiện đã được xử lý vào inbox (bất biến, idempotent).
	RecordProcessed(ctx context.Context, eventID uuid.UUID, eventType string) error
}

// PgxInboxStore hiện thực InboxStore trên PostgreSQL.
type PgxInboxStore struct {
	pool      *pgxpool.Pool
	tableName string
}

// NewPgxInboxStore tạo kho inbox trên PostgreSQL (mặc định bảng "inbox").
func NewPgxInboxStore(pool *pgxpool.Pool, table string) *PgxInboxStore {
	if table == "" {
		table = "inbox"
	}
	return &PgxInboxStore{pool: pool, tableName: table}
}

// EnsureSchema tạo bảng inbox nếu chưa tồn tại.
func (s *PgxInboxStore) EnsureSchema(ctx context.Context) error {
	query := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (
			event_id     uuid        PRIMARY KEY,
			event_type   text        NOT NULL,
			processed_at timestamptz NOT NULL DEFAULT now()
		);
	`, s.tableName)
	_, err := s.pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("tạo bảng inbox (%s): %w", s.tableName, err)
	}
	return nil
}

// AlreadyProcessed kiểm tra xem event_id đã tồn tại trong bảng inbox chưa.
func (s *PgxInboxStore) AlreadyProcessed(ctx context.Context, eventID uuid.UUID) (bool, error) {
	query := fmt.Sprintf(`SELECT EXISTS(SELECT 1 FROM %s WHERE event_id = $1)`, s.tableName)
	var exists bool
	if err := s.pool.QueryRow(ctx, query, eventID).Scan(&exists); err != nil {
		return false, fmt.Errorf("kiểm tra inbox (%s): %w", s.tableName, err)
	}
	return exists, nil
}

// RecordProcessed chèn event_id vào bảng inbox. Nếu đã tồn tại thì bỏ qua (ON CONFLICT DO NOTHING).
func (s *PgxInboxStore) RecordProcessed(ctx context.Context, eventID uuid.UUID, eventType string) error {
	query := fmt.Sprintf(`
		INSERT INTO %s (event_id, event_type, processed_at)
		VALUES ($1, $2, now())
		ON CONFLICT (event_id) DO NOTHING
	`, s.tableName)
	_, err := s.pool.Exec(ctx, query, eventID, eventType)
	if err != nil {
		return fmt.Errorf("ghi nhận inbox (%s): %w", s.tableName, err)
	}
	return nil
}

// InMemoryInboxStore lưu trạng thái sự kiện trong bộ nhớ cho kiểm thử.
type InMemoryInboxStore struct {
	mu        sync.RWMutex
	processed map[uuid.UUID]time.Time
}

// NewInMemoryInboxStore tạo kho inbox trong bộ nhớ.
func NewInMemoryInboxStore() *InMemoryInboxStore {
	return &InMemoryInboxStore{
		processed: make(map[uuid.UUID]time.Time),
	}
}

// AlreadyProcessed kiểm tra ID trong bộ nhớ.
func (m *InMemoryInboxStore) AlreadyProcessed(_ context.Context, eventID uuid.UUID) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	_, ok := m.processed[eventID]
	return ok, nil
}

// RecordProcessed lưu ID vào bộ nhớ.
func (m *InMemoryInboxStore) RecordProcessed(_ context.Context, eventID uuid.UUID, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.processed[eventID] = time.Now()
	return nil
}

// Count đếm số lượng sự kiện đã xử lý.
func (m *InMemoryInboxStore) Count() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.processed)
}

// Verify interfaces
var (
	_ InboxStore = (*PgxInboxStore)(nil)
	_ InboxStore = (*InMemoryInboxStore)(nil)
)
