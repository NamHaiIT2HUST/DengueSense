package forecastclient

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/workflow/app"
)

type Adapter struct {
	client *ClientWithResponses
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
