package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

type Repo struct {
	db *pgxpool.Pool
}

func NewRepo(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

func (r *Repo) CreateAlert(ctx context.Context, alert *domain.Alert) error {
	query := `INSERT INTO alerts (id, run_id, province_id, created_at, status) VALUES ($1, $2, $3, $4, $5)`
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

func (r *Repo) CreateCase(ctx context.Context, c *domain.Case) error {
	query := `INSERT INTO cases (id, alert_id, created_at) VALUES ($1, $2, $3)`
	_, err := r.db.Exec(ctx, query, c.ID, c.AlertID, c.CreatedAt)
	return err
}

func (r *Repo) UpdateAlertStatus(ctx context.Context, id uuid.UUID, status domain.AlertStatus) error {
	query := `UPDATE alerts SET status = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, status, id)
	return err
}
