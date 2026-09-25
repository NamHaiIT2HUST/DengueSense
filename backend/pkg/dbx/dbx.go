// Package dbx: kết nối Postgres (pgx/v5) và helper transaction (docs/09 §9, ADR-0002).
//
// Mỗi service kết nối bằng user DB RIÊNG chỉ có quyền trên schema của mình; `search_path` được đặt
// ở mức role bởi infra/postgres/init, nên câu SQL trong service không cần tiền tố schema.
package dbx

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Options điều chỉnh pool. Giá trị 0 nghĩa là dùng mặc định.
type Options struct {
	MaxConns       int32
	ConnectTimeout time.Duration
}

// Connect mở pool và kiểm tra kết nối ngay (fail fast lúc khởi động). Lỗi KHÔNG chứa DSN (có mật khẩu).
func Connect(ctx context.Context, dsn string, opt Options) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, errors.New("DSN Postgres không hợp lệ") // không bọc err: thông báo gốc có thể chứa DSN
	}
	if opt.MaxConns > 0 {
		cfg.MaxConns = opt.MaxConns
	} else {
		cfg.MaxConns = 10
	}
	timeout := opt.ConnectTimeout
	if timeout == 0 {
		timeout = 5 * time.Second
	}
	cfg.ConnConfig.ConnectTimeout = timeout
	cfg.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, errors.New("không tạo được pool Postgres")
	}
	pingCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("không kết nối được Postgres: %w", sanitize(err))
	}
	return pool, nil
}

// sanitize giữ loại lỗi (timeout, từ chối kết nối…) nhưng bỏ chi tiết có thể chứa địa chỉ/tài khoản.
func sanitize(err error) error {
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return context.DeadlineExceeded
	case errors.Is(err, context.Canceled):
		return context.Canceled
	default:
		return errors.New("kết nối bị từ chối hoặc xác thực thất bại")
	}
}

// Ready dùng làm httpx.ReadyFunc: pool còn ping được.
func Ready(pool *pgxpool.Pool) func(context.Context) error {
	return func(ctx context.Context) error { return pool.Ping(ctx) }
}

// InTx chạy fn trong một transaction: commit nếu fn trả nil, rollback nếu lỗi hoặc panic.
// Dùng cho mẫu outbox: ghi thay đổi nghiệp vụ và sự kiện trong CÙNG transaction (docs/09 §7.4).
func InTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) (err error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	committed := false
	defer func() {
		if committed {
			return
		}
		// Rollback bằng context không bị huỷ để vẫn dọn được khi ctx của request đã bị huỷ.
		rbCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if rbErr := tx.Rollback(rbCtx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			err = errors.Join(err, fmt.Errorf("rollback: %w", rbErr))
		}
	}()
	if err = fn(tx); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	committed = true
	return nil
}
