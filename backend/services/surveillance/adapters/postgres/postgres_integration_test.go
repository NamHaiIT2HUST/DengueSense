package postgres_test

// Kiểm thử tích hợp trên Postgres THẬT. Bỏ qua nếu không đặt TEST_DATABASE_URL.
//
// AN TOÀN: bộ kiểm XOÁ dữ liệu bảng của schema surveillance, nên CHỈ chạy trên database có tên kết thúc bằng `_test`
// (tạo bằng infra/scripts/create-test-db.sh).
//
//	TEST_DATABASE_URL="postgres://svc_surveillance:<mật khẩu>@127.0.0.1:<cổng>/denguesense_test?sslmode=disable" \
//	    go test ./services/surveillance/adapters/postgres/...

import (
	"context"
	"os"
	"regexp"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/dbx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/repotest"
)

func testPool(t *testing.T) (*pgxpool.Pool, string) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("bỏ qua: chưa đặt TEST_DATABASE_URL")
	}
	pool, err := dbx.Connect(context.Background(), dsn, dbx.Options{MaxConns: 10})
	require.NoError(t, err)
	t.Cleanup(pool.Close)

	var db, schema string
	require.NoError(t, pool.QueryRow(context.Background(), `SELECT current_database(), current_schema()`).Scan(&db, &schema))
	if !regexp.MustCompile(`_test$`).MatchString(db) {
		t.Skipf("bỏ qua: database %q không kết thúc bằng _test — bộ kiểm này xoá dữ liệu", db)
	}
	require.Equal(t, "surveillance", schema, "search_path của svc_surveillance phải trỏ vào schema surveillance")
	return pool, dsn
}

func TestMigrationsUpDownUpAreRepeatable(t *testing.T) {
	_, dsn := testPool(t)
	require.NoError(t, postgres.MigrateDown(dsn), "down từ trạng thái bất kỳ")
	require.NoError(t, postgres.MigrateUp(dsn))
	require.NoError(t, postgres.MigrateUp(dsn), "up lần hai là no-op")
	require.NoError(t, postgres.MigrateDown(dsn))
	require.NoError(t, postgres.MigrateUp(dsn))
}

func TestPostgresRepositorySatisfiesTheContract(t *testing.T) {
	pool, dsn := testPool(t)
	require.NoError(t, postgres.MigrateUp(dsn))
	repotest.Run(t, func(t *testing.T) repotest.Env {
		// TRUNCATE không kích hoạt trigger bất biến theo dòng — chỉ dùng ở DB _test.
		_, err := pool.Exec(context.Background(), `TRUNCATE outbox, observations, data_versions, geometry_versions, provinces CASCADE`)
		require.NoError(t, err)
		r := postgres.New(pool)
		return repotest.Env{Repo: r, OutboxCount: r.OutboxCount}
	})
}

func TestDatabaseEnforcesImmutability(t *testing.T) {
	pool, dsn := testPool(t)
	require.NoError(t, postgres.MigrateUp(dsn))
	ctx := context.Background()
	_, err := pool.Exec(ctx, `TRUNCATE outbox, observations, data_versions, geometry_versions, provinces CASCADE`)
	require.NoError(t, err)

	_, err = pool.Exec(ctx, `INSERT INTO provinces VALUES ('ha_noi', 'Hà Nội', 'Bắc')`)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO data_versions (version, published_at, first_month, last_month, real_share, n_rows, n_provinces, sha256, panel)
		VALUES ('v1.0.0', now(), '2010-01', '2010-01', 1, 1, 1, repeat('a', 64), '\x00')`)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO observations VALUES ('v1.0.0', 'ha_noi', '2010-01', 5, 0.5, 'real', 1000)`)
	require.NoError(t, err)
	_, err = pool.Exec(ctx, `INSERT INTO geometry_versions (version, geojson) VALUES ('g1', '{}')`)
	require.NoError(t, err)

	for name, stmt := range map[string]string{
		"sửa phiên bản":    `UPDATE data_versions SET real_share = 0.5`,
		"xoá phiên bản":    `DELETE FROM data_versions`,
		"sửa quan sát":     `UPDATE observations SET cases = 999`,
		"xoá quan sát":     `DELETE FROM observations`,
		"sửa ranh giới":    `UPDATE geometry_versions SET geojson = '[]'`,
		"xoá ranh giới":    `DELETE FROM geometry_versions`,
		"nguồn dữ liệu lạ": `INSERT INTO observations VALUES ('v1.0.0', 'ha_noi', '2010-02', 5, 0.5, 'bịa', 1)`,
		"số ca âm":         `INSERT INTO observations VALUES ('v1.0.0', 'ha_noi', '2010-03', -1, 0.5, 'real', 1)`,
		"tỉnh không có":    `INSERT INTO observations VALUES ('v1.0.0', 'khong_co', '2010-02', 5, 0.5, 'real', 1)`,
		"phiên bản sai dạng": `INSERT INTO data_versions (version, published_at, first_month, last_month, real_share, n_rows, n_provinces, sha256, panel)
			VALUES ('0.2.0', now(), '2010-01', '2010-01', 1, 1, 1, repeat('a', 64), '\x00')`,
	} {
		_, err := pool.Exec(ctx, stmt)
		assert.Error(t, err, name)
	}
}
