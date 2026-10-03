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
	ProvinceID  string  `json:"province_id"`
	Amount      float64 `json:"amount"`
	Explanation string  `json:"explanation"`
}

type AllocationPlan struct {
	ID                      uuid.UUID
	CaseID                  uuid.UUID
	Budget                  float64
	TotalCost               float64
	EstimatedCasesPrevented float64
	Allocations             []AllocationItem
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
}
