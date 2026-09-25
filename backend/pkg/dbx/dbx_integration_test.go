package dbx_test

// Kiểm thử tích hợp cần Postgres thật. Bỏ qua nếu không đặt TEST_DATABASE_URL.
// Chạy với stack compose:
//
//	TEST_DATABASE_URL="postgres://svc_forecast:<mật khẩu>@127.0.0.1:5432/denguesense" go test ./pkg/dbx/...

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/dbx"
)

func dsn(t *testing.T) string {
	t.Helper()
	v := os.Getenv("TEST_DATABASE_URL")
	if v == "" {
		t.Skip("bỏ qua: chưa đặt TEST_DATABASE_URL")
	}
	return v
}

func TestConnect_InvalidDSNAndUnreachableDoNotLeakCredentials(t *testing.T) {
	ctx := context.Background()

	_, err := dbx.Connect(ctx, "://mat-khau:HUHU@@@", dbx.Options{})
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "HUHU")

	// Cổng đóng: phải lỗi nhanh, và lỗi không chứa mật khẩu/địa chỉ.
	start := time.Now()
	_, err = dbx.Connect(ctx, "postgres://u:S3CR3T@127.0.0.1:1/db?sslmode=disable", dbx.Options{ConnectTimeout: 2 * time.Second})
	require.Error(t, err)
	assert.Less(t, time.Since(start), 6*time.Second)
	assert.NotContains(t, err.Error(), "S3CR3T")
	assert.NotContains(t, err.Error(), "127.0.0.1")
}

func TestInTx_CommitAndRollback(t *testing.T) {
	ctx := context.Background()
	pool, err := dbx.Connect(ctx, dsn(t), dbx.Options{MaxConns: 2})
	require.NoError(t, err)
	defer pool.Close()
	require.NoError(t, dbx.Ready(pool)(ctx))

	// Bảng thật (không phải TEMP) trong schema của chính service: InTx dùng kết nối khác của pool.
	table := "dbx_it_" + strings.ReplaceAll(time.Now().Format("150405.000"), ".", "")
	_, err = pool.Exec(ctx, "CREATE TABLE "+table+" (n int)")
	require.NoError(t, err)
	defer func() { _, _ = pool.Exec(ctx, "DROP TABLE IF EXISTS "+table) }()

	count := func() int {
		var n int
		require.NoError(t, pool.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&n))
		return n
	}

	require.NoError(t, dbx.InTx(ctx, pool, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, "INSERT INTO "+table+" VALUES (1)")
		return err
	}))
	assert.Equal(t, 1, count(), "commit")

	boom := errors.New("lỗi nghiệp vụ")
	err = dbx.InTx(ctx, pool, func(tx pgx.Tx) error {
		_, _ = tx.Exec(ctx, "INSERT INTO "+table+" VALUES (2)")
		return boom
	})
	assert.ErrorIs(t, err, boom)
	assert.Equal(t, 1, count(), "rollback khi fn lỗi")

	assert.Panics(t, func() {
		_ = dbx.InTx(ctx, pool, func(tx pgx.Tx) error {
			_, _ = tx.Exec(ctx, "INSERT INTO "+table+" VALUES (3)")
			panic("hoảng")
		})
	})
	assert.Equal(t, 1, count(), "rollback khi panic")
}
