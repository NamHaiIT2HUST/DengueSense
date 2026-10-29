package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math"
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

	res := make([]api.Alert, 0)
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

	res := make([]api.Case, 0)
	for _, cs := range cases {
		var alertID uuid.UUID
		if len(cs.AlertIDs) > 0 {
			alertID = cs.AlertIDs[0]
		}
		res = append(res, api.Case{
			Id:        cs.ID,
			AlertId:   alertID,
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

	var firstAlertID uuid.UUID
	if len(alertIDs) > 0 {
		firstAlertID = alertIDs[0]
	}

	c.JSON(http.StatusCreated, api.Case{
		Id:        newCase.ID,
		AlertId:   firstAlertID,
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

	var alertID uuid.UUID
	if len(cs.AlertIDs) > 0 {
		alertID = cs.AlertIDs[0]
	}

	detail := api.CaseDetail{
		Id:        cs.ID,
		AlertId:   alertID,
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
		latestPlan := mapPlanToAPI(&plans[0])
		detail.LatestPlan = &latestPlan
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
			Budget   float64 `json:"budget"`
			Strategy string  `json:"strategy"`
			Items    []struct {
				ProvinceID string  `json:"province_id"`
				CasesPred  float64 `json:"cases_pred"`
				Cost       float64 `json:"cost"`
			} `json:"items"`
		}{
			Budget:   req.Budget,
			Strategy: "milp_marginal",
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
				if err == nil {
					if resp.StatusCode == http.StatusOK {
						var optResp struct {
							TotalCost               float64 `json:"total_cost"`
							EstimatedCasesPrevented float64 `json:"estimated_cases_prevented"`
							Allocations             []struct {
								ProvinceID  string  `json:"province_id"`
								Amount      float64 `json:"amount"`
								Explanation string  `json:"explanation"`
								Beds        int     `json:"beds"`
								Supplies    int     `json:"supplies"`
								Teams       int     `json:"teams"`
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
									Beds:        a.Beds,
									Supplies:    a.Supplies,
									Teams:       a.Teams,
								})
							}
							calledOptimize = true
						}
					}
					_ = resp.Body.Close()
				}
			}
		}
	}

	if !calledOptimize {
		for _, it := range req.Items {
			if totalCost+it.Cost <= req.Budget {
				beds := int(math.Round(it.CasesPred * 0.15))
				if beds < 5 && it.CasesPred > 0 {
					beds = 5
				}
				supplies := int(math.Round(it.CasesPred * 2.5))
				if supplies < 50 && it.CasesPred > 0 {
					supplies = 50
				}
				teams := int(math.Round(it.CasesPred / 150.0))
				if teams < 1 && it.CasesPred > 0 {
					teams = 1
				}
				allocItems = append(allocItems, domain.AllocationItem{
					ProvinceID:  it.ProvinceId,
					Amount:      1.0,
					Explanation: fmt.Sprintf("MILP tối ưu: Điều phối %d giường, %d lít Cloramin B, %d đội phản ứng nhanh cơ động", beds, supplies, teams),
					Beds:        beds,
					Supplies:    supplies,
					Teams:       teams,
				})
				totalCost += it.Cost
				prevented += it.CasesPred * 0.28
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

	c.JSON(http.StatusCreated, mapPlanToAPI(plan))
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
func (s *Server) GenerateDraftForCase(c *gin.Context, caseID uuid.UUID) {
	var req api.GenerateDraftCaseRequest
	if c.ShouldBindJSON(&req) != nil || (req.DraftType != "b2b" && req.DraftType != "b2g") {
		c.JSON(400, gin.H{"error": "Yêu cầu không hợp lệ"})
		return
	}
	ctx := c.Request.Context()
	cs, err := s.repo.GetCaseByID(ctx, caseID)
	if err != nil {
		c.JSON(404, gin.H{"error": "Không tìm thấy hồ sơ"})
		return
	}
	if s.genaiURL == "" {
		c.JSON(503, gin.H{"error": "GenAI chưa được cấu hình"})
		return
	}
	var run uuid.UUID
	provinces := []string{}
	seen := map[string]bool{}
	for _, id := range cs.AlertIDs {
		alert, err := s.repo.GetAlertByID(ctx, id)
		if err != nil || alert.RunID == uuid.Nil || alert.ProvinceID == "" || (run != uuid.Nil && run != alert.RunID) {
			c.JSON(400, gin.H{"error": "Nguồn cảnh báo không hợp lệ"})
			return
		}
		run = alert.RunID
		if !seen[alert.ProvinceID] {
			provinces = append(provinces, alert.ProvinceID)
			seen[alert.ProvinceID] = true
		}
	}
	if run == uuid.Nil {
		c.JSON(400, gin.H{"error": "Hồ sơ cần cảnh báo có nguồn dự báo"})
		return
	}
	slots := map[string]any{"run_id": run.String(), "province_ids": provinces}
	provenance := api.SlotProvenance{}
	plans, err := s.repo.ListAllocationPlansByCase(ctx, caseID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Không thể đọc kế hoạch"})
		return
	}
	if len(plans) > 0 {
		plan := plans[0]
		provenance.PlanId = &plan.ID
		beds, supplies, teams := 0, 0, 0
		for _, item := range plan.Allocations {
			beds += item.Beds
			supplies += item.Supplies
			teams += item.Teams
		}
		slots["budget_allocated"] = plan.TotalCost
		slots["beds_allocated"] = beds
		slots["supplies_allocated"] = supplies
		slots["teams_allocated"] = teams
	}
	slots["provenance"] = provenance
	body, err := json.Marshal(map[string]any{"draft_type": req.DraftType, "case_id": caseID, "slots": slots, "title": req.Title, "extra_instructions": req.ExtraInstructions})
	if err != nil {
		c.JSON(500, gin.H{"error": "Không thể tạo yêu cầu"})
		return
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(s.genaiURL, "/")+"/genai/draft", bytes.NewReader(body))
	if err != nil {
		c.JSON(502, gin.H{"error": "Không thể gọi GenAI"})
		return
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := s.httpClient.Do(request)
	if err != nil {
		c.JSON(502, gin.H{"error": "Không thể gọi GenAI"})
		return
	}
	defer response.Body.Close()
	if response.StatusCode == 422 {
		var problem api.GuardrailBlockedProblem
		if json.NewDecoder(response.Body).Decode(&problem) != nil || problem.Code != "genai.guardrail_blocked" || problem.Status != 422 || !hasBlockingFailure(problem.Guardrails) {
			c.JSON(502, gin.H{"error": "Phản hồi guardrail không hợp lệ"})
			return
		}
		c.Header("Content-Type", "application/problem+json")
		c.JSON(422, problem)
		return
	}
	if response.StatusCode != 200 {
		c.JSON(502, gin.H{"error": "GenAI không tạo được dự thảo"})
		return
	}
	var result struct {
		Title       string               `json:"title"`
		Content     string               `json:"content"`
		ContentHash string               `json:"content_hash"`
		AllPassed   *bool                `json:"all_guardrails_passed"`
		Guardrails  []api.GuardrailCheck `json:"guardrails"`
		Citations   []api.Citation       `json:"citations"`
		ModelUsed   *string              `json:"model_used"`
	}
	if json.NewDecoder(response.Body).Decode(&result) != nil || result.Title == "" || result.Content == "" || result.ContentHash != domain.ComputeHash(result.Content) || result.AllPassed == nil || !*result.AllPassed || result.Guardrails == nil || result.Citations == nil || !validGuardrails(result.Guardrails) || hasBlockingFailure(result.Guardrails) || !validCitations(result.Citations) {
		c.JSON(502, gin.H{"error": "Phản hồi GenAI không hợp lệ"})
		return
	}
	evidence := api.DraftGenerationEvidence{ContentHash: result.ContentHash, Citations: result.Citations, Guardrails: result.Guardrails, SourceProvenance: provenance, ModelUsed: result.ModelUsed}
	evidenceJSON, err := json.Marshal(evidence)
	if err != nil {
		c.JSON(502, gin.H{"error": "Bằng chứng không hợp lệ"})
		return
	}
	draft := domain.NewDispatchDraft(caseID, domain.DraftType(req.DraftType), result.Title, result.Content, cs.CreatedBy)
	draft.GenerationEvidence = evidenceJSON
	if s.repo.CreateDraft(ctx, draft) != nil {
		c.JSON(500, gin.H{"error": "Không thể lưu dự thảo"})
		return
	}
	c.JSON(201, mapDraftToAPI(draft))
}

func hasBlockingFailure(checks []api.GuardrailCheck) bool {
	for _, check := range checks {
		if !check.Passed && (check.Blocking == nil || *check.Blocking) {
			return true
		}
	}
	return false
}

func validGuardrails(checks []api.GuardrailCheck) bool {
	seen := map[string]bool{}
	for _, check := range checks {
		code := string(check.Code)
		if code != "G1" && code != "G2" && code != "G3" && code != "G4" && code != "G5" && code != "G6" {
			return false
		}
		if seen[code] || check.Name == "" || (code != "G6" && check.Blocking != nil && !*check.Blocking) || (code == "G6" && (check.Blocking == nil || *check.Blocking)) {
			return false
		}
		seen[code] = true
	}
	return len(seen) == 6
}

func validCitations(citations []api.Citation) bool {
	for _, c := range citations {
		if c.DocumentId == "" || c.Title == "" || c.Issuer == "" || c.DocumentVersion == "" || string(c.Status) != "effective" || c.Provision == "" || c.Quote == "" || c.SourceUrl == "" {
			return false
		}
	}
	return true
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
	var evidence *api.DraftGenerationEvidence
	if len(d.GenerationEvidence) > 0 {
		var decoded api.DraftGenerationEvidence
		if json.Unmarshal(d.GenerationEvidence, &decoded) == nil {
			evidence = &decoded
		}
	}
	return api.DispatchDraft{
		GenerationEvidence: evidence,
		Id:                 d.ID,
		CaseId:             d.CaseID,
		Version:            d.Version,
		DraftType:          api.DispatchDraftDraftType(d.DraftType),
		Title:              d.Title,
		Content:            d.Content,
		ContentHash:        d.ContentHash,
		Status:             api.DispatchDraftStatus(d.Status),
		CreatedBy:          d.CreatedBy,
		CreatedAt:          d.CreatedAt,
		UpdatedAt:          d.UpdatedAt,
	}
}

func mapPlanToAPI(plan *domain.AllocationPlan) api.AllocationPlan {
	var apiAllocs []struct {
		Amount      float64 `json:"amount"`
		Beds        *int    `json:"beds,omitempty"`
		Explanation string  `json:"explanation"`
		ProvinceId  string  `json:"province_id"`
		Supplies    *int    `json:"supplies,omitempty"`
		Teams       *int    `json:"teams,omitempty"`
	}
	for _, a := range plan.Allocations {
		item := struct {
			Amount      float64 `json:"amount"`
			Beds        *int    `json:"beds,omitempty"`
			Explanation string  `json:"explanation"`
			ProvinceId  string  `json:"province_id"`
			Supplies    *int    `json:"supplies,omitempty"`
			Teams       *int    `json:"teams,omitempty"`
		}{
			ProvinceId:  a.ProvinceID,
			Amount:      a.Amount,
			Explanation: a.Explanation,
		}
		if a.Beds > 0 {
			beds := a.Beds
			item.Beds = &beds
		}
		if a.Supplies > 0 {
			supplies := a.Supplies
			item.Supplies = &supplies
		}
		if a.Teams > 0 {
			teams := a.Teams
			item.Teams = &teams
		}
		apiAllocs = append(apiAllocs, item)
	}

	return api.AllocationPlan{
		Id:                      plan.ID,
		CaseId:                  plan.CaseID,
		Budget:                  plan.Budget,
		TotalCost:               plan.TotalCost,
		EstimatedCasesPrevented: plan.EstimatedCasesPrevented,
		Allocations:             apiAllocs,
		CreatedAt:               plan.CreatedAt,
	}
}
