package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

// Run only against an explicitly provisioned disposable database and GenAI service.
func TestIntegrationGenAIAndPostgres(t *testing.T) {
	dsn, genURL, token := os.Getenv("WORKFLOW_INTEGRATION_DB"), os.Getenv("WORKFLOW_INTEGRATION_GENAI"), os.Getenv("WORKFLOW_INTEGRATION_TOKEN")
	if dsn == "" || genURL == "" || token == "" {
		t.Skip("integration environment not configured")
	}
	if err := postgres.MigrateUp(dsn); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	repo := postgres.NewRepo(pool)
	alert := &domain.Alert{ID: uuid.New(), RunID: uuid.New(), ProvinceID: "ha_noi", CreatedAt: time.Now().UTC(), Status: domain.AlertStatusOpen}
	if err := repo.CreateAlert(ctx, alert); err != nil {
		t.Fatal(err)
	}
	c := &domain.Case{ID: uuid.New(), Title: "Integration", Status: domain.CaseStatusOpen, AlertIDs: []uuid.UUID{alert.ID}, CreatedBy: "officer", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
	if err := repo.CreateCase(ctx, c); err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	router := gin.New()
	server := httpapi.NewServer(app.NewWorkflowService(repo, nil), repo, httpapi.WithGenAIURL(genURL), httpapi.WithGenAITokenSource(func(context.Context) (string, error) { return token, nil }))
	api.RegisterHandlers(router, server)
	request := func(kind string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", c.ID), bytes.NewBufferString(fmt.Sprintf(`{"draft_type":%q}`, kind)))
		req.Header.Set("Content-Type", "application/json")
		result := httptest.NewRecorder()
		router.ServeHTTP(result, req)
		return result
	}
	good := request("b2b")
	if good.Code != http.StatusCreated {
		t.Fatalf("B2B status=%d body=%s", good.Code, good.Body.String())
	}
	var draft api.DispatchDraft
	if err := json.Unmarshal(good.Body.Bytes(), &draft); err != nil || draft.GenerationEvidence == nil {
		t.Fatalf("missing evidence: %s", good.Body.String())
	}
	saved, err := repo.GetDraftByID(ctx, draft.Id)
	if err != nil || len(saved.GenerationEvidence) == 0 || saved.ContentHash != domain.ComputeHash(saved.Content) {
		t.Fatalf("draft not persisted correctly: %v", err)
	}
	blocked := request("b2g")
	if blocked.Code != http.StatusUnprocessableEntity {
		t.Fatalf("B2G status=%d body=%s", blocked.Code, blocked.Body.String())
	}
	drafts, err := repo.ListDraftsByCase(ctx, c.ID)
	if err != nil || len(drafts) != 1 {
		t.Fatalf("blocked draft was persisted: count=%d error=%v", len(drafts), err)
	}
}
