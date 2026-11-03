package httpapi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/httpapi"
)

func TestIdentityTokenSourceUsesWorkflowAndGenAIAudience(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request map[string]string
		if r.URL.Path != "/internal/v1/service-tokens" || json.NewDecoder(r.Body).Decode(&request) != nil || request["service"] != "workflow" || request["audience"] != "genai" || request["client_secret"] != "secret" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"test-token"}`))
	}))
	defer server.Close()
	source := httpapi.IdentityTokenSource(server.URL, "secret", server.Client())
	token, err := source(context.Background())
	if err != nil || token != "test-token" {
		t.Fatalf("unexpected token response: %q %v", token, err)
	}
}

func TestIdentityTokenSourceRejectsFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()
	if _, err := httpapi.IdentityTokenSource(server.URL, "secret", server.Client())(context.Background()); err == nil {
		t.Fatal("identity rejection must not produce a service token")
	}
}

func TestIdentityTokenSourceForForecastAudience(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request map[string]string
		if json.NewDecoder(r.Body).Decode(&request) != nil || request["service"] != "workflow" || request["audience"] != "forecast" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"forecast-token"}`))
	}))
	defer server.Close()
	token, err := httpapi.IdentityTokenSourceForAudience(server.URL, "secret", "forecast", server.Client())(context.Background())
	if err != nil || token != "forecast-token" {
		t.Fatalf("unexpected token response: %v", err)
	}
}
