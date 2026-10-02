package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type AlertStatus string

const (
	AlertStatusOpen   AlertStatus = "open"
	AlertStatusClosed AlertStatus = "closed"
)

type Alert struct {
	ID         uuid.UUID
	RunID      uuid.UUID
	ProvinceID string
	CreatedAt  time.Time
	Status     AlertStatus
}

type Case struct {
	ID        uuid.UUID
	AlertID   uuid.UUID
	CreatedAt time.Time
}

// AlertRepository định nghĩa giao thức với DB cho các thao tác liên quan tới Alert/Case.
type AlertRepository interface {
	CreateAlert(ctx context.Context, alert *Alert) error
	GetAlertByID(ctx context.Context, id uuid.UUID) (*Alert, error)
	ListAlerts(ctx context.Context, status string, runID *uuid.UUID) ([]Alert, error)

	CreateCase(ctx context.Context, c *Case) error
	UpdateAlertStatus(ctx context.Context, id uuid.UUID, status AlertStatus) error
}
