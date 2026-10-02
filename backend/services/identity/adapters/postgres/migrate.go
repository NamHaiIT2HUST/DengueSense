package postgres

import (
	"errors"
	"fmt"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	// Đăng ký driver "pgx5" của golang-migrate.
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/migrations"
)

func newMigrator(dsn string) (*migrate.Migrate, error) {
	rest, ok := strings.CutPrefix(dsn, "postgres://")
	if !ok {
		rest, ok = strings.CutPrefix(dsn, "postgresql://")
	}
	if !ok {
		return nil, errors.New("DSN Postgres phải bắt đầu bằng postgres://") // không in DSN (có mật khẩu)
	}
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return nil, fmt.Errorf("đọc migration nhúng: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, "pgx5://"+rest)
	if err != nil {
		return nil, errors.New("không khởi tạo được migrate (kiểm tra kết nối/quyền)")
	}
	return m, nil
}

// MigrateUp áp mọi migration chưa chạy lên schema `identity` (bảng theo dõi nằm cùng schema). Idempotent.
func MigrateUp(dsn string) error {
	m, err := newMigrator(dsn)
	if err != nil {
		return err
	}
	defer func() { _, _ = m.Close() }()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}

// MigrateDown hoàn tác MỌI migration — CHỈ dùng cho test trên DB thử nghiệm.
func MigrateDown(dsn string) error {
	m, err := newMigrator(dsn)
	if err != nil {
		return err
	}
	defer func() { _, _ = m.Close() }()
	if err := m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate down: %w", err)
	}
	return nil
}
