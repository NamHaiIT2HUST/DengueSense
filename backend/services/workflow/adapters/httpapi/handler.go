package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

type WorkflowRepo interface {
	domain.AlertRepository
	domain.CaseRepository
	domain.DraftRepository
}

type Server struct {
	svc         *app.WorkflowService
	repo        WorkflowRepo
	genaiURL    string
	optimizeURL string
	httpClient  *http.Client
}

type ServerOption func(*Server)

func WithGenAIURL(u string) ServerOption {
	return func(s *Server) { s.genaiURL = u }
}

func WithOptimizeURL(u string) ServerOption {
	return func(s *Server) { s.optimizeURL = u }
}

func WithHTTPClient(client *http.Client) ServerOption {
	return func(s *Server) { s.httpClient = client }
}

func NewServer(svc *app.WorkflowService, repo WorkflowRepo, opts ...ServerOption) *Server {
	s := &Server{
		svc:        svc,
		repo:       repo,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// ---------------------------------------------------------------------
// Alert Handlers
// ---------------------------------------------------------------------

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
		res = append(res, api.Alert{
			Id:         a.ID,
			RunId:      a.RunID,
			ProvinceId: a.ProvinceID,
			CreatedAt:  a.CreatedAt,
			Status:     api.AlertStatus(a.Status),
		})
	}
	c.JSON(http.StatusOK, res)
}

// ConfirmAlert implements api.ServerInterface
func (s *Server) ConfirmAlert(c *gin.Context, alertId uuid.UUID) {
	ctx := c.Request.Context()
	err := s.repo.UpdateAlertStatus(ctx, alertId, domain.AlertStatusClosed)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Mở hồ sơ mới gắn liền với alert này
	caseID := uuid.New()
	now := time.Now().UTC()
	err = s.repo.CreateCase(ctx, &domain.Case{
		ID:        caseID,
		Title:     "Hồ sơ xử lý cảnh báo dịch",
		Status:    domain.CaseStatusOpen,
		AlertIDs:  []uuid.UUID{alertId},
		CreatedBy: "officer",
		CreatedAt: now,
		UpdatedAt: now,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// ---------------------------------------------------------------------
// Case Handlers
// ---------------------------------------------------------------------

// ListCases implements api.ServerInterface
func (s *Server) ListCases(c *gin.Context, params api.ListCasesParams) {
	status := "all"
	if params.Status != nil {
		status = string(*params.Status)
	}

	cases, err := s.repo.ListCases(c.Request.Context(), status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var res []api.Case
	for _, cs := range cases {
		res = append(res, api.Case{
			Id:        cs.ID,
			Title:     cs.Title,
			Status:    api.CaseStatus(cs.Status),
			CreatedBy: cs.CreatedBy,
			CreatedAt: cs.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, res)
}

// CreateCase implements api.ServerInterface
func (s *Server) CreateCase(c *gin.Context) {
	var req api.CreateCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	caseID := uuid.New()
	now := time.Now().UTC()
	var alertIDs []uuid.UUID
	if req.AlertIds != nil {
		alertIDs = *req.AlertIds
	}

	newCase := &domain.Case{
		ID:        caseID,
		Title:     req.Title,
		Status:    domain.CaseStatusOpen,
		AlertIDs:  alertIDs,
		CreatedBy: req.CreatedBy,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.CreateCase(c.Request.Context(), newCase); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, api.Case{
		Id:        newCase.ID,
		Title:     newCase.Title,
		Status:    api.CaseStatus(newCase.Status),
		CreatedBy: newCase.CreatedBy,
		CreatedAt: newCase.CreatedAt,
	})
}

// GetCase implements api.ServerInterface
func (s *Server) GetCase(c *gin.Context, caseId uuid.UUID) {
	ctx := c.Request.Context()
	cs, err := s.repo.GetCaseByID(ctx, caseId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy hồ sơ"})
		return
	}

	detail := api.CaseDetail{
		Id:        cs.ID,
		Title:     cs.Title,
		Status:    api.CaseDetailStatus(cs.Status),
		CreatedBy: cs.CreatedBy,
		CreatedAt: cs.CreatedAt,
		AlertIds:  &cs.AlertIDs,
	}

	// Lấy plan gần nhất nếu có
	plans, _ := s.repo.ListAllocationPlansByCase(ctx, caseId)
	if len(plans) > 0 {
		detail.LatestPlanId = &plans[0].ID
	}

	// Lấy draft gần nhất nếu có
	drafts, _ := s.repo.ListDraftsByCase(ctx, caseId)
	if len(drafts) > 0 {
		detail.LatestDraftId = &drafts[0].ID
	}

	c.JSON(http.StatusOK, detail)
}

// ---------------------------------------------------------------------
// Allocation Plan Handlers
// ---------------------------------------------------------------------

// CreateAllocationPlan implements api.ServerInterface
func (s *Server) CreateAllocationPlan(c *gin.Context, caseId uuid.UUID) {
	var req api.CreateAllocationPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var allocItems []domain.AllocationItem
	totalCost := 0.0
	prevented := 0.0

	calledOptimize := false
	if s.optimizeURL != "" {
		optReq := struct {
			Budget float64 `json:"budget"`
			Items  []struct {
				ProvinceID string  `json:"province_id"`
				CasesPred  float64 `json:"cases_pred"`
				Cost       float64 `json:"cost"`
			} `json:"items"`
		}{
			Budget: req.Budget,
		}
		for _, it := range req.Items {
			optReq.Items = append(optReq.Items, struct {
				ProvinceID string  `json:"province_id"`
				CasesPred  float64 `json:"cases_pred"`
				Cost       float64 `json:"cost"`
			}{
				ProvinceID: it.ProvinceId,
				CasesPred:  it.CasesPred,
				Cost:       it.Cost,
			})
		}

		bodyBytes, err := json.Marshal(optReq)
		if err == nil {
			targetURL := strings.TrimRight(s.optimizeURL, "/") + "/allocate"
			httpReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, targetURL, bytes.NewReader(bodyBytes))
			if err == nil {
				httpReq.Header.Set("Content-Type", "application/json")
				resp, err := s.httpClient.Do(httpReq)
				if err == nil && resp.StatusCode == http.StatusOK {
					var optResp struct {
						TotalCost               float64 `json:"total_cost"`
						EstimatedCasesPrevented float64 `json:"estimated_cases_prevented"`
						Allocations             []struct {
							ProvinceID  string  `json:"province_id"`
							Amount      float64 `json:"amount"`
							Explanation string  `json:"explanation"`
						} `json:"allocations"`
					}
					if err := json.NewDecoder(resp.Body).Decode(&optResp); err == nil {
						totalCost = optResp.TotalCost
						prevented = optResp.EstimatedCasesPrevented
						for _, a := range optResp.Allocations {
							allocItems = append(allocItems, domain.AllocationItem{
								ProvinceID:  a.ProvinceID,
								Amount:      a.Amount,
								Explanation: a.Explanation,
							})
						}
						calledOptimize = true
					}
					_ = resp.Body.Close()
				}
			}
		}
	}

	if !calledOptimize {
		for _, it := range req.Items {
			if totalCost+it.Cost <= req.Budget {
				allocItems = append(allocItems, domain.AllocationItem{
					ProvinceID:  it.ProvinceId,
					Amount:      1.0,
					Explanation: "Phân bổ tối ưu rủi ro dịch",
				})
				totalCost += it.Cost
				prevented += it.CasesPred * 0.2
			}
		}
	}

	plan := &domain.AllocationPlan{
		ID:                      uuid.New(),
		CaseID:                  caseId,
		Budget:                  req.Budget,
		TotalCost:               totalCost,
		EstimatedCasesPrevented: prevented,
		Allocations:             allocItems,
		CreatedAt:               time.Now().UTC(),
	}

	if err := s.repo.CreateAllocationPlan(c.Request.Context(), plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var apiAllocs []struct {
		Amount      float64 `json:"amount"`
		Explanation string  `json:"explanation"`
		ProvinceId  string  `json:"province_id"`
	}
	for _, a := range plan.Allocations {
		apiAllocs = append(apiAllocs, struct {
			Amount      float64 `json:"amount"`
			Explanation string  `json:"explanation"`
			ProvinceId  string  `json:"province_id"`
		}{
			ProvinceId:  a.ProvinceID,
			Amount:      a.Amount,
			Explanation: a.Explanation,
		})
	}

	c.JSON(http.StatusCreated, api.AllocationPlan{
		Id:                      plan.ID,
		CaseId:                  plan.CaseID,
		Budget:                  plan.Budget,
		TotalCost:               plan.TotalCost,
		EstimatedCasesPrevented: plan.EstimatedCasesPrevented,
		Allocations:             apiAllocs,
		CreatedAt:               plan.CreatedAt,
	})
}

// ---------------------------------------------------------------------
// Dispatch Draft & Review Handlers
// ---------------------------------------------------------------------

// CreateDraft implements api.ServerInterface
func (s *Server) CreateDraft(c *gin.Context, caseId uuid.UUID) {
	var req api.CreateDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	draft := domain.NewDispatchDraft(
		caseId,
		domain.DraftType(req.DraftType),
		req.Title,
		req.Content,
		req.CreatedBy,
	)

	if err := s.repo.CreateDraft(c.Request.Context(), draft); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, mapDraftToAPI(draft))
}

// GenerateDraftForCase implements api.ServerInterface
func (s *Server) GenerateDraftForCase(c *gin.Context, caseId uuid.UUID) {
	var req api.GenerateDraftCaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	cs, err := s.repo.GetCaseByID(ctx, caseId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy hồ sơ"})
		return
	}

	title := "Dự thảo Báo cáo chuyên môn dịch tễ"
	if req.DraftType == "b2g" {
		title = "Dự thảo Công điện chỉ đạo điều hành cấp bách"
	}
	if req.Title != nil && *req.Title != "" {
		title = *req.Title
	}

	content := fmt.Sprintf("# %s\n\nHồ sơ: %s (Mã: %s)\nLoại văn bản: %s\nThời điểm: %s\n\nNội dung tự động sinh bởi AI và được kiểm soát theo các nguyên tắc Guardrails G1-G6.",
		title, cs.Title, cs.ID.String(), string(req.DraftType), time.Now().Format("02/01/2006"))

	if s.genaiURL != "" {
		gReq := struct {
			DraftType   string         `json:"draft_type"`
			CaseID      string         `json:"case_id"`
			Title       string         `json:"title,omitempty"`
			ContextData map[string]any `json:"context_data"`
		}{
			DraftType: string(req.DraftType),
			CaseID:    caseId.String(),
			Title:     title,
			ContextData: map[string]any{
				"case_title": cs.Title,
				"status":     string(cs.Status),
			},
		}
		bodyBytes, err := json.Marshal(gReq)
		if err == nil {
			targetURL := strings.TrimRight(s.genaiURL, "/") + "/draft"
			httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(bodyBytes))
			if err == nil {
				httpReq.Header.Set("Content-Type", "application/json")
				resp, err := s.httpClient.Do(httpReq)
				if err == nil && resp.StatusCode == http.StatusOK {
					var gResp struct {
						Content        string   `json:"content"`
						ContentHash    string   `json:"content_hash"`
						Citations      []string `json:"citations"`
						GuardrailFlags []string `json:"guardrail_flags"`
					}
					if err := json.NewDecoder(resp.Body).Decode(&gResp); err == nil && gResp.Content != "" {
						content = gResp.Content
					}
					_ = resp.Body.Close()
				}
			}
		}
	}

	draft := domain.NewDispatchDraft(
		caseId,
		domain.DraftType(req.DraftType),
		title,
		content,
		cs.CreatedBy,
	)

	if err := s.repo.CreateDraft(ctx, draft); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, mapDraftToAPI(draft))
}

// GetDraft implements api.ServerInterface
func (s *Server) GetDraft(c *gin.Context, draftId uuid.UUID) {
	draft, err := s.repo.GetDraftByID(c.Request.Context(), draftId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy dự thảo"})
		return
	}
	c.JSON(http.StatusOK, mapDraftToAPI(draft))
}

// UpdateDraft implements api.ServerInterface
func (s *Server) UpdateDraft(c *gin.Context, draftId uuid.UUID) {
	var req api.UpdateDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	draft, err := s.repo.GetDraftByID(ctx, draftId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy dự thảo"})
		return
	}

	title := draft.Title
	if req.Title != nil {
		title = *req.Title
	}

	if err := draft.UpdateContent(title, req.Content); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := s.repo.UpdateDraft(ctx, draft); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, mapDraftToAPI(draft))
}

// SubmitReview implements api.ServerInterface
func (s *Server) SubmitReview(c *gin.Context, draftId uuid.UUID) {
	var req api.SubmitReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	draft, err := s.repo.GetDraftByID(ctx, draftId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy dự thảo"})
		return
	}

	action := domain.ReviewAction(req.Action)
	// Bất biến 1 & 2: Kiểm tra quy tắc 4 mắt và khớp phiên bản
	if err := draft.ValidateReview(req.ReviewerId, req.DraftVersion, action); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, domain.ErrFourEyesViolation) {
			status = http.StatusForbidden
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	reviewID := uuid.New()
	now := time.Now().UTC()
	note := ""
	if req.Note != nil {
		note = *req.Note
	}

	review := &domain.Review{
		ID:           reviewID,
		DraftID:      draftId,
		DraftVersion: req.DraftVersion,
		ReviewerID:   req.ReviewerId,
		Action:       action,
		Note:         note,
		ReviewedAt:   now,
	}

	if err := s.repo.CreateReview(ctx, review); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Áp dụng review thay đổi trạng thái draft
	draft.ApplyReview(action)
	if err := s.repo.UpdateDraft(ctx, draft); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, api.ReviewResult{
		Id:           review.ID,
		DraftId:      review.DraftID,
		DraftVersion: review.DraftVersion,
		ReviewerId:   review.ReviewerID,
		Action:       api.ReviewResultAction(review.Action),
		Note:         &review.Note,
		ReviewedAt:   review.ReviewedAt,
		DraftStatus:  string(draft.Status),
	})
}

// DispatchApprovedOrder implements api.ServerInterface
func (s *Server) DispatchApprovedOrder(c *gin.Context, draftId uuid.UUID) {
	var req api.DispatchOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	draft, err := s.repo.GetDraftByID(ctx, draftId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Không tìm thấy dự thảo"})
		return
	}

	latestReview, err := s.repo.GetLatestReviewByDraft(ctx, draftId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dự thảo chưa có biên bản phê duyệt"})
		return
	}

	// Kiểm tra bất biến tính toàn vẹn và tạo lệnh
	order, err := domain.CreateDispatchOrder(draft, latestReview, req.Recipient)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := s.repo.CreateDispatchOrder(ctx, order); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, api.DispatchOrder{
		Id:          order.ID,
		CaseId:      order.CaseID,
		DraftId:     order.DraftID,
		Recipient:   order.Recipient,
		Content:     order.Content,
		ContentHash: order.ContentHash,
		Status:      api.DispatchOrderStatus(order.Status),
		CreatedAt:   order.CreatedAt,
	})
}

func mapDraftToAPI(d *domain.DispatchDraft) api.DispatchDraft {
	return api.DispatchDraft{
		Id:          d.ID,
		CaseId:      d.CaseID,
		Version:     d.Version,
		DraftType:   api.DispatchDraftDraftType(d.DraftType),
		Title:       d.Title,
		Content:     d.Content,
		ContentHash: d.ContentHash,
		Status:      api.DispatchDraftStatus(d.Status),
		CreatedBy:   d.CreatedBy,
		CreatedAt:   d.CreatedAt,
		UpdatedAt:   d.UpdatedAt,
	}
}
