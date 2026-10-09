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

	adapter, err := forecastclient.NewAdapter(server.URL+"/internal/v1", server.Client())
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
	require.NoError(t, err)
	assert.Empty(t, provinces)
}

func TestAdapter_CheckRunAlerts_ConnectionFailure(t *testing.T) {
	adapter, err := forecastclient.NewAdapter("http://127.0.0.1:19998/internal/v1", http.DefaultClient)
	require.NoError(t, err)

	_, err = adapter.CheckRunAlerts(context.Background(), uuid.New())
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "lỗi gọi forecast api")
}
