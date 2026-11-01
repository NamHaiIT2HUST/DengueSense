package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/postgres"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/domain"
)

// Run only against an explicitly provisioned disposable database and GenAI service.
func TestIntegrationGenAIAndPostgres(t *testing.T) {
	dsn, genURL, identityURL := os.Getenv("WORKFLOW_INTEGRATION_DB"), os.Getenv("WORKFLOW_INTEGRATION_GENAI"), os.Getenv("WORKFLOW_INTEGRATION_IDENTITY")
	workflowSecret, gatewaySecret, publicKey := os.Getenv("WORKFLOW_INTEGRATION_SECRET"), os.Getenv("WORKFLOW_INTEGRATION_GATEWAY_SECRET"), os.Getenv("GENAI_JWT_PUBLIC_KEY")
	if dsn == "" || genURL == "" || identityURL == "" || workflowSecret == "" || gatewaySecret == "" || publicKey == "" {
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
	identityClient := &http.Client{Timeout: 5 * time.Second}
	tokenBody, err := json.Marshal(map[string]string{"service": "gateway", "audience": "workflow", "client_secret": gatewaySecret})
	if err != nil {
		t.Fatal(err)
	}
	tokenReq, err := http.NewRequestWithContext(ctx, http.MethodPost, identityURL+"/internal/v1/service-tokens", bytes.NewReader(tokenBody))
	if err != nil {
		t.Fatal(err)
	}
	tokenReq.Header.Set("Content-Type", "application/json")
	tokenResp, err := identityClient.Do(tokenReq)
	if err != nil {
		t.Fatal(err)
	}
	defer tokenResp.Body.Close()
	var issued struct {
		AccessToken string `json:"access_token"`
	}
	if tokenResp.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(tokenResp.Body, 65536)).Decode(&issued) != nil || issued.AccessToken == "" {
		t.Fatalf("identity failed to issue gateway token: status=%d", tokenResp.StatusCode)
	}
	source := httpapi.IdentityTokenSource(identityURL, workflowSecret, identityClient)
	server := httpapi.NewServer(app.NewWorkflowService(repo, nil), repo, httpapi.WithGenAIURL(genURL), httpapi.WithGenAITokenSource(source))
	key, err := authx.ParsePublicKey(publicKey)
	if err != nil {
		t.Fatal(err)
	}
	verifier, err := authx.NewServiceVerifier(authx.StaticKeySet{"k1": key}, "denguesense-identity", "workflow")
	if err != nil {
		t.Fatal(err)
	}
	httpapi.RegisterAuthenticatedHandlers(router, server, verifier)
	request := func(kind string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/internal/v1/workflow/cases/%s/drafts/generate", c.ID), bytes.NewBufferString(fmt.Sprintf(`{"draft_type":%q}`, kind)))
		req.Header.Set(authx.HeaderActorID, "0192f0e1-7c1a-7000-8000-000000000001")
		req.Header.Set(authx.HeaderActorRoles, "officer")
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+issued.AccessToken)
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
	wantDrafts := 1
	if os.Getenv("WORKFLOW_INTEGRATION_DEMO") == "true" {
		if blocked.Code != http.StatusCreated || !strings.Contains(blocked.Body.String(), "MÔ PHỎNG CUỘC THI") {
			t.Fatalf("demo B2G status=%d body=%s", blocked.Code, blocked.Body.String())
		}
		if os.Getenv("WORKFLOW_INTEGRATION_REQUIRE_MODEL") == "true" {
			var demo api.DispatchDraft
			if json.Unmarshal(blocked.Body.Bytes(), &demo) != nil || demo.GenerationEvidence == nil || demo.GenerationEvidence.ModelUsed == nil || *demo.GenerationEvidence.ModelUsed == "" {
				t.Fatal("B2G demo did not record a real model response")
			}
		}
		wantDrafts = 2
	} else if blocked.Code != http.StatusUnprocessableEntity {
		t.Fatalf("B2G status=%d body=%s", blocked.Code, blocked.Body.String())
	}
	drafts, err := repo.ListDraftsByCase(ctx, c.ID)
	if err != nil || len(drafts) != wantDrafts {
		t.Fatalf("unexpected saved drafts: count=%d error=%v", len(drafts), err)
	}
}
