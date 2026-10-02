package httpapi

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

type Server struct {
	svc *app.WorkflowService
	// Có thể thêm repo nếu cần truy xuất thẳng không qua service layer
	repo domain.AlertRepository
}

func NewServer(svc *app.WorkflowService, repo domain.AlertRepository) *Server {
	return &Server{svc: svc, repo: repo}
}

// ListAlerts implements api.ServerInterface
func (s *Server) ListAlerts(c *gin.Context, params api.ListAlertsParams) {
	status := "all"
	if params.Status != nil {
		status = string(*params.Status)
	}

	alerts, err := s.repo.ListAlerts(c.Request.Context(), status, params.RunId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var res []api.Alert
	for _, a := range alerts {
		statusEnum := api.AlertStatus(a.Status)
		res = append(res, api.Alert{
			Id:         a.ID,
			RunId:      a.RunID,
			ProvinceId: a.ProvinceID,
			CreatedAt:  a.CreatedAt,
			Status:     statusEnum,
		})
	}
	c.JSON(http.StatusOK, res)
}

// ConfirmAlert implements api.ServerInterface
func (s *Server) ConfirmAlert(c *gin.Context, alertId uuid.UUID) {
	err := s.repo.UpdateAlertStatus(c.Request.Context(), alertId, domain.AlertStatusClosed)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Mở hồ sơ tương ứng
	caseID := uuid.New()
	err = s.repo.CreateCase(c.Request.Context(), &domain.Case{
		ID:        caseID,
		AlertID:   alertId,
		CreatedAt: time.Now(), // time chưa import ở đây, let's fix below
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListCases implements api.ServerInterface
func (s *Server) ListCases(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{})
}
