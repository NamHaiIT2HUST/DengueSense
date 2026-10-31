package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

// MockRepo implements httpapi.WorkflowRepo in-memory
type MockRepo struct {
	alerts          map[uuid.UUID]*domain.Alert
	cases           map[uuid.UUID]*domain.Case
	allocationPlans map[uuid.UUID][]domain.AllocationPlan
	drafts          map[uuid.UUID]*domain.DispatchDraft
	reviews         map[uuid.UUID][]*domain.Review
	orders          map[uuid.UUID]*domain.DispatchOrder
}

func NewMockRepo() *MockRepo {
	return &MockRepo{
		alerts:          make(map[uuid.UUID]*domain.Alert),
		cases:           make(map[uuid.UUID]*domain.Case),
		allocationPlans: make(map[uuid.UUID][]domain.AllocationPlan),
		drafts:          make(map[uuid.UUID]*domain.DispatchDraft),
		reviews:         make(map[uuid.UUID][]*domain.Review),
		orders:          make(map[uuid.UUID]*domain.DispatchOrder),
	}
}

func (m *MockRepo) CreateAlert(_ context.Context, alert *domain.Alert) error {
	m.alerts[alert.ID] = alert
	return nil
}

func (m *MockRepo) GetAlertByID(_ context.Context, id uuid.UUID) (*domain.Alert, error) {
	a, ok := m.alerts[id]
	if !ok {
		return nil, fmt.Errorf("alert not found")
	}
	return a, nil
}

func (m *MockRepo) ListAlerts(_ context.Context, status string, runID *uuid.UUID) ([]domain.Alert, error) {
	var res []domain.Alert
	for _, a := range m.alerts {
		if status != "all" && string(a.Status) != status {
			continue
		}
		if runID != nil && a.RunID != *runID {
			continue
		}
		res = append(res, *a)
	}
	return res, nil
}

func (m *MockRepo) UpdateAlertStatus(_ context.Context, id uuid.UUID, status domain.AlertStatus) error {
	a, ok := m.alerts[id]
	if !ok {
		return fmt.Errorf("alert not found")
	}
	a.Status = status
	return nil
}

func (m *MockRepo) CreateCase(_ context.Context, c *domain.Case) error {
	m.cases[c.ID] = c
	return nil
}

func (m *MockRepo) GetCaseByID(_ context.Context, id uuid.UUID) (*domain.Case, error) {
	c, ok := m.cases[id]
	if !ok {
		return nil, fmt.Errorf("case not found")
	}
	return c, nil
}

func (m *MockRepo) ListCases(_ context.Context, status string) ([]domain.Case, error) {
	var res []domain.Case
	for _, c := range m.cases {
		if status != "all" && string(c.Status) != status {
			continue
		}
		res = append(res, *c)
	}
	return res, nil
}

func (m *MockRepo) AddAlertToCase(_ context.Context, caseID, alertID uuid.UUID) error {
	c, ok := m.cases[caseID]
	if !ok {
		return fmt.Errorf("case not found")
	}
	c.AlertIDs = append(c.AlertIDs, alertID)
	return nil
}

func (m *MockRepo) UpdateCaseStatus(_ context.Context, id uuid.UUID, status domain.CaseStatus) error {
	c, ok := m.cases[id]
	if !ok {
		return fmt.Errorf("case not found")
	}
	c.Status = status
	return nil
}

func (m *MockRepo) CreateAllocationPlan(_ context.Context, plan *domain.AllocationPlan) error {
	m.allocationPlans[plan.CaseID] = append(m.allocationPlans[plan.CaseID], *plan)
	return nil
}

func (m *MockRepo) ListAllocationPlansByCase(_ context.Context, caseID uuid.UUID) ([]domain.AllocationPlan, error) {
	return m.allocationPlans[caseID], nil
}

func (m *MockRepo) ConfirmAllocationPlan(_ context.Context, caseID, planID uuid.UUID, confirmedBy string) (*domain.AllocationPlan, error) {
	plans := m.allocationPlans[caseID]
	for i := range plans {
		if plans[i].ID == planID {
			if plans[i].Status != domain.AllocationPlanStatusConfirmed {
				now := time.Now().UTC()
				plans[i].Status = domain.AllocationPlanStatusConfirmed
				plans[i].ConfirmedBy = &confirmedBy
				plans[i].ConfirmedAt = &now
				m.allocationPlans[caseID] = plans
			}
			ret := plans[i]
			return &ret, nil
		}
	}
	return nil, fmt.Errorf("plan not found")
}

func (m *MockRepo) CreateDraft(_ context.Context, draft *domain.DispatchDraft) error {
	m.drafts[draft.ID] = draft
	return nil
}

func (m *MockRepo) GetDraftByID(_ context.Context, id uuid.UUID) (*domain.DispatchDraft, error) {
	d, ok := m.drafts[id]
	if !ok {
		return nil, fmt.Errorf("draft not found")
	}
	return d, nil
}

func (m *MockRepo) UpdateDraft(_ context.Context, draft *domain.DispatchDraft) error {
	m.drafts[draft.ID] = draft
	return nil
}

func (m *MockRepo) ListDraftsByCase(_ context.Context, caseID uuid.UUID) ([]domain.DispatchDraft, error) {
	var res []domain.DispatchDraft
	for _, d := range m.drafts {
		if d.CaseID == caseID {
			res = append(res, *d)
		}
	}
	return res, nil
}

func (m *MockRepo) CreateReview(_ context.Context, review *domain.Review) error {
	m.reviews[review.DraftID] = append(m.reviews[review.DraftID], review)
	return nil
}

func (m *MockRepo) GetLatestReviewByDraft(_ context.Context, draftID uuid.UUID) (*domain.Review, error) {
	revs := m.reviews[draftID]
	if len(revs) == 0 {
		return nil, nil
	}
	return revs[len(revs)-1], nil
}

func (m *MockRepo) CreateDispatchOrder(_ context.Context, order *domain.DispatchOrder) error {
	m.orders[order.ID] = order
	return nil
}

func (m *MockRepo) GetOrderByID(_ context.Context, id uuid.UUID) (*domain.DispatchOrder, error) {
	o, ok := m.orders[id]
	if !ok {
		return nil, fmt.Errorf("order not found")
	}
	return o, nil
}

func (m *MockRepo) UpdateOrderStatus(_ context.Context, id uuid.UUID, status domain.OrderStatus) error {
	o, ok := m.orders[id]
	if !ok {
		return fmt.Errorf("order not found")
	}
	o.Status = status
	return nil
}

func setupTestServer(repo *MockRepo, opts ...httpapi.ServerOption) *gin.Engine {
	opts = append(opts, httpapi.WithGenAITokenSource(func(context.Context) (string, error) { return "test-service-token", nil }))
	gin.SetMode(gin.TestMode)
	r := gin.New()
	svc := app.NewWorkflowService(repo, nil)
	srv := httpapi.NewServer(svc, repo, opts...)
	api.RegisterHandlers(r, srv)
	return r
}

func TestWorkflowRequiresServiceToken(t *testing.T) {
	publicKey, privateKey, err := authx.GenerateKeyPair()
	if err != nil {
		t.Fatal(err)
	}
	signer, err := authx.NewEd25519Signer(privateKey, "denguesense-identity", "gateway")
	if err != nil {
		t.Fatal(err)
	}
	verifier, err := authx.NewServiceVerifier(authx.StaticKeySet{"k1": publicKey}, "denguesense-identity", "workflow")
	if err != nil {
		t.Fatal(err)
	}
	good, err := signer.WithKeyID("k1").SignService("gateway", "workflow")
	if err != nil {
		t.Fatal(err)
	}
	wrong, err := signer.SignService("gateway", "genai")
	if err != nil {
		t.Fatal(err)
	}
	repo := NewMockRepo()
	r := gin.New()
	httpapi.RegisterAuthenticatedHandlers(r, httpapi.NewServer(app.NewWorkflowService(repo, nil), repo), verifier)
	for _, tc := range []struct {
		token string
		want  int
	}{{"", http.StatusUnauthorized}, {wrong, http.StatusUnauthorized}, {good, http.StatusOK}} {
		req := httptest.NewRequest(http.MethodGet, "/internal/v1/workflow/alerts", nil)
		req.Header.Set("Authorization", "Bearer "+tc.token)
		req.Header.Set("X-Actor-ID", "forged")
		req.Header.Set("X-Actor-Roles", "officer")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Fatalf("status=%d, want=%d", w.Code, tc.want)
		}
	}
}

func TestAlertHandlers(t *testing.T) {
	repo := NewMockRepo()
	r := setupTestServer(repo)

	alertID := uuid.New()
	runID := uuid.New()
	_ = repo.CreateAlert(context.Background(), &domain.Alert{
		ID:         alertID,
		RunID:      runID,
		ProvinceID: "79",
		Status:     domain.AlertStatusOpen,
		CreatedAt:  time.Now(),
	})

	// 1. List Alerts
	req := httptest.NewRequest(http.MethodGet, "/internal/v1/workflow/alerts?status=open", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// 2. Confirm Alert
	confirmReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/alerts/%s/confirm", alertID), nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, confirmReq)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204 on confirm, got %d: %s", w.Code, w.Body.String())
	}
	if repo.alerts[alertID].Status != domain.AlertStatusClosed {
		t.Errorf("expected alert to be closed, got %s", repo.alerts[alertID].Status)
	}
}

func TestCasesAndAllocationPlan_Fallback(t *testing.T) {
	repo := NewMockRepo()
	r := setupTestServer(repo)

	// 1. Create Case
	casePayload := map[string]any{
		"title":      "Dịch sốt xuất huyết Quận 8",
		"created_by": "officer_01",
		"alert_ids":  []string{},
	}
	body, _ := json.Marshal(casePayload)
	req := httptest.NewRequest(http.MethodPost, "/internal/v1/workflow/cases", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var createdCase api.Case
	_ = json.Unmarshal(w.Body.Bytes(), &createdCase)

	// 2. Create Allocation Plan (Greedy fallback)
	planPayload := map[string]any{
		"budget": 1000000.0,
		"items": []map[string]any{
			{"province_id": "79", "cases_pred": 120.0, "cost": 400000.0},
			{"province_id": "77", "cases_pred": 80.0, "cost": 700000.0}, // Exceeds budget if combined
		},
	}
	body, _ = json.Marshal(planPayload)
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/allocation-plans", createdCase.Id), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var plan api.AllocationPlan
	_ = json.Unmarshal(w.Body.Bytes(), &plan)
	if len(plan.Allocations) != 1 {
		t.Fatalf("expected 1 allocation item due to budget cap, got %d", len(plan.Allocations))
	}
	if plan.TotalCost != 400000.0 {
		t.Errorf("expected total_cost 400000, got %f", plan.TotalCost)
	}
}

func TestAllocationPlan_OptimizeService(t *testing.T) {
	// Mock external optimize server
	optSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/allocate" && r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"total_cost": 500000.0,
				"estimated_cases_prevented": 35.0,
				"allocations": [
					{"province_id": "79", "amount": 1.0, "explanation": "Tối ưu hóa bởi CP-SAT solver"}
				]
			}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer optSrv.Close()

	repo := NewMockRepo()
	r := setupTestServer(repo, httpapi.WithOptimizeURL(optSrv.URL))

	cID := uuid.New()
	_ = repo.CreateCase(context.Background(), &domain.Case{
		ID:        cID,
		Title:     "Case test optimize",
		Status:    domain.CaseStatusOpen,
		CreatedBy: "officer_01",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})

	planPayload := map[string]any{
		"budget": 1000000.0,
		"items": []map[string]any{
			{"province_id": "79", "cases_pred": 120.0, "cost": 500000.0},
		},
	}
	body, _ := json.Marshal(planPayload)
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/allocation-plans", cID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var plan api.AllocationPlan
	_ = json.Unmarshal(w.Body.Bytes(), &plan)
	if plan.TotalCost != 500000.0 || plan.EstimatedCasesPrevented != 35.0 {
		t.Errorf("expected values from optimize service, got total_cost=%f, prevented=%f", plan.TotalCost, plan.EstimatedCasesPrevented)
	}
	if len(plan.Allocations) != 1 || plan.Allocations[0].Explanation != "Tối ưu hóa bởi CP-SAT solver" {
		t.Errorf("expected CP-SAT explanation, got: %v", plan.Allocations)
	}
}

func TestGenerateDraftGuardrailBlockDoesNotSaveDraft(t *testing.T) {
	genSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-service-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"type":"about:blank","title":"Blocked","status":422,"code":"genai.guardrail_blocked","request_id":"req-1","guardrails":[{"code":"G1","name":"data","passed":false,"detail":"invalid","blocking":true}],"content":"must not leak"}`))
	}))
	defer genSrv.Close()
	repo := NewMockRepo()
	caseID := uuid.New()
	alert := &domain.Alert{ID: uuid.New(), RunID: uuid.New(), ProvinceID: "ha_noi"}
	_ = repo.CreateAlert(context.Background(), alert)
	_ = repo.CreateCase(context.Background(), &domain.Case{ID: caseID, CreatedBy: "officer", AlertIDs: []uuid.UUID{alert.ID}})
	r := setupTestServer(repo, httpapi.WithGenAIURL(genSrv.URL))
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", caseID), bytes.NewBufferString(`{"draft_type":"b2g"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnprocessableEntity || len(repo.drafts) != 0 || bytes.Contains(w.Body.Bytes(), []byte("must not leak")) {
		t.Fatalf("blocked draft must not be saved or leaked: status=%d body=%s drafts=%d", w.Code, w.Body.String(), len(repo.drafts))
	}
}

func TestGenerateDraftRejectsUntrustedResponses(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		status     int
	}{
		{"unavailable", `{}`, http.StatusServiceUnavailable},
		{"invalid hash", `{"title":"test","content":"content","content_hash":"wrong","all_guardrails_passed":true,"guardrails":[],"citations":[]}`, http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer srv.Close()
			repo := NewMockRepo()
			alert := &domain.Alert{ID: uuid.New(), RunID: uuid.New(), ProvinceID: "ha_noi"}
			_ = repo.CreateAlert(context.Background(), alert)
			caseID := uuid.New()
			_ = repo.CreateCase(context.Background(), &domain.Case{ID: caseID, AlertIDs: []uuid.UUID{alert.ID}})
			r := setupTestServer(repo, httpapi.WithGenAIURL(srv.URL))
			req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", caseID), bytes.NewBufferString(`{"draft_type":"b2g"}`))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != http.StatusBadGateway || len(repo.drafts) != 0 {
				t.Fatalf("status=%d drafts=%d", w.Code, len(repo.drafts))
			}
		})
	}
}

func TestDraftLifecycle_GenAIServiceAndReview(t *testing.T) {
	// Mock external GenAI server
	genSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/genai/draft" && r.Method == http.MethodPost {
			var request struct {
				Slots struct {
					RunID       string   `json:"run_id"`
					ProvinceIDs []string `json:"province_ids"`
				} `json:"slots"`
			}
			if json.NewDecoder(r.Body).Decode(&request) != nil || request.Slots.RunID == "" || len(request.Slots.ProvinceIDs) != 1 || request.Slots.ProvinceIDs[0] != "ha_noi" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			content := "Kính gửi UBND TP: Đề xuất triển khai biện pháp khẩn cấp theo Quyết định 3711/QĐ-BYT."
			_ = json.NewEncoder(w).Encode(map[string]any{
				"title":                 "Công điện",
				"content":               content,
				"content_hash":          domain.ComputeHash(content),
				"all_guardrails_passed": true,
				"guardrails": []any{
					map[string]any{"code": "G1", "name": "data", "passed": true, "detail": ""},
					map[string]any{"code": "G2", "name": "locations", "passed": true, "detail": ""},
					map[string]any{"code": "G3", "name": "citations", "passed": true, "detail": ""},
					map[string]any{"code": "G4", "name": "format", "passed": true, "detail": ""},
					map[string]any{"code": "G5", "name": "safety", "passed": true, "detail": ""},
					map[string]any{"code": "G6", "name": "length", "passed": true, "detail": "", "blocking": false},
				},
				"citations": []any{
					map[string]any{
						"document_id":      "vn-moh-qd3711-2014",
						"title":            "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue",
						"issuer":           "Bộ Y tế",
						"document_version": "3711/QĐ-BYT",
						"status":           "effective",
						"provision":        "Mục III. Hướng dẫn giám sát và phòng chống dịch - Giám sát véc tơ",
						"quote":            "Trong quá trình giám sát véc tơ (muỗi, lăng quăng/bọ gậy), nếu chỉ số mật độ muỗi cao (≥ 0,5 con/nhà) hoặc chỉ số Breteau (BI) ≥ 30 là yếu tố nguy cơ cao.",
						"source_url":       "http://file.medinet.gov.vn/Data/soytehcm/nghiepvuy/Attachments/QD_3711_BYT.pdf",
					},
				},
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer genSrv.Close()

	repo := NewMockRepo()
	r := setupTestServer(repo, httpapi.WithGenAIURL(genSrv.URL))

	cID := uuid.New()
	alert := &domain.Alert{ID: uuid.New(), RunID: uuid.New(), ProvinceID: "ha_noi"}
	_ = repo.CreateAlert(context.Background(), alert)
	_ = repo.CreateCase(context.Background(), &domain.Case{
		ID:        cID,
		AlertIDs:  []uuid.UUID{alert.ID},
		Title:     "Case khẩn cấp đợt 2",
		Status:    domain.CaseStatusOpen,
		CreatedBy: "officer_01",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})

	// 1. Generate Draft via GenAI
	genPayload := map[string]any{
		"draft_type": "b2g",
		"title":      "Công điện khẩn cấp dịch",
	}
	body, _ := json.Marshal(genPayload)
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", cID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var draft api.DispatchDraft
	_ = json.Unmarshal(w.Body.Bytes(), &draft)
	if draft.GenerationEvidence == nil || draft.GenerationEvidence.ContentHash != domain.ComputeHash(draft.Content) {
		t.Fatalf("missing or mismatched generation evidence: %s", w.Body.String())
	}
	getReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/internal/v1/workflow/drafts/%s", draft.Id), nil)
	getResponse := httptest.NewRecorder()
	r.ServeHTTP(getResponse, getReq)
	var stored api.DispatchDraft
	if getResponse.Code != http.StatusOK || json.Unmarshal(getResponse.Body.Bytes(), &stored) != nil || stored.GenerationEvidence == nil || stored.GenerationEvidence.ContentHash != draft.GenerationEvidence.ContentHash {
		t.Fatalf("evidence was not retained: %s", getResponse.Body.String())
	}
	if draft.Content != "Kính gửi UBND TP: Đề xuất triển khai biện pháp khẩn cấp theo Quyết định 3711/QĐ-BYT." {
		t.Errorf("unexpected content generated: %s", draft.Content)
	}

	// 2. Submit Review - Violation of 4-Eyes Principle (Creator cannot approve their own B2G draft)
	reviewPayloadSelf := map[string]any{
		"action":        "approve",
		"reviewer_id":   "officer_01", // same as creator
		"draft_version": draft.Version,
		"note":          "Tự duyệt bản thân",
	}
	body, _ = json.Marshal(reviewPayloadSelf)
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/drafts/%s/reviews", draft.Id), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 due to four-eyes violation, got %d: %s", w.Code, w.Body.String())
	}

	// 3. Submit Review - Valid approval by approver_lead
	reviewPayloadValid := map[string]any{
		"action":        "approve",
		"reviewer_id":   "approver_lead",
		"draft_version": draft.Version,
		"note":          "Đã thẩm định thông tin chuẩn xác",
	}
	body, _ = json.Marshal(reviewPayloadValid)
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/drafts/%s/reviews", draft.Id), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 on review approval, got %d: %s", w.Code, w.Body.String())
	}

	// 4. Dispatch Approved Order
	dispatchPayload := map[string]any{
		"recipient": "UBND Quận 8",
	}
	body, _ = json.Marshal(dispatchPayload)
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/drafts/%s/dispatch", draft.Id), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 on dispatch, got %d: %s", w.Code, w.Body.String())
	}

	var order api.DispatchOrder
	_ = json.Unmarshal(w.Body.Bytes(), &order)
	if order.Status != api.PENDING {
		t.Errorf("expected PENDING order status, got %s", order.Status)
	}
}

func TestGenerateDraftWithConfirmedAllocationPlan(t *testing.T) {
	var capturedSlots map[string]any
	genSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/genai/draft" && r.Method == http.MethodPost {
			var request struct {
				Slots map[string]any `json:"slots"`
			}
			if json.NewDecoder(r.Body).Decode(&request) != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			capturedSlots = request.Slots
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			content := "Bản mô phỏng phân bổ ngân sách 500000000 và 15 giường."
			_ = json.NewEncoder(w).Encode(map[string]any{
				"title":                 "Công điện",
				"content":               content,
				"content_hash":          domain.ComputeHash(content),
				"all_guardrails_passed": true,
				"guardrails": []any{
					map[string]any{"code": "G1", "name": "data", "passed": true, "detail": ""},
					map[string]any{"code": "G2", "name": "locations", "passed": true, "detail": ""},
					map[string]any{"code": "G3", "name": "citations", "passed": true, "detail": ""},
					map[string]any{"code": "G4", "name": "format", "passed": true, "detail": ""},
					map[string]any{"code": "G5", "name": "safety", "passed": true, "detail": ""},
					map[string]any{"code": "G6", "name": "length", "passed": true, "detail": "", "blocking": false},
				},
				"citations": []any{
					map[string]any{
						"document_id":      "vn-qd02-2016",
						"title":            "Quy định điều kiện công bố dịch, công bố hết dịch bệnh truyền nhiễm",
						"issuer":           "Thủ tướng Chính phủ",
						"document_version": "02/2016/QĐ-TTg",
						"status":           "effective",
						"provision":        "Điều 2, Khoản 2, Điểm a. Điều kiện công bố dịch bệnh truyền nhiễm đối với bệnh truyền nhiễm thuộc nhóm B và nhóm C",
						"quote":            "Một xã, phường, thị trấn (sau đây gọi tắt là xã) được coi là có dịch khi có số người mắc bệnh vượt quá số mắc trung bình của tháng cùng kỳ 03 năm gần nhất;",
						"source_url":       "https://congbao.chinhphu.vn/tai-ve-van-ban-so-02-2016-qd-ttg-19018-13534?format=pdf",
					},
				},
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer genSrv.Close()

	repo := NewMockRepo()
	r := setupTestServer(repo, httpapi.WithGenAIURL(genSrv.URL))

	cID := uuid.New()
	alert := &domain.Alert{ID: uuid.New(), RunID: uuid.New(), ProvinceID: "ha_noi"}
	_ = repo.CreateAlert(context.Background(), alert)
	_ = repo.CreateCase(context.Background(), &domain.Case{
		ID:        cID,
		AlertIDs:  []uuid.UUID{alert.ID},
		Title:     "Hồ sơ dịch tễ có kế hoạch phân bổ",
		Status:    domain.CaseStatusOpen,
		CreatedBy: "officer",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})

	plan := &domain.AllocationPlan{
		ID:                      uuid.New(),
		CaseID:                  cID,
		Budget:                  500000000,
		TotalCost:               480000000,
		EstimatedCasesPrevented: 100,
		Allocations: []domain.AllocationItem{
			{ProvinceID: "ha_noi", Amount: 480000000, Beds: 15, Supplies: 100, Teams: 3, CasesPred: 120, Explanation: "Điều phối"},
		},
		Status:    domain.AllocationPlanStatusDraft,
		Version:   1,
		CreatedAt: time.Now().UTC(),
	}
	_ = repo.CreateAllocationPlan(context.Background(), plan)

	// Step 1: Call GenerateDraft with UNCONFIRMED plan_id -> should return 400
	planIDStr := plan.ID.String()
	genPayload := map[string]any{
		"draft_type": "b2g",
		"plan_id":    planIDStr,
	}
	body, _ := json.Marshal(genPayload)
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", cID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for unconfirmed plan, got %d: %s", w.Code, w.Body.String())
	}

	// Step 2: Confirm plan via endpoint with authenticated actor ID
	confirmReq := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/allocation-plans/%s/confirm", cID, planIDStr), nil)
	confirmReq.Header.Set(authx.HeaderActorID, "officer_xuly_01")
	wConfirm := httptest.NewRecorder()
	r.ServeHTTP(wConfirm, confirmReq)
	if wConfirm.Code != http.StatusOK {
		t.Fatalf("expected 200 on confirm, got %d: %s", wConfirm.Code, wConfirm.Body.String())
	}
	var confirmedPlan api.AllocationPlan
	if err := json.Unmarshal(wConfirm.Body.Bytes(), &confirmedPlan); err != nil {
		t.Fatalf("failed to decode confirmed plan: %v", err)
	}
	if confirmedPlan.Status != api.Confirmed {
		t.Fatalf("expected confirmed status, got %s", confirmedPlan.Status)
	}
	if confirmedPlan.ConfirmedBy == nil || *confirmedPlan.ConfirmedBy != "officer_xuly_01" {
		t.Fatalf("expected confirmed_by officer_xuly_01, got %v", confirmedPlan.ConfirmedBy)
	}
	if confirmedPlan.ConfirmedAt == nil {
		t.Fatal("expected non-nil confirmed_at")
	}

	// Step 2b: Test idempotency and snapshot immutability when re-confirming
	confirmReq2 := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/allocation-plans/%s/confirm", cID, planIDStr), nil)
	confirmReq2.Header.Set(authx.HeaderActorID, "other_actor_99")
	wConfirm2 := httptest.NewRecorder()
	r.ServeHTTP(wConfirm2, confirmReq2)
	if wConfirm2.Code != http.StatusOK {
		t.Fatalf("expected 200 on idempotent re-confirm, got %d: %s", wConfirm2.Code, wConfirm2.Body.String())
	}
	var confirmedPlan2 api.AllocationPlan
	_ = json.Unmarshal(wConfirm2.Body.Bytes(), &confirmedPlan2)
	if confirmedPlan2.ConfirmedBy == nil || *confirmedPlan2.ConfirmedBy != "officer_xuly_01" {
		t.Fatalf("immutable plan must retain original confirmed_by, got %v", confirmedPlan2.ConfirmedBy)
	}
	if !confirmedPlan2.ConfirmedAt.Equal(*confirmedPlan.ConfirmedAt) {
		t.Fatalf("immutable plan must retain original confirmed_at: %v vs %v", confirmedPlan2.ConfirmedAt, confirmedPlan.ConfirmedAt)
	}

	// Step 3: Call GenerateDraft with CONFIRMED plan_id -> should succeed with 201
	req = httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", cID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}

	if capturedSlots == nil {
		t.Fatal("expected slots to be captured")
	}
	if capturedSlots["budget_allocated"] != 480000000.0 {
		t.Errorf("expected budget 480000000, got %v", capturedSlots["budget_allocated"])
	}
	if capturedSlots["beds_allocated"] != float64(15) && capturedSlots["beds_allocated"] != 15 {
		t.Errorf("expected beds 15, got %v", capturedSlots["beds_allocated"])
	}
	if capturedSlots["supplies_allocated"] != float64(100) && capturedSlots["supplies_allocated"] != 100 {
		t.Errorf("expected supplies 100, got %v", capturedSlots["supplies_allocated"])
	}
	if capturedSlots["teams_allocated"] != float64(3) && capturedSlots["teams_allocated"] != 3 {
		t.Errorf("expected teams 3, got %v", capturedSlots["teams_allocated"])
	}
	// Verify that predicted cases matches CasesPred (120), NOT estimated_cases_prevented * 4.2 (420)
	if capturedSlots["cases_predicted_total"] != float64(120) {
		t.Errorf("expected cases_predicted_total 120 from CasesPred, got %v", capturedSlots["cases_predicted_total"])
	}
	// Verify alert creation month is NOT mislabeled as origin_month
	if capturedSlots["origin_month"] != nil {
		t.Errorf("expected origin_month to be nil when not from forecast model, got %v", capturedSlots["origin_month"])
	}
	provenance, ok := capturedSlots["provenance"].(map[string]any)
	if !ok || provenance["plan_id"] != plan.ID.String() {
		t.Errorf("expected provenance plan_id %s, got %v", plan.ID.String(), provenance)
	}
	if provenance["plan_version"] != float64(1) {
		t.Errorf("expected provenance plan_version 1, got %v", provenance["plan_version"])
	}
	if provenance["plan_hash"] == nil || provenance["plan_hash"] == "" {
		t.Error("expected non-empty plan_hash")
	}
}

func TestGenerateDraftWithOldConfirmedAndNewDraftPlan(t *testing.T) {
	var capturedSlots map[string]any
	genSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var reqBody map[string]any
		_ = json.NewDecoder(r.Body).Decode(&reqBody)
		if s, ok := reqBody["slots"].(map[string]any); ok {
			capturedSlots = s
		}
		w.Header().Set("Content-Type", "application/json")
		mockContent := "Nội dung dự thảo mô phỏng"
		mockHash := domain.ComputeHash(mockContent)
		allPassed := true
		_ = json.NewEncoder(w).Encode(map[string]any{
			"title":                 "Công điện điều phối dịch tễ mô phỏng",
			"content":               mockContent,
			"content_hash":          mockHash,
			"all_guardrails_passed": &allPassed,
			"guardrails": []any{
				map[string]any{"code": "G1", "name": "data", "passed": true, "detail": ""},
				map[string]any{"code": "G2", "name": "locations", "passed": true, "detail": ""},
				map[string]any{"code": "G3", "name": "citations", "passed": true, "detail": ""},
				map[string]any{"code": "G4", "name": "format", "passed": true, "detail": ""},
				map[string]any{"code": "G5", "name": "safety", "passed": true, "detail": ""},
				map[string]any{"code": "G6", "name": "length", "passed": true, "detail": "", "blocking": false},
			},
			"citations": []any{
				map[string]any{
					"document_id":      "vn-moh-qd3711-2014",
					"title":            "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue",
					"issuer":           "Bộ Y tế",
					"document_version": "3711/QĐ-BYT",
					"status":           "effective",
					"provision":        "Mục III. Hướng dẫn giám sát và phòng chống dịch - Giám sát véc tơ",
					"quote":            "Trong quá trình giám sát véc tơ (muỗi, lăng quăng/bọ gậy), nếu chỉ số mật độ muỗi cao (≥ 0,5 con/nhà) hoặc chỉ số Breteau (BI) ≥ 30 là yếu tố nguy cơ cao.",
					"source_url":       "http://file.medinet.gov.vn/Data/soytehcm/nghiepvuy/Attachments/QD_3711_BYT.pdf",
				},
			},
		})
	}))
	defer genSrv.Close()

	repo := NewMockRepo()
	r := setupTestServer(repo, httpapi.WithGenAIURL(genSrv.URL))

	cID := uuid.New()
	alert := &domain.Alert{ID: uuid.New(), RunID: uuid.New(), ProvinceID: "ha_noi"}
	_ = repo.CreateAlert(context.Background(), alert)
	_ = repo.CreateCase(context.Background(), &domain.Case{ID: cID, CreatedBy: "officer", AlertIDs: []uuid.UUID{alert.ID}})

	// 1. Plan cũ đã xác nhận (version 1)
	planOld := &domain.AllocationPlan{
		ID:        uuid.New(),
		CaseID:    cID,
		Budget:    100_000_000,
		TotalCost: 95_000_000,
		Status:    domain.AllocationPlanStatusConfirmed,
		Version:   1,
		Allocations: []domain.AllocationItem{
			{ProvinceID: "ha_noi", Amount: 95_000_000, CasesPred: 50},
		},
	}
	_ = repo.CreateAllocationPlan(context.Background(), planOld)

	// 2. Plan mới chưa xác nhận (version 2, status draft)
	planNew := &domain.AllocationPlan{
		ID:        uuid.New(),
		CaseID:    cID,
		Budget:    200_000_000,
		TotalCost: 190_000_000,
		Status:    domain.AllocationPlanStatusDraft,
		Version:   2,
		Allocations: []domain.AllocationItem{
			{ProvinceID: "ha_noi", Amount: 190_000_000, CasesPred: 100},
		},
	}
	_ = repo.CreateAllocationPlan(context.Background(), planNew)

	// Kịch bản A: Client KHÔNG gửi plan_id (ví dụ do plan mới nhất là draft)
	// Backend tuyệt đối KHÔNG tự ý chọn planOld; dự thảo không chứa số liệu phân bổ
	capturedSlots = nil
	reqA := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", cID), bytes.NewBufferString(`{"draft_type":"b2g"}`))
	reqA.Header.Set("Content-Type", "application/json")
	wA := httptest.NewRecorder()
	r.ServeHTTP(wA, reqA)
	if wA.Code != http.StatusCreated {
		t.Fatalf("expected 201 for draft without plan, got %d: %s", wA.Code, wA.Body.String())
	}
	if capturedSlots["budget_allocated"] != nil {
		t.Errorf("backend must NOT pick old confirmed plan when plan_id is omitted, got budget: %v", capturedSlots["budget_allocated"])
	}
	provA, _ := capturedSlots["provenance"].(map[string]any)
	if provA["plan_id"] != nil {
		t.Errorf("provenance plan_id must be nil when plan_id omitted, got %v", provA["plan_id"])
	}

	// Kịch bản B: Client gửi plan_id của planNew (chưa xác nhận) -> phải bị từ chối 400
	bodyB, _ := json.Marshal(map[string]any{"draft_type": "b2g", "plan_id": planNew.ID})
	reqB := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", cID), bytes.NewReader(bodyB))
	reqB.Header.Set("Content-Type", "application/json")
	wB := httptest.NewRecorder()
	r.ServeHTTP(wB, reqB)
	if wB.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when requesting unconfirmed plan, got %d: %s", wB.Code, wB.Body.String())
	}

	// Kịch bản C: Client gửi plan_id của planOld (đã xác nhận) -> thành công 201 và chứa số liệu planOld
	capturedSlots = nil
	bodyC, _ := json.Marshal(map[string]any{"draft_type": "b2g", "plan_id": planOld.ID})
	reqC := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", cID), bytes.NewReader(bodyC))
	reqC.Header.Set("Content-Type", "application/json")
	wC := httptest.NewRecorder()
	r.ServeHTTP(wC, reqC)
	if wC.Code != http.StatusCreated {
		t.Fatalf("expected 201 when explicitly requesting confirmed plan, got %d: %s", wC.Code, wC.Body.String())
	}
	if capturedSlots["budget_allocated"] != 95_000_000.0 {
		t.Errorf("expected budget 95_000_000, got %v", capturedSlots["budget_allocated"])
	}
	provC, _ := capturedSlots["provenance"].(map[string]any)
	if provC["plan_id"] != planOld.ID.String() {
		t.Errorf("expected provenance plan_id %s, got %v", planOld.ID.String(), provC["plan_id"])
	}
}

func TestValidCitations_StrictVerification(t *testing.T) {
	mockContent := "Nội dung dự thảo mô phỏng"
	mockHash := domain.ComputeHash(mockContent)
	allPassed := true
	guardrails := []any{
		map[string]any{"code": "G1", "name": "data", "passed": true, "detail": ""},
		map[string]any{"code": "G2", "name": "locations", "passed": true, "detail": ""},
		map[string]any{"code": "G3", "name": "citations", "passed": true, "detail": ""},
		map[string]any{"code": "G4", "name": "format", "passed": true, "detail": ""},
		map[string]any{"code": "G5", "name": "safety", "passed": true, "detail": ""},
		map[string]any{"code": "G6", "name": "length", "passed": true, "detail": "", "blocking": false},
	}

	for _, tc := range []struct {
		name       string
		draftType  string
		citations  []any
		wantStatus int
	}{
		{
			name:       "b2g empty citations rejected",
			draftType:  "b2g",
			citations:  []any{},
			wantStatus: http.StatusBadGateway,
		},
		{
			name:       "b2b empty citations allowed",
			draftType:  "b2b",
			citations:  []any{},
			wantStatus: http.StatusCreated,
		},
		{
			name:      "uncatalogued document_id rejected",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-custom-random-law",
					"title":            "Luật lạ",
					"issuer":           "Cơ quan",
					"document_version": "99/2026",
					"status":           "effective",
					"provision":        "Điều 1. Phạm vi",
					"quote":            "Đây là trích dẫn giả mạo không thuộc danh mục.",
					"source_url":       "http://file.medinet.gov.vn/van-ban/123",
				},
			},
			wantStatus: http.StatusBadGateway,
		},
		{
			name:      "domain bypass via query param rejected",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-moh-qd3711-2014",
					"title":            "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue",
					"issuer":           "Bộ Y tế",
					"document_version": "3711/QĐ-BYT",
					"status":           "effective",
					"provision":        "Mục III. Hướng dẫn giám sát và phòng chống dịch - Giám sát véc tơ",
					"quote":            "Trong quá trình giám sát véc tơ (muỗi, lăng quăng/bọ gậy), nếu chỉ số mật độ muỗi cao (≥ 0,5 con/nhà) hoặc chỉ số Breteau (BI) ≥ 30 là yếu tố nguy cơ cao.",
					"source_url":       "https://evil-attacker.com/?source=file.medinet.gov.vn",
				},
			},
			wantStatus: http.StatusBadGateway,
		},
		{
			name:      "domain bypass via deceptive subdomain rejected",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-moh-qd3711-2014",
					"title":            "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue",
					"issuer":           "Bộ Y tế",
					"document_version": "3711/QĐ-BYT",
					"status":           "effective",
					"provision":        "Mục III. Hướng dẫn giám sát và phòng chống dịch - Giám sát véc tơ",
					"quote":            "Trong quá trình giám sát véc tơ (muỗi, lăng quăng/bọ gậy), nếu chỉ số mật độ muỗi cao (≥ 0,5 con/nhà) hoặc chỉ số Breteau (BI) ≥ 30 là yếu tố nguy cơ cao.",
					"source_url":       "https://file.medinet.gov.vn.attacker-domain.org/doc",
				},
			},
			wantStatus: http.StatusBadGateway,
		},
		{
			name:      "tampered quote rejected",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-moh-qd3711-2014",
					"title":            "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue",
					"issuer":           "Bộ Y tế",
					"document_version": "3711/QĐ-BYT",
					"status":           "effective",
					"provision":        "Mục III. Hướng dẫn giám sát và phòng chống dịch - Giám sát véc tơ",
					"quote":            "Chỉ số Breteau (BI) từ 99 trở lên mới là nguy cơ bùng phát dịch.",
					"source_url":       "http://file.medinet.gov.vn/Data/soytehcm/nghiepvuy/Attachments/QD_3711_BYT.pdf",
				},
			},
			wantStatus: http.StatusBadGateway,
		},
		{
			name:      "counterfeit 3711 document_id rejected",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-custom-3711",
					"title":            "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue",
					"issuer":           "Bộ Y tế",
					"document_version": "3711/QĐ-BYT",
					"status":           "effective",
					"provision":        "Mục III. Hướng dẫn giám sát và phòng chống dịch - Giám sát véc tơ",
					"quote":            "Trong quá trình giám sát véc tơ (muỗi, lăng quăng/bọ gậy), nếu chỉ số mật độ muỗi cao (≥ 0,5 con/nhà) hoặc chỉ số Breteau (BI) ≥ 30 là yếu tố nguy cơ cao.",
					"source_url":       "http://file.medinet.gov.vn/Data/soytehcm/nghiepvuy/Attachments/QD_3711_BYT.pdf",
				},
			},
			wantStatus: http.StatusBadGateway,
		},
		{
			name:      "counterfeit 02-2016 document_id rejected",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-custom-02-2016",
					"title":            "Quy định điều kiện công bố dịch, công bố hết dịch bệnh truyền nhiễm",
					"issuer":           "Thủ tướng Chính phủ",
					"document_version": "02/2016/QĐ-TTg",
					"status":           "effective",
					"provision":        "Điều 2, Khoản 2, Điểm a. Điều kiện công bố dịch bệnh truyền nhiễm đối với bệnh truyền nhiễm thuộc nhóm B và nhóm C",
					"quote":            "Một xã, phường, thị trấn (sau đây gọi tắt là xã) được coi là có dịch khi có số người mắc bệnh vượt quá số mắc trung bình của tháng cùng kỳ 03 năm gần nhất;",
					"source_url":       "https://congbao.chinhphu.vn/tai-ve-van-ban-so-02-2016-qd-ttg-19018-13534?format=pdf",
				},
			},
			wantStatus: http.StatusBadGateway,
		},
		{
			name:      "counterfeit 30-2020 document_id rejected",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-custom-30-2020",
					"title":            "Nghị định về công tác văn thư",
					"issuer":           "Chính phủ",
					"document_version": "30/2020/NĐ-CP",
					"status":           "effective",
					"provision":        "Điều 5, Khoản 1. Giá trị pháp lý của văn bản điện tử",
					"quote":            "Văn bản điện tử được ký số bởi người có thẩm quyền và ký số của cơ quan, tổ chức theo quy định của pháp luật có giá trị pháp lý như bản gốc văn bản giấy.",
					"source_url":       "https://vanban.chinhphu.vn/default.aspx?docid=199378&pageid=27160",
				},
			},
			wantStatus: http.StatusBadGateway,
		},
		{
			name:      "valid citation accepted",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-moh-qd3711-2014",
					"title":            "Hướng dẫn giám sát và phòng, chống bệnh sốt xuất huyết Dengue",
					"issuer":           "Bộ Y tế",
					"document_version": "3711/QĐ-BYT",
					"status":           "effective",
					"provision":        "Mục III. Hướng dẫn giám sát và phòng chống dịch - Giám sát véc tơ",
					"quote":            "Trong quá trình giám sát véc tơ (muỗi, lăng quăng/bọ gậy), nếu chỉ số mật độ muỗi cao (≥ 0,5 con/nhà) hoặc chỉ số Breteau (BI) ≥ 30 là yếu tố nguy cơ cao.",
					"source_url":       "http://file.medinet.gov.vn/Data/soytehcm/nghiepvuy/Attachments/QD_3711_BYT.pdf",
				},
			},
			wantStatus: http.StatusCreated,
		},
		{
			name:      "valid vn-nd30-2020 citation accepted",
			draftType: "b2g",
			citations: []any{
				map[string]any{
					"document_id":      "vn-nd30-2020",
					"title":            "Nghị định về công tác văn thư",
					"issuer":           "Chính phủ",
					"document_version": "30/2020/NĐ-CP",
					"status":           "effective",
					"provision":        "Điều 5, Khoản 1. Giá trị pháp lý của văn bản điện tử",
					"quote":            "Văn bản điện tử được ký số bởi người có thẩm quyền và ký số của cơ quan, tổ chức theo quy định của pháp luật có giá trị pháp lý như bản gốc văn bản giấy.",
					"source_url":       "https://vanban.chinhphu.vn/default.aspx?docid=199378&pageid=27160",
				},
			},
			wantStatus: http.StatusCreated,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			genSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]any{
					"title":                 "Dự thảo test",
					"content":               mockContent,
					"content_hash":          mockHash,
					"all_guardrails_passed": &allPassed,
					"guardrails":            guardrails,
					"citations":             tc.citations,
				})
			}))
			defer genSrv.Close()

			repo := NewMockRepo()
			r := setupTestServer(repo, httpapi.WithGenAIURL(genSrv.URL))
			cID := uuid.New()
			alert := &domain.Alert{ID: uuid.New(), RunID: uuid.New(), ProvinceID: "ha_noi"}
			_ = repo.CreateAlert(context.Background(), alert)
			_ = repo.CreateCase(context.Background(), &domain.Case{ID: cID, CreatedBy: "officer", AlertIDs: []uuid.UUID{alert.ID}})

			req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", cID), bytes.NewBufferString(fmt.Sprintf(`{"draft_type":%q}`, tc.draftType)))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d: %s", tc.wantStatus, w.Code, w.Body.String())
			}
		})
	}
}
