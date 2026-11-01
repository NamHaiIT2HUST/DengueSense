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

func TestReviewDraftTransaction(t *testing.T) {
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
	caseID := uuid.New()
	now := time.Now().UTC()
	require.NoError(t, repo.CreateCase(ctx, &domain.Case{ID: caseID, Title: "Kiểm thử giao dịch duyệt", Status: domain.CaseStatusOpen, CreatedBy: "officer", CreatedAt: now, UpdatedAt: now}))
	draft := domain.NewDispatchDraft(caseID, domain.DraftTypeB2G, "Công điện", "Nội dung", "0192f0e1-7c1a-7000-8000-000000000001")
	require.NoError(t, repo.CreateDraft(ctx, draft))
	newReview := func(actor string) *domain.Review {
		return &domain.Review{ID: uuid.New(), DraftID: draft.ID, DraftVersion: 1, ReviewerID: actor, Action: domain.ReviewActionApprove, ReviewedAt: time.Now().UTC()}
	}
	// Vi phạm ràng buộc reviewer_id không được lưu nửa chừng trạng thái APPROVED.
	_, err = repo.ReviewDraft(ctx, newReview(strings.Repeat("a", 101)))
	require.Error(t, err)
	stored, err := repo.GetDraftByID(ctx, draft.ID)
	require.NoError(t, err)
	require.Equal(t, domain.DraftStatusPendingReview, stored.Status)
	var count int
	require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM reviews WHERE draft_id=$1`, draft.ID).Scan(&count))
	require.Zero(t, count)
	// Hai lần duyệt đồng thời: chỉ một review được ghi và trạng thái chốt một lần.
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, reviewErr := repo.ReviewDraft(ctx, newReview(uuid.NewString()))
			errs <- reviewErr
		}()
	}
	wg.Wait()
	close(errs)
	successes := 0
	for reviewErr := range errs {
		if reviewErr == nil {
			successes++
		} else {
			require.ErrorIs(t, reviewErr, domain.ErrInvalidDraftTransition)
		}
	}
	require.Equal(t, 1, successes)
	stored, err = repo.GetDraftByID(ctx, draft.ID)
	require.NoError(t, err)
	require.Equal(t, domain.DraftStatusApproved, stored.Status)
	require.NoError(t, db.QueryRow(ctx, `SELECT count(*) FROM reviews WHERE draft_id=$1`, draft.ID).Scan(&count))
	require.Equal(t, 1, count)
}
