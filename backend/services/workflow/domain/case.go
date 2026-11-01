package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type CaseStatus string

const (
	CaseStatusOpen      CaseStatus = "open"
	CaseStatusCompleted CaseStatus = "completed"
	CaseStatusArchived  CaseStatus = "archived"
)

type AllocationPlanStatus string

const (
	AllocationPlanStatusDraft     AllocationPlanStatus = "draft"
	AllocationPlanStatusConfirmed AllocationPlanStatus = "confirmed"
)

type Case struct {
	ID        uuid.UUID
	Title     string
	Status    CaseStatus
	AlertIDs  []uuid.UUID
	CreatedBy string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type AllocationItem struct {
	ProvinceID      string  `json:"province_id"`
	Amount          float64 `json:"amount"`
	Explanation     string  `json:"explanation"`
	Beds            int     `json:"beds,omitempty"`
	Supplies        int     `json:"supplies,omitempty"`
	Teams           int     `json:"teams,omitempty"`
	CasesPred       float64 `json:"cases_pred,omitempty"`
	ForecastRunID   string  `json:"forecast_run_id,omitempty"`
	ForecastHorizon int     `json:"forecast_horizon,omitempty"`
	CostInput       float64 `json:"cost_input,omitempty"`
}

type AllocationPlan struct {
	ID                      uuid.UUID
	CaseID                  uuid.UUID
	Budget                  float64
	TotalCost               float64
	EstimatedCasesPrevented float64
	Allocations             []AllocationItem
	Status                  AllocationPlanStatus
	Version                 int
	ConfirmedBy             *string
	ConfirmedAt             *time.Time
	CreatedAt               time.Time
}

type CaseRepository interface {
	CreateCase(ctx context.Context, c *Case) error
	GetCaseByID(ctx context.Context, id uuid.UUID) (*Case, error)
	ListCases(ctx context.Context, status string) ([]Case, error)
	AddAlertToCase(ctx context.Context, caseID, alertID uuid.UUID) error
	UpdateCaseStatus(ctx context.Context, id uuid.UUID, status CaseStatus) error

	CreateAllocationPlan(ctx context.Context, plan *AllocationPlan) error
	ListAllocationPlansByCase(ctx context.Context, caseID uuid.UUID) ([]AllocationPlan, error)
	ConfirmAllocationPlan(ctx context.Context, caseID, planID uuid.UUID, confirmedBy string) (*AllocationPlan, error)
}
