package postgres_test

import (
	"context"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

// Chỉ dùng database thử nghiệm riêng và trống.
func TestConfirmAlertTransaction(t *testing.T) {
	dsn := os.Getenv("TEST_WORKFLOW_REPO_DB")
	if dsn == "" {
		t.Skip("cần database thử nghiệm riêng")
	}
	require.NoError(t, postgres.MigrateUp(dsn))
	ctx := context.Background()
	db, err := pgxpool.New(ctx, dsn)
	require.NoError(t, err)
	defer db.Close()
	repo := postgres.NewRepo(db)
	id := uuid.New()
	require.NoError(t, repo.CreateAlert(ctx, &domain.Alert{ID: id, RunID: uuid.New(), ProvinceID: "ha_noi", CreatedAt: time.Now(), Status: domain.AlertStatusOpen}))
	// Lỗi lưu hồ sơ không được đóng cảnh báo.
	require.Error(t, repo.ConfirmAlertWithCase(ctx, id, strings.Repeat("a", 101)))
	alert, err := repo.GetAlertByID(ctx, id)
	require.NoError(t, err)
	require.Equal(t, domain.AlertStatusOpen, alert.Status)
	// Các yêu cầu đồng thời hoặc gửi lại chỉ mở đúng một hồ sơ.
	var wg sync.WaitGroup
	errs := make(chan error, 6)
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); errs <- repo.ConfirmAlertWithCase(ctx, id, "officer-1") }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	var count int
	var actor string
	require.NoError(t, db.QueryRow(ctx, `SELECT count(*), min(created_by) FROM cases WHERE alert_id=$1`, id).Scan(&count, &actor))
	require.Equal(t, 1, count)
	require.Equal(t, "officer-1", actor)
	alert, err = repo.GetAlertByID(ctx, id)
	require.NoError(t, err)
	require.Equal(t, domain.AlertStatusClosed, alert.Status)
	require.ErrorIs(t, repo.ConfirmAlertWithCase(ctx, uuid.New(), "officer-1"), domain.ErrAlertNotFound)
	legacyID := uuid.New()
	require.NoError(t, repo.CreateAlert(ctx, &domain.Alert{ID: legacyID, RunID: uuid.New(), ProvinceID: "ha_noi", CreatedAt: time.Now(), Status: domain.AlertStatusClosed}))
	require.NoError(t, repo.ConfirmAlertWithCase(ctx, legacyID, "officer-2"))
	require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM case_alerts WHERE alert_id=$1`, legacyID).Scan(&count))
	require.Equal(t, 1, count)
}
