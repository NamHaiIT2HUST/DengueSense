package forecastclient

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
)

type Adapter struct {
	client *ClientWithResponses
}

// CasesPredicted lấy số ca từ lượt bất biến và địa bàn được chỉ định.
func (a *Adapter) CasesPredicted(ctx context.Context, runID uuid.UUID, provinceID string) (float64, error) {
	resp, err := a.client.GetProvinceForecastsWithResponse(ctx, runID, provinceID)
	if err != nil {
		return 0, fmt.Errorf("không thể lấy dự báo: %w", err)
	}
	if resp.JSON200 == nil || resp.JSON200.Meta.RunId != runID {
		return 0, fmt.Errorf("forecast API trả HTTP %d hoặc sai lượt", resp.StatusCode())
	}
	var payload struct {
		Items []struct {
			Horizon    *int     `json:"horizon"`
			ProvinceID string   `json:"province_id"`
			CasesPred  *float64 `json:"cases_pred"`
		} `json:"items"`
	}
	if err := json.Unmarshal(resp.Body, &payload); err != nil {
		return 0, fmt.Errorf("dữ liệu dự báo không hợp lệ: %w", err)
	}
	for _, item := range payload.Items {
		if item.Horizon != nil && *item.Horizon == 1 && item.ProvinceID == provinceID && item.CasesPred != nil && *item.CasesPred >= 0 && !math.IsNaN(*item.CasesPred) && !math.IsInf(*item.CasesPred, 0) {
			return *item.CasesPred, nil
		}
	}
	return 0, fmt.Errorf("không có dự báo tầm 1 tháng cho địa bàn")
}

// Ensure Adapter implements app.ForecastClient
var _ app.ForecastClient = (*Adapter)(nil)

func NewAdapter(baseURL string, httpClient *http.Client, tokenSource ...func(context.Context) (string, error)) (*Adapter, error) {
	// Generated paths already contain /internal/v1; support existing configuration without duplicating it.
	baseURL = strings.TrimSuffix(strings.TrimRight(baseURL, "/"), "/internal/v1")
	opts := []ClientOption{WithHTTPClient(httpClient)}
	if len(tokenSource) > 0 && tokenSource[0] != nil {
		opts = append(opts, WithRequestEditorFn(func(ctx context.Context, req *http.Request) error {
			token, err := tokenSource[0](ctx)
			if err != nil {
				return fmt.Errorf("không thể xác thực forecast: %w", err)
			}
			if token == "" {
				return fmt.Errorf("token forecast rỗng")
			}
			req.Header.Set("Authorization", "Bearer "+token)
			return nil
		}))
	}
	c, err := NewClientWithResponses(baseURL, opts...)
	if err != nil {
		return nil, err
	}
	return &Adapter{client: c}, nil
}

func (a *Adapter) CheckRunAlerts(ctx context.Context, runID uuid.UUID) ([]string, error) {
	var alertedProvinces []string
	alertedSet := make(map[string]bool)

	// Các tầm dự báo (1, 2, 3, 6)
	horizons := []Horizon{1, 2, 3, 6}

	for _, h := range horizons {
		params := &ListRunForecastsParams{Horizon: h}
		resp, err := a.client.ListRunForecastsWithResponse(ctx, runID, params)
		if err != nil {
			return nil, fmt.Errorf("lỗi gọi forecast api (horizon %d): %w", h, err)
		}

		if resp.JSON200 == nil {
			return nil, fmt.Errorf("forecast api trả lỗi HTTP %d cho horizon %d", resp.StatusCode(), h)
		}

		for _, item := range resp.JSON200.Items {
			// Giả sử logic cảnh báo: exceed_prob >= 0.5 là có cảnh báo
			if item.ExceedProb >= 0.5 {
				pid := string(item.ProvinceId)
				if !alertedSet[pid] {
					alertedSet[pid] = true
					alertedProvinces = append(alertedProvinces, pid)
				}
			}
		}
	}

	return alertedProvinces, nil
}
