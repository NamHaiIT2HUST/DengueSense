package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type NotificationStatus string

const (
	StatusPending NotificationStatus = "PENDING"
	StatusSent    NotificationStatus = "SENT"
	StatusFailed  NotificationStatus = "FAILED"
)

type Notification struct {
	ID          uuid.UUID
	OrderID     uuid.UUID
	Recipient   string
	Subject     string
	Content     string
	ContentHash string
	Status      NotificationStatus
	Attempts    int
	LastError   string
	CreatedAt   time.Time
	SentAt      *time.Time
}

type EmailSender interface {
	SendEmail(ctx context.Context, recipient, subject, content string) error
}

type NotificationRepository interface {
	CreateNotification(ctx context.Context, n *Notification) error
	GetNotificationByID(ctx context.Context, id uuid.UUID) (*Notification, error)
	UpdateNotificationStatus(ctx context.Context, id uuid.UUID, status NotificationStatus, attempts int, lastErr string) error
}
