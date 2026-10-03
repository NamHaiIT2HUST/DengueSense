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
	gin.SetMode(gin.TestMode)
	r := gin.New()
	svc := app.NewWorkflowService(repo, nil)
	srv := httpapi.NewServer(svc, repo, opts...)
	api.RegisterHandlers(r, srv)
	return r
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

func TestDraftLifecycle_GenAIServiceAndReview(t *testing.T) {
	// Mock external GenAI server
	genSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/draft" && r.Method == http.MethodPost {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"content": "Kính gửi UBND TP: Đề xuất triển khai biện pháp khẩn cấp theo Quyết định 3711/QĐ-BYT.",
				"content_hash": "mockhash123",
				"citations": ["Quyết định 3711/QĐ-BYT"],
				"guardrail_flags": []
			}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer genSrv.Close()

	repo := NewMockRepo()
	r := setupTestServer(repo, httpapi.WithGenAIURL(genSrv.URL))

	cID := uuid.New()
	_ = repo.CreateCase(context.Background(), &domain.Case{
		ID:        cID,
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
