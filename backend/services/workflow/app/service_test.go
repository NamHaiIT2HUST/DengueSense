package app_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

type mockAlertRepo struct {
	createdAlerts []*domain.Alert
	createErr     error
}

func (m *mockAlertRepo) CreateAlert(_ context.Context, a *domain.Alert) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.createdAlerts = append(m.createdAlerts, a)
	return nil
}

func (m *mockAlertRepo) GetAlertByID(_ context.Context, _ uuid.UUID) (*domain.Alert, error) {
	return nil, nil
}

func (m *mockAlertRepo) ListAlerts(_ context.Context, _ string, _ *uuid.UUID) ([]domain.Alert, error) {
	return nil, nil
}

func (m *mockAlertRepo) UpdateAlertStatus(_ context.Context, _ uuid.UUID, _ domain.AlertStatus) error {
	return nil
}

type mockForecastClient struct {
	provinces []string
	err       error
}

func (m *mockForecastClient) CheckRunAlerts(_ context.Context, _ uuid.UUID) ([]string, error) {
	return m.provinces, m.err
}

func TestWorkflowService_HandleForecastRunCompleted_Success(t *testing.T) {
	repo := &mockAlertRepo{}
	fc := &mockForecastClient{
		provinces: []string{"ha_noi", "ho_chi_minh"},
	}
	svc := app.NewWorkflowService(repo, fc)

	runID := uuid.New()
	data, err := json.Marshal(map[string]any{"run_id": runID})
	require.NoError(t, err)

	env := eventx.Envelope{
		Type:    "forecast.run.completed",
		Subject: runID.String(),
		Data:    data,
	}

	err = svc.HandleForecastRunCompleted(context.Background(), env)
	require.NoError(t, err)

	require.Len(t, repo.createdAlerts, 2)
	assert.Equal(t, runID, repo.createdAlerts[0].RunID)
	assert.Equal(t, "ha_noi", repo.createdAlerts[0].ProvinceID)
	assert.Equal(t, domain.AlertStatusOpen, repo.createdAlerts[0].Status)
	assert.Equal(t, "ho_chi_minh", repo.createdAlerts[1].ProvinceID)

	// Redelivery phải tạo cùng ID để repository có thể bỏ qua bản ghi trùng.
	require.NoError(t, svc.HandleForecastRunCompleted(context.Background(), env))
	assert.Equal(t, repo.createdAlerts[0].ID, repo.createdAlerts[2].ID)
	assert.Equal(t, repo.createdAlerts[1].ID, repo.createdAlerts[3].ID)
}

func TestWorkflowService_RejectsMissingRunID(t *testing.T) {
	repo := &mockAlertRepo{}
	svc := app.NewWorkflowService(repo, &mockForecastClient{})
	require.Error(t, svc.HandleForecastRunCompleted(context.Background(), eventx.Envelope{Data: []byte(`{}`)}))
	assert.Empty(t, repo.createdAlerts)
}

func TestWorkflowService_HandleForecastRunCompleted_InvalidJSON(t *testing.T) {
	repo := &mockAlertRepo{}
	fc := &mockForecastClient{}
	svc := app.NewWorkflowService(repo, fc)

	env := eventx.Envelope{
		Type:    "forecast.run.completed",
		Subject: "run-1",
		Data:    []byte("invalid json"),
	}

	err := svc.HandleForecastRunCompleted(context.Background(), env)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "không thể parse event data")
	assert.Empty(t, repo.createdAlerts)
}

func TestWorkflowService_HandleForecastRunCompleted_ForecastClientError(t *testing.T) {
	repo := &mockAlertRepo{}
	fc := &mockForecastClient{
		err: errors.New("mạng không ổn định"),
	}
	svc := app.NewWorkflowService(repo, fc)

	runID := uuid.New()
	data, _ := json.Marshal(map[string]any{"run_id": runID})
	env := eventx.Envelope{
		Type:    "forecast.run.completed",
		Subject: runID.String(),
		Data:    data,
	}

	err := svc.HandleForecastRunCompleted(context.Background(), env)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "lỗi khi gọi forecast service")
	assert.Empty(t, repo.createdAlerts)
}

func TestWorkflowService_HandleForecastRunCompleted_RepoError(t *testing.T) {
	repo := &mockAlertRepo{
		createErr: errors.New("lỗi cơ sở dữ liệu"),
	}
	fc := &mockForecastClient{
		provinces: []string{"da_nang"},
	}
	svc := app.NewWorkflowService(repo, fc)

	runID := uuid.New()
	data, _ := json.Marshal(map[string]any{"run_id": runID})
	env := eventx.Envelope{
		Type:    "forecast.run.completed",
		Subject: runID.String(),
		Data:    data,
	}

	err := svc.HandleForecastRunCompleted(context.Background(), env)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "lỗi khi lưu alert")
}
