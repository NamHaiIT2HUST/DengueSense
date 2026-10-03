package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/notification/domain"
)

type Repo struct {
	db *pgxpool.Pool
}

func NewRepo(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

func (r *Repo) CreateNotification(ctx context.Context, n *domain.Notification) error {
	query := `INSERT INTO notifications (id, order_id, recipient, subject, content, content_hash, status, attempts, last_error, created_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`
	_, err := r.db.Exec(ctx, query, n.ID, n.OrderID, n.Recipient, n.Subject, n.Content, n.ContentHash, string(n.Status), n.Attempts, n.LastError, n.CreatedAt)
	return err
}

func (r *Repo) GetNotificationByID(ctx context.Context, id uuid.UUID) (*domain.Notification, error) {
	row := r.db.QueryRow(ctx, `SELECT id, order_id, recipient, subject, content, content_hash, status, attempts, last_error, created_at, sent_at
	                          FROM notifications WHERE id = $1`, id)
	var n domain.Notification
	var st string
	err := row.Scan(&n.ID, &n.OrderID, &n.Recipient, &n.Subject, &n.Content, &n.ContentHash, &st, &n.Attempts, &n.LastError, &n.CreatedAt, &n.SentAt)
	if err != nil {
		return nil, err
	}
	n.Status = domain.NotificationStatus(st)
	return &n, nil
}

func (r *Repo) UpdateNotificationStatus(ctx context.Context, id uuid.UUID, status domain.NotificationStatus, attempts int, lastErr string) error {
	now := time.Now().UTC()
	var sentAt *time.Time
	if status == domain.StatusSent {
		sentAt = &now
	}
	query := `UPDATE notifications SET status = $1, attempts = $2, last_error = $3, sent_at = $4 WHERE id = $5`
	_, err := r.db.Exec(ctx, query, string(status), attempts, lastErr, sentAt, id)
	return err
}
