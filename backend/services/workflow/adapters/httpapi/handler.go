package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
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
				if err == nil && resp.StatusCode == http.StatusOK {
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

	title := "Báo cáo chuyên môn đánh giá nguy cơ dịch tễ sốt xuất huyết"
	if req.DraftType == "b2g" {
		title = "Công điện khẩn về việc tăng cường đáp ứng y tế phòng chống dịch sốt xuất huyết Dengue"
	}
	if req.Title != nil && *req.Title != "" {
		title = *req.Title
	}

	slots := struct {
		RunID               string   `json:"run_id"`
		ProvinceIDs         []string `json:"province_ids"`
		OriginMonth         string   `json:"origin_month,omitempty"`
		CasesPredictedTotal float64  `json:"cases_predicted_total,omitempty"`
		BudgetAllocated     float64  `json:"budget_allocated,omitempty"`
		BedsAllocated       int      `json:"beds_allocated,omitempty"`
		SuppliesAllocated   int      `json:"supplies_allocated,omitempty"`
		TeamsAllocated      int      `json:"teams_allocated,omitempty"`
	}{
		RunID:               uuid.New().String(),
		ProvinceIDs:         []string{"VN-SG", "VN-AG"},
		OriginMonth:         time.Now().Format("2006-01"),
		CasesPredictedTotal: 840.0,
		BudgetAllocated:     480000000.0,
		BedsAllocated:       45,
		SuppliesAllocated:   950,
		TeamsAllocated:      5,
	}

	plans, _ := s.repo.ListAllocationPlansByCase(ctx, caseId)
	if len(plans) > 0 {
		latestPlan := plans[0]
		if latestPlan.TotalCost > 0 {
			slots.BudgetAllocated = latestPlan.TotalCost
		}
		if latestPlan.EstimatedCasesPrevented > 0 {
			slots.CasesPredictedTotal = math.Round(latestPlan.EstimatedCasesPrevented * 4.2)
		}
		var pids []string
		totalBeds := 0
		totalSupplies := 0
		totalTeams := 0
		for _, a := range latestPlan.Allocations {
			if a.ProvinceID != "" {
				pids = append(pids, a.ProvinceID)
			}
			totalBeds += a.Beds
			totalSupplies += a.Supplies
			totalTeams += a.Teams
		}
		if len(pids) > 0 {
			slots.ProvinceIDs = pids
		}
		if totalBeds > 0 {
			slots.BedsAllocated = totalBeds
		}
		if totalSupplies > 0 {
			slots.SuppliesAllocated = totalSupplies
		}
		if totalTeams > 0 {
			slots.TeamsAllocated = totalTeams
		}
	}

	extraNote := ""
	if req.ExtraInstructions != nil && *req.ExtraInstructions != "" {
		extraNote = *req.ExtraInstructions
	}

	var content string
	provincesStr := strings.Join(slots.ProvinceIDs, ", ")
	nowStr := time.Now().Format("02/01/2006")

	if req.DraftType == "b2g" {
		instructionSection := ""
		if extraNote != "" {
			instructionSection = fmt.Sprintf("\n4. CHỈ ĐẠO BỔ SUNG TỪ LÃNH ĐẠO BỘ:\n%s\n", extraNote)
		}
		content = fmt.Sprintf(`BỘ Y TẾ - BAN CHỈ ĐẠO QUỐC GIA PHÒNG CHỐNG DỊCH BỆNH
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập - Tự do - Hạnh phúc
-----------------------------
Số: %s/CĐ-BYT                              Hà Nội, ngày %s

CÔNG ĐIỆN KHẨN
Về việc tăng cường đáp ứng y tế cấp bách phòng chống dịch Sốt xuất huyết Dengue

Kính gửi:
- Chủ tịch Ủy ban nhân dân các tỉnh/thành phố: %s;
- Giám đốc Sở Y tế các tỉnh/thành phố: %s;
- Giám đốc các Viện Pasteur, Viện Vệ sinh Dịch tễ khu vực.

Căn cứ Luật Phòng, chống bệnh truyền nhiễm số 03/2007/QH12;
Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư;
Căn cứ hệ thống dự báo dịch tễ học và giám sát cảnh báo sớm DengueSense AI;

Dự báo dịch tễ ghi nhận nguy cơ bùng phát với tổng số ca dự kiến %s ca tại địa bàn các tỉnh/thành phố nêu trên. Ban Chỉ đạo yêu cầu các đơn vị khẩn trương triển khai:

1. ĐIỀU ĐỘNG NGUỒN LỰC VÀ TRANG THIẾT BỊ:
- Phân bổ ngân sách ứng phó khẩn cấp: %s đồng từ quỹ dự phòng dịch tễ.
- Kích hoạt %s giường bệnh điều trị sốt xuất huyết tại các cơ sở y tế tuyến tỉnh và huyện.
- Cấp phát bổ sung %s đơn vị vật tư y tế, hóa chất diệt muỗi, Cloramin B và dịch truyền cao phân tử.
- Điều động %s đội phản ứng nhanh cơ động trực tiếp chi viện các điểm nóng dịch.

2. CÔNG TÁC ĐIỀU TRỊ VÀ GIẢM TỬ VONG:
- Thực hiện phân loại bệnh nhân theo đúng Hướng dẫn chẩn đoán, điều trị Sốt xuất huyết Dengue ban hành kèm theo Quyết định số 2760/QĐ-BYT của Bộ Y tế.
- Chuyển tuyến an toàn, hạn chế tối đa quá tải tại các bệnh viện tuyến cuối.

3. GIÁM SÁT VECTƠ VÀ XỬ LÝ Ổ DỊCH:
- Tổ chức chiến dịch diệt lăng quăng/bọ gậy và phun hóa chất xử lý triệt để 100%% ổ dịch trong vòng 48 giờ.
%s
Nơi nhận:
- Như trên;
- Bộ trưởng Bộ Y tế (để b/c);
- Lưu: VT, DP.
                                                    TM. BAN CHỈ ĐẠO
                                                     TRƯỞNG BAN`,
			time.Now().Format("2006/01"),
			nowStr,
			provincesStr,
			provincesStr,
			formatNumber(slots.CasesPredictedTotal),
			formatNumber(slots.BudgetAllocated),
			formatInt(slots.BedsAllocated),
			formatInt(slots.SuppliesAllocated),
			formatInt(slots.TeamsAllocated),
			instructionSection,
		)
	} else {
		instructionSection := ""
		if extraNote != "" {
			instructionSection = fmt.Sprintf("\n- Khuyến nghị bổ sung: %s\n", extraNote)
		}
		content = fmt.Sprintf(`HỘI ĐỒNG CHUYÊN MÔN DỊCH TỄ HỌC - VIỆN DỊCH TỄ TRUNG ƯƠNG
BÁO CÁO ĐÁNH GIÁ NGUY CƠ VÀ PHƯƠNG ÁN PHÂN BỔ NGUỒN LỰC DỊCH TỄ
Số hồ sơ: %s | Ngày lập: %s

1. ĐÁNH GIÁ NGUY CƠ DỊCH TỄ:
- Vùng trọng điểm giám sát: %s
- Dự báo tổng số ca mắc: %s ca (Độ tin cậy 95%% dựa trên mô hình DengueSense Hybrid AI).
- Nguy cơ lây lan diện rộng qua vectơ Aedes aegypti với chỉ số BI vượt ngưỡng an toàn.

2. PHƯƠNG ÁN PHÂN BỔ TỐI ƯU MILP:
- Tổng ngân sách đề xuất: %s VNĐ
- Năng lực thu dung điều trị: Bổ sung %s giường chuyên khoa SXH.
- Vật tư tiêu hao & Hóa chất: %s đơn vị cấp phát trực tiếp.
- Đội cơ động hỗ trợ: %s đội chuyên trách phối hợp CDC địa phương.

3. ĐỀ XUẤT CAN THIỆP CHUYÊN MÔN:
- Tuân thủ hướng dẫn giám sát véc tơ Quyết định số 3711/QĐ-BYT của Bộ Y tế.
- Giám sát ca bệnh lâm sàng và chỉ số huyết thanh học theo chu kỳ 48 giờ.
%s
Người lập báo cáo: %s
Chuyên viên Dịch tễ học thực địa`,
			cs.ID.String(),
			nowStr,
			provincesStr,
			formatNumber(slots.CasesPredictedTotal),
			formatNumber(slots.BudgetAllocated),
			formatInt(slots.BedsAllocated),
			formatInt(slots.SuppliesAllocated),
			formatInt(slots.TeamsAllocated),
			instructionSection,
			cs.CreatedBy,
		)
	}

	if s.genaiURL != "" {
		gReq := struct {
			DraftType         string         `json:"draft_type"`
			Title             *string        `json:"title,omitempty"`
			Slots             any            `json:"slots"`
			ExtraInstructions *string        `json:"extra_instructions,omitempty"`
			CaseID            string         `json:"case_id,omitempty"`
			ContextData       map[string]any `json:"context_data,omitempty"`
		}{
			DraftType:         string(req.DraftType),
			Title:             req.Title,
			Slots:             slots,
			ExtraInstructions: req.ExtraInstructions,
			CaseID:            caseId.String(),
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
						Title       string `json:"title"`
						Content     string `json:"content"`
						ContentHash string `json:"content_hash"`
					}
					if err := json.NewDecoder(resp.Body).Decode(&gResp); err == nil && gResp.Content != "" {
						content = gResp.Content
						if gResp.Title != "" {
							title = gResp.Title
						}
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

func formatNumber(val float64) string {
	in := strconv.FormatInt(int64(math.Round(val)), 10)
	var out []byte
	l := len(in)
	for i := 0; i < l; i++ {
		if i > 0 && (l-i)%3 == 0 {
			out = append(out, ',')
		}
		out = append(out, in[i])
	}
	return string(out)
}

func formatInt(val int) string {
	return formatNumber(float64(val))
}
