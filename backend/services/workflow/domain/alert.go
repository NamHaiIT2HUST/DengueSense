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

// AlertRepository định nghĩa giao thức với DB cho các thao tác liên quan tới Alert.
type AlertRepository interface {
	CreateAlert(ctx context.Context, alert *Alert) error
	GetAlertByID(ctx context.Context, id uuid.UUID) (*Alert, error)
	ListAlerts(ctx context.Context, status string, runID *uuid.UUID) ([]Alert, error)
	UpdateAlertStatus(ctx context.Context, id uuid.UUID, status AlertStatus) error
}
