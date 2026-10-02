package forecastclient

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
)

type Adapter struct {
	client *ClientWithResponses
}

// Ensure Adapter implements app.ForecastClient
var _ app.ForecastClient = (*Adapter)(nil)

func NewAdapter(baseURL string, httpClient *http.Client) (*Adapter, error) {
	c, err := NewClientWithResponses(baseURL, WithHTTPClient(httpClient))
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
			// API không trả về 200 (có thể chưa xong, hoặc lỗi khác)
			continue
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
