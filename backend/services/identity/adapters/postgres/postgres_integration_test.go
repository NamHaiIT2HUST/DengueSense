package postgres_test

// Kiểm thử tích hợp trên Postgres THẬT. Bỏ qua nếu không đặt TEST_DATABASE_URL.
//
// AN TOÀN: bộ kiểm XOÁ dữ liệu bảng của schema identity, nên CHỈ chạy trên database có tên kết thúc bằng `_test`
// (tạo bằng infra/scripts/create-test-db.sh). Trỏ nhầm vào DB dev/pilot → bỏ qua kèm thông báo, không đụng dữ liệu.
//
//	TEST_DATABASE_URL="postgres://svc_identity:<mật khẩu>@127.0.0.1:<cổng>/denguesense_test?sslmode=disable" \
//	    go test ./services/identity/adapters/postgres/...

import (
	"context"
	"os"
	"regexp"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/dbx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/repotest"
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
	require.Equal(t, "identity", schema, "search_path của svc_identity phải trỏ vào schema identity")
	return pool, dsn
}

func TestMigrationsUpDownUpAreRepeatable(t *testing.T) {
	_, dsn := testPool(t)
	require.NoError(t, postgres.MigrateDown(dsn), "down từ trạng thái bất kỳ")
	require.NoError(t, postgres.MigrateUp(dsn))
	require.NoError(t, postgres.MigrateUp(dsn), "up lần hai là no-op")
	require.NoError(t, postgres.MigrateDown(dsn))
	require.NoError(t, postgres.MigrateUp(dsn), "up sau down (migration có thể hoàn tác và áp lại)")
}

func TestPostgresRepositoriesSatisfyTheContract(t *testing.T) {
	pool, dsn := testPool(t)
	require.NoError(t, postgres.MigrateUp(dsn))

	repotest.Run(t, func(t *testing.T) repotest.Repos {
		_, err := pool.Exec(context.Background(), `TRUNCATE refresh_tokens, users CASCADE`)
		require.NoError(t, err)
		return repotest.Repos{Users: postgres.NewUsers(pool), Tokens: postgres.NewTokens(pool)}
	})
}

func TestSchemaConstraintsRejectBadData(t *testing.T) {
	pool, dsn := testPool(t)
	require.NoError(t, postgres.MigrateUp(dsn))
	ctx := context.Background()
	_, err := pool.Exec(ctx, `TRUNCATE refresh_tokens, users CASCADE`)
	require.NoError(t, err)

	insert := func(username string, roles []string) error {
		_, err := pool.Exec(ctx,
			`INSERT INTO users (id, username, display_name, org_id, roles, password_hash) VALUES (gen_random_uuid(), $1, 'x', 'o', $2, 'h')`,
			username, roles)
		return err
	}
	assert.NoError(t, insert("hop.le", []string{"viewer"}))
	assert.Error(t, insert("HOA", []string{"viewer"}), "username in hoa bị CHECK chặn")
	assert.Error(t, insert("ab", []string{"viewer"}), "username quá ngắn")
	assert.Error(t, insert("khong.vai.tro", []string{}), "không được rỗng vai trò")
	assert.Error(t, insert("vai.tro.la", []string{"superuser"}), "vai trò ngoài enum bị CHECK chặn")

	_, err = pool.Exec(ctx, `INSERT INTO refresh_tokens (id, family_id, user_id, token_hash, created_at, expires_at)
		VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '\x00', now(), now())`)
	assert.Error(t, err, "hash sai độ dài + user không tồn tại")
}
