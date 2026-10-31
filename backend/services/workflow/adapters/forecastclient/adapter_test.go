package forecastclient_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/adapters/forecastclient"
)

func TestAdapter_CheckRunAlerts_Success(t *testing.T) {
	runID := uuid.New()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/internal/v1/forecast-runs/"+runID.String()+"/forecasts", r.URL.Path)
		assert.Equal(t, "Bearer forecast-token", r.Header.Get("Authorization"))
		horizon := r.URL.Query().Get("horizon")
		w.Header().Set("Content-Type", "application/json")

		var hInt int
		var items []map[string]any
		switch horizon {
		case "1":
			hInt = 1
			items = []map[string]any{
				{"province_id": "ha_noi", "exceed_prob": 0.8},
				{"province_id": "bac_ninh", "exceed_prob": 0.3},
			}
		case "2":
			hInt = 2
			items = []map[string]any{
				{"province_id": "ha_noi", "exceed_prob": 0.9}, // trùng ha_noi, cần deduplicate
				{"province_id": "ho_chi_minh", "exceed_prob": 0.6},
			}
		case "3":
			hInt = 3
			items = []map[string]any{
				{"province_id": "da_nang", "exceed_prob": 0.49}, // < 0.5, không kích hoạt
			}
		case "6":
			hInt = 6
			items = []map[string]any{
				{"province_id": "can_tho", "exceed_prob": 0.55},
			}
		}

		resp := map[string]any{
			"run_id":  runID,
			"horizon": hInt,
			"items":   items,
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	adapter, err := forecastclient.NewAdapter(server.URL+"/internal/v1", server.Client(), func(context.Context) (string, error) { return "forecast-token", nil })
	require.NoError(t, err)

	provinces, err := adapter.CheckRunAlerts(context.Background(), runID)
	require.NoError(t, err)

	assert.ElementsMatch(t, []string{"ha_noi", "ho_chi_minh", "can_tho"}, provinces)
}

func TestAdapter_CheckRunAlerts_Non200Response(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"type":"not-found"}`))
	}))
	defer server.Close()

	adapter, err := forecastclient.NewAdapter(server.URL+"/internal/v1", server.Client())
	require.NoError(t, err)

	provinces, err := adapter.CheckRunAlerts(context.Background(), uuid.New())
	require.Error(t, err)
	assert.Nil(t, provinces)
	assert.Contains(t, err.Error(), "HTTP 404")
}

func TestAdapter_CheckRunAlerts_ConnectionFailure(t *testing.T) {
	adapter, err := forecastclient.NewAdapter("http://127.0.0.1:19998/internal/v1", http.DefaultClient)
	require.NoError(t, err)

	_, err = adapter.CheckRunAlerts(context.Background(), uuid.New())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "lỗi gọi forecast api")
}

func TestAdapter_CasesPredictedUsesMatchingRunAndHorizon(t *testing.T) {
	runID := uuid.New()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Contains(t, r.URL.Path, "/provinces/ha_noi/forecasts")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"meta":  map[string]any{"run_id": runID},
			"items": []map[string]any{{"province_id": "ha_noi", "horizon": 1, "cases_pred": 123.5}},
		})
	}))
	defer server.Close()
	adapter, err := forecastclient.NewAdapter(server.URL, server.Client())
	require.NoError(t, err)
	cases, err := adapter.CasesPredicted(context.Background(), runID, "ha_noi")
	require.NoError(t, err)
	assert.Equal(t, 123.5, cases)
	_, err = adapter.CasesPredicted(context.Background(), uuid.New(), "ha_noi")
	require.Error(t, err)
}

func TestAdapter_CasesPredictedRejectsMissingCases(t *testing.T) {
	runID := uuid.New()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]any{"run_id": runID}, "items": []map[string]any{{"province_id": "ha_noi", "horizon": 1}}})
	}))
	defer server.Close()
	adapter, err := forecastclient.NewAdapter(server.URL, server.Client())
	require.NoError(t, err)
	_, err = adapter.CasesPredicted(context.Background(), runID, "ha_noi")
	require.Error(t, err)
}
