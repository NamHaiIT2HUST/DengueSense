package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

// TODO: Define a struct for ForecastClient to fetch actual forecasts and check exceed_prob
type ForecastClient interface {
	CheckRunAlerts(ctx context.Context, runID uuid.UUID) ([]int, error) // Returns list of provinceIDs that triggered alerts
}

type WorkflowService struct {
	repo           domain.AlertRepository
	forecastClient ForecastClient
}

func NewWorkflowService(repo domain.AlertRepository, forecastClient ForecastClient) *WorkflowService {
	return &WorkflowService{repo: repo, forecastClient: forecastClient}
}

// HandleForecastRunCompleted handles the NATS event `forecast.run.completed`
func (s *WorkflowService) HandleForecastRunCompleted(ctx context.Context, env eventx.Envelope) error {
	slog.Info("Nhận event forecast.run.completed", "run_id", env.Subject)

	// Payload struct matching contracts/events/forecast.run.completed.v1.json
	var payload struct {
		RunID uuid.UUID `json:"run_id"`
	}
	if err := json.Unmarshal(env.Data, &payload); err != nil {
		return fmt.Errorf("không thể parse event data: %w", err)
	}

	// Gọi Forecast API để kiểm tra xem lượt dự báo này có sinh ra Cảnh báo nào không
	provinceIDs, err := s.forecastClient.CheckRunAlerts(ctx, payload.RunID)
	if err != nil {
		return fmt.Errorf("lỗi khi gọi forecast service: %w", err)
	}

	for _, pid := range provinceIDs {
		alert := &domain.Alert{
			ID:         uuid.New(),
			RunID:      payload.RunID,
			ProvinceID: pid,
			CreatedAt:  time.Now(),
			Status:     domain.AlertStatusOpen,
		}
		if err := s.repo.CreateAlert(ctx, alert); err != nil {
			return fmt.Errorf("lỗi khi lưu alert (province=%d): %w", pid, err)
		}
		slog.Info("Đã tạo cảnh báo tự động", "alert_id", alert.ID, "province_id", pid)
	}

	return nil
}
