package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

type Repo struct {
	db *pgxpool.Pool
}

func NewRepo(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

// ---------------------------------------------------------------------
// AlertRepository
// ---------------------------------------------------------------------

func (r *Repo) CreateAlert(ctx context.Context, alert *domain.Alert) error {
	query := `INSERT INTO alerts (id, run_id, province_id, created_at, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`
	_, err := r.db.Exec(ctx, query, alert.ID, alert.RunID, alert.ProvinceID, alert.CreatedAt, alert.Status)
	return err
}

func (r *Repo) GetAlertByID(ctx context.Context, id uuid.UUID) (*domain.Alert, error) {
	query := `SELECT id, run_id, province_id, created_at, status FROM alerts WHERE id = $1`
	row := r.db.QueryRow(ctx, query, id)

	var alert domain.Alert
	err := row.Scan(&alert.ID, &alert.RunID, &alert.ProvinceID, &alert.CreatedAt, &alert.Status)
	if err != nil {
		return nil, err
	}
	return &alert, nil
}

func (r *Repo) ListAlerts(ctx context.Context, status string, runID *uuid.UUID) ([]domain.Alert, error) {
	query := `SELECT id, run_id, province_id, created_at, status FROM alerts WHERE 1=1`
	args := []any{}
	paramIdx := 1

	if status != "all" && status != "" {
		query += fmt.Sprintf(` AND status = $%d`, paramIdx)
		args = append(args, status)
		paramIdx++
	}

	if runID != nil {
		query += fmt.Sprintf(` AND run_id = $%d`, paramIdx)
		args = append(args, *runID)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []domain.Alert
	for rows.Next() {
		var a domain.Alert
		if err := rows.Scan(&a.ID, &a.RunID, &a.ProvinceID, &a.CreatedAt, &a.Status); err != nil {
			return nil, err
		}
		alerts = append(alerts, a)
	}
	return alerts, rows.Err()
}

func (r *Repo) UpdateAlertStatus(ctx context.Context, id uuid.UUID, status domain.AlertStatus) error {
	query := `UPDATE alerts SET status = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, status, id)
	return err
}

// ConfirmAlertWithCase khoá cảnh báo, tạo hồ sơ và đóng cảnh báo trong một giao dịch.
func (r *Repo) ConfirmAlertWithCase(ctx context.Context, id uuid.UUID, actorID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var status string
	if err := tx.QueryRow(ctx, `SELECT status FROM alerts WHERE id=$1 FOR UPDATE`, id).Scan(&status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrAlertNotFound
		}
		return err
	}
	if status == string(domain.AlertStatusClosed) {
		var linked bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM case_alerts WHERE alert_id=$1)`, id).Scan(&linked); err != nil {
			return err
		}
		if linked {
			return tx.Commit(ctx)
		}
		// Khôi phục cảnh báo bị đóng dở bởi phiên bản cũ nhưng chưa có hồ sơ.
	}
	caseID, now := uuid.New(), time.Now().UTC()
	_, err = tx.Exec(ctx, `INSERT INTO cases (id, alert_id, title, status, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)`, caseID, id, "Hồ sơ xử lý cảnh báo dịch", domain.CaseStatusOpen, actorID, now)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO case_alerts (case_id, alert_id) VALUES ($1,$2)`, caseID, id); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE alerts SET status=$1 WHERE id=$2`, domain.AlertStatusClosed, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------
// CaseRepository
// ---------------------------------------------------------------------

func (r *Repo) CreateCase(ctx context.Context, c *domain.Case) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var legacyAlertID *uuid.UUID
	if len(c.AlertIDs) > 0 {
		legacyAlertID = &c.AlertIDs[0]
	}

	query := `INSERT INTO cases (id, alert_id, title, status, created_by, created_at, updated_at) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err = tx.Exec(ctx, query, c.ID, legacyAlertID, c.Title, c.Status, c.CreatedBy, c.CreatedAt, c.UpdatedAt)
	if err != nil {
		return err
	}

	for _, alertID := range c.AlertIDs {
		_, err = tx.Exec(ctx, `INSERT INTO case_alerts (case_id, alert_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, c.ID, alertID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *Repo) GetCaseByID(ctx context.Context, id uuid.UUID) (*domain.Case, error) {
	row := r.db.QueryRow(ctx, `SELECT id, title, status, created_by, created_at, updated_at FROM cases WHERE id = $1`, id)
	var c domain.Case
	err := row.Scan(&c.ID, &c.Title, &c.Status, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Lấy danh sách alert_ids thuộc case
	rows, err := r.db.Query(ctx, `SELECT alert_id FROM case_alerts WHERE case_id = $1`, id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var alertID uuid.UUID
			if err := rows.Scan(&alertID); err == nil {
				c.AlertIDs = append(c.AlertIDs, alertID)
			}
		}
	}

	return &c, nil
}

func (r *Repo) ListCases(ctx context.Context, status string) ([]domain.Case, error) {
	query := `SELECT id, title, status, created_by, created_at, updated_at FROM cases WHERE 1=1`
	args := []any{}
	if status != "" && status != "all" {
		query += ` AND status = $1`
		args = append(args, status)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cases []domain.Case
	for rows.Next() {
		var c domain.Case
		if err := rows.Scan(&c.ID, &c.Title, &c.Status, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		cases = append(cases, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(cases) > 0 {
		caseIDs := make([]uuid.UUID, len(cases))
		caseMap := make(map[uuid.UUID]*domain.Case, len(cases))
		for i := range cases {
			caseIDs[i] = cases[i].ID
			caseMap[cases[i].ID] = &cases[i]
		}
		alertRows, err := r.db.Query(ctx, `SELECT case_id, alert_id FROM case_alerts WHERE case_id = ANY($1)`, caseIDs)
		if err == nil {
			defer alertRows.Close()
			for alertRows.Next() {
				var cid, aid uuid.UUID
				if err := alertRows.Scan(&cid, &aid); err == nil {
					if cs, ok := caseMap[cid]; ok {
						cs.AlertIDs = append(cs.AlertIDs, aid)
					}
				}
			}
		}
	}

	return cases, nil
}

func (r *Repo) AddAlertToCase(ctx context.Context, caseID, alertID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `INSERT INTO case_alerts (case_id, alert_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, caseID, alertID)
	return err
}

func (r *Repo) UpdateCaseStatus(ctx context.Context, id uuid.UUID, status domain.CaseStatus) error {
	_, err := r.db.Exec(ctx, `UPDATE cases SET status = $1, updated_at = $2 WHERE id = $3`, status, time.Now().UTC(), id)
	return err
}

func (r *Repo) CreateAllocationPlan(ctx context.Context, plan *domain.AllocationPlan) error {
	allocBytes, err := json.Marshal(plan.Allocations)
	if err != nil {
		return fmt.Errorf("không thể serialize allocations: %w", err)
	}

	if plan.Status == "" {
		plan.Status = domain.AllocationPlanStatusDraft
	}
	if plan.Version <= 0 {
		plan.Version = 1
	}

	query := `INSERT INTO allocation_plans (id, case_id, budget, total_cost, estimated_cases_prevented, allocations, created_at, status, version, confirmed_by, confirmed_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err = r.db.Exec(ctx, query, plan.ID, plan.CaseID, plan.Budget, plan.TotalCost, plan.EstimatedCasesPrevented, allocBytes, plan.CreatedAt, plan.Status, plan.Version, plan.ConfirmedBy, plan.ConfirmedAt)
	return err
}

func (r *Repo) ListAllocationPlansByCase(ctx context.Context, caseID uuid.UUID) ([]domain.AllocationPlan, error) {
	rows, err := r.db.Query(ctx, `SELECT id, case_id, budget, total_cost, estimated_cases_prevented, allocations, created_at, status, version, confirmed_by, confirmed_at 
	                             FROM allocation_plans WHERE case_id = $1 ORDER BY created_at DESC`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var plans []domain.AllocationPlan
	for rows.Next() {
		var p domain.AllocationPlan
		var allocBytes []byte
		if err := rows.Scan(&p.ID, &p.CaseID, &p.Budget, &p.TotalCost, &p.EstimatedCasesPrevented, &allocBytes, &p.CreatedAt, &p.Status, &p.Version, &p.ConfirmedBy, &p.ConfirmedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(allocBytes, &p.Allocations)
		plans = append(plans, p)
	}
	return plans, rows.Err()
}

func (r *Repo) ConfirmAllocationPlan(ctx context.Context, caseID, planID uuid.UUID, confirmedBy string) (*domain.AllocationPlan, error) {
	now := time.Now().UTC()
	// Chỉ chuyển đổi trạng thái nếu plan đang là 'draft'.
	// Đảm bảo tính bất biến: nếu đã 'confirmed', giữ nguyên confirmed_at và confirmed_by để không thay đổi hash snapshot.
	query := `UPDATE allocation_plans 
	          SET status = 'confirmed', confirmed_by = $1, confirmed_at = $2 
	          WHERE id = $3 AND case_id = $4 AND status = 'draft' 
	          RETURNING id, case_id, budget, total_cost, estimated_cases_prevented, allocations, created_at, status, version, confirmed_by, confirmed_at`
	var p domain.AllocationPlan
	var allocBytes []byte
	err := r.db.QueryRow(ctx, query, confirmedBy, now, planID, caseID).Scan(
		&p.ID, &p.CaseID, &p.Budget, &p.TotalCost, &p.EstimatedCasesPrevented, &allocBytes, &p.CreatedAt, &p.Status, &p.Version, &p.ConfirmedBy, &p.ConfirmedAt,
	)
	if err == nil {
		_ = json.Unmarshal(allocBytes, &p.Allocations)
		return &p, nil
	}

	// Nếu không có dòng nào được update, kiểm tra xem plan đã được xác nhận từ trước hay chưa (trả về snapshot bất biến)
	getErr := r.db.QueryRow(ctx, `SELECT id, case_id, budget, total_cost, estimated_cases_prevented, allocations, created_at, status, version, confirmed_by, confirmed_at 
	                              FROM allocation_plans WHERE id = $1 AND case_id = $2`, planID, caseID).Scan(
		&p.ID, &p.CaseID, &p.Budget, &p.TotalCost, &p.EstimatedCasesPrevented, &allocBytes, &p.CreatedAt, &p.Status, &p.Version, &p.ConfirmedBy, &p.ConfirmedAt,
	)
	if getErr != nil {
		return nil, getErr
	}
	_ = json.Unmarshal(allocBytes, &p.Allocations)
	return &p, nil
}

// ---------------------------------------------------------------------
// DraftRepository
// ---------------------------------------------------------------------

func (r *Repo) CreateDraft(ctx context.Context, draft *domain.DispatchDraft) error {
	query := `INSERT INTO dispatch_drafts (id, case_id, version, draft_type, title, content, content_hash, status, created_by, created_at, updated_at, generation_evidence)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	_, err := r.db.Exec(ctx, query,
		draft.ID, draft.CaseID, draft.Version, string(draft.DraftType), draft.Title,
		draft.Content, draft.ContentHash, string(draft.Status), draft.CreatedBy,
		draft.CreatedAt, draft.UpdatedAt, draft.GenerationEvidence,
	)
	return err
}

func (r *Repo) GetDraftByID(ctx context.Context, id uuid.UUID) (*domain.DispatchDraft, error) {
	row := r.db.QueryRow(ctx, `SELECT id, case_id, version, draft_type, title, content, content_hash, status, created_by, created_at, updated_at, generation_evidence
	                          FROM dispatch_drafts WHERE id = $1`, id)
	var d domain.DispatchDraft
	var dt, st string
	err := row.Scan(&d.ID, &d.CaseID, &d.Version, &dt, &d.Title, &d.Content, &d.ContentHash, &st, &d.CreatedBy, &d.CreatedAt, &d.UpdatedAt, &d.GenerationEvidence)
	if err != nil {
		return nil, err
	}
	d.DraftType = domain.DraftType(dt)
	d.Status = domain.DraftStatus(st)
	return &d, nil
}

func (r *Repo) UpdateDraft(ctx context.Context, draft *domain.DispatchDraft) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	query := `UPDATE dispatch_drafts SET version = $1, title = $2, content = $3, content_hash = $4, status = $5, updated_at = $6 WHERE id = $7`
	_, err = tx.Exec(ctx, query, draft.Version, draft.Title, draft.Content, draft.ContentHash, string(draft.Status), draft.UpdatedAt, draft.ID)
	if err != nil {
		return err
	}

	// Lưu revision
	revID := uuid.New()
	_, err = tx.Exec(ctx, `INSERT INTO draft_revisions (id, draft_id, version, content, content_hash, updated_by, created_at)
	                       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		revID, draft.ID, draft.Version, draft.Content, draft.ContentHash, draft.CreatedBy, draft.UpdatedAt,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *Repo) ListDraftsByCase(ctx context.Context, caseID uuid.UUID) ([]domain.DispatchDraft, error) {
	rows, err := r.db.Query(ctx, `SELECT id, case_id, version, draft_type, title, content, content_hash, status, created_by, created_at, updated_at, generation_evidence
	                             FROM dispatch_drafts WHERE case_id = $1 ORDER BY created_at DESC`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drafts []domain.DispatchDraft
	for rows.Next() {
		var d domain.DispatchDraft
		var dt, st string
		if err := rows.Scan(&d.ID, &d.CaseID, &d.Version, &dt, &d.Title, &d.Content, &d.ContentHash, &st, &d.CreatedBy, &d.CreatedAt, &d.UpdatedAt, &d.GenerationEvidence); err != nil {
			return nil, err
		}
		d.DraftType = domain.DraftType(dt)
		d.Status = domain.DraftStatus(st)
		drafts = append(drafts, d)
	}
	return drafts, rows.Err()
}

func (r *Repo) CreateReview(ctx context.Context, review *domain.Review) error {
	query := `INSERT INTO reviews (id, draft_id, draft_version, reviewer_id, action, note, reviewed_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7)`
	_, err := r.db.Exec(ctx, query, review.ID, review.DraftID, review.DraftVersion, review.ReviewerID, string(review.Action), review.Note, review.ReviewedAt)
	return err
}

func (r *Repo) GetLatestReviewByDraft(ctx context.Context, draftID uuid.UUID) (*domain.Review, error) {
	row := r.db.QueryRow(ctx, `SELECT id, draft_id, draft_version, reviewer_id, action, note, reviewed_at 
	                          FROM reviews WHERE draft_id = $1 ORDER BY reviewed_at DESC LIMIT 1`, draftID)
	var rev domain.Review
	var act string
	err := row.Scan(&rev.ID, &rev.DraftID, &rev.DraftVersion, &rev.ReviewerID, &act, &rev.Note, &rev.ReviewedAt)
	if err != nil {
		return nil, err
	}
	rev.Action = domain.ReviewAction(act)
	return &rev, nil
}

func (r *Repo) CreateDispatchOrder(ctx context.Context, order *domain.DispatchOrder) error {
	query := `INSERT INTO dispatch_orders (id, case_id, draft_id, recipient, content, content_hash, status, created_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := r.db.Exec(ctx, query, order.ID, order.CaseID, order.DraftID, order.Recipient, order.Content, order.ContentHash, string(order.Status), order.CreatedAt)
	return err
}

func (r *Repo) GetOrderByID(ctx context.Context, id uuid.UUID) (*domain.DispatchOrder, error) {
	row := r.db.QueryRow(ctx, `SELECT id, case_id, draft_id, recipient, content, content_hash, status, created_at, sent_at 
	                          FROM dispatch_orders WHERE id = $1`, id)
	var o domain.DispatchOrder
	var st string
	err := row.Scan(&o.ID, &o.CaseID, &o.DraftID, &o.Recipient, &o.Content, &o.ContentHash, &st, &o.CreatedAt, &o.SentAt)
	if err != nil {
		return nil, err
	}
	o.Status = domain.OrderStatus(st)
	return &o, nil
}

func (r *Repo) UpdateOrderStatus(ctx context.Context, id uuid.UUID, status domain.OrderStatus) error {
	now := time.Now().UTC()
	query := `UPDATE dispatch_orders SET status = $1, sent_at = $2 WHERE id = $3`
	_, err := r.db.Exec(ctx, query, string(status), now, id)
	return err
}
