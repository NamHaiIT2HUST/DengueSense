// Package handler hiện thực StrictServerInterface (hợp đồng công khai) của gateway: kiểm quyền thô, chuyển tiếp
// tới service phía sau bằng token dịch vụ + danh tính người dùng gốc (docs/09 §4.2, contracts/routing.yaml).
package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/upstream"
)

const (
	publicBase   = "/api/v1"
	internalBase = "/internal/v1"

	// RefreshCookie là tên cookie chứa refresh token (ADR-0005): HttpOnly, SameSite=Strict, chỉ gửi tới /api/v1/auth.
	RefreshCookie = "refresh_token"
	cookiePath    = publicBase + "/auth"

	riskMapTimeout = 3 * time.Second
)

// Gateway là hiện thực thật của gateway.
type Gateway struct {
	Up           *upstream.Client
	CookieSecure bool
}

var _ api.StrictServerInterface = (*Gateway)(nil)

// ---------- tiện ích ----------

func ginOf(ctx context.Context) *gin.Context {
	c, _ := ctx.(*gin.Context)
	return c
}

func actorOf(ctx context.Context) *authx.Actor {
	if a, ok := authx.ActorFrom(ctx); ok {
		return &a
	}
	return nil
}

// toRaw chuyển phản hồi service thành phản hồi công khai; chỉ giữ header an toàn, viết lại Location nội bộ.
func toRaw(resp *upstream.Response) Raw {
	h := http.Header{}
	for _, k := range []string{"Content-Type", "Cache-Control", "Etag", "Retry-After"} {
		if v := resp.Header.Get(k); v != "" {
			h.Set(k, v)
		}
	}
	if loc := resp.Header.Get("Location"); loc != "" {
		h.Set("Location", strings.Replace(loc, internalBase, publicBase, 1))
	}
	body := resp.Body
	if ct := h.Get("Content-Type"); strings.HasPrefix(ct, "application/json") || strings.HasPrefix(ct, "application/problem+json") {
		// Tham chiếu nội bộ (`instance` của problem, `result_ref` của job) phải trỏ vào API CÔNG KHAI, không lộ /internal.
		body = bytes.ReplaceAll(body, []byte(`"`+internalBase+`/`), []byte(`"`+publicBase+`/`))
	}
	return Raw{Status: resp.Status, Header: h, Body: body}
}

// fail đổi lỗi gọi service thành problem chuẩn (không lộ chi tiết nội bộ).
func fail(err error) error {
	if errors.Is(err, upstream.ErrUnavailable) {
		return httpx.DependencyUnavailable()
	}
	return err
}

func jsonRaw(status int, v any) (Raw, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return Raw{}, err
	}
	return Raw{Status: status, Header: http.Header{"Content-Type": {"application/json"}}, Body: b}, nil
}

// forward chuyển tiếp GET đường dẫn tương ứng (/api/v1/x → /internal/v1/x) cùng query.
func (g *Gateway) forward(ctx context.Context, service string) (Raw, error) {
	c := ginOf(ctx)
	resp, err := g.Up.Do(ctx, upstream.Request{
		Service: service,
		Method:  http.MethodGet,
		Path:    internalBase + strings.TrimPrefix(c.Request.URL.Path, publicBase),
		Query:   c.Request.URL.RawQuery,
		Actor:   actorOf(ctx),
	})
	if err != nil {
		return Raw{}, fail(err)
	}
	return toRaw(resp), nil
}

func (g *Gateway) get(ctx context.Context, service, path string, query url.Values) (*upstream.Response, error) {
	return g.Up.Do(ctx, upstream.Request{
		Service: service,
		Method:  http.MethodGet,
		Path:    path,
		Query:   query.Encode(),
		Actor:   actorOf(ctx),
	})
}

// ---------- danh mục & quan sát (surveillance) ----------

func (g *Gateway) ListProvinces(ctx context.Context, _ api.ListProvincesRequestObject) (api.ListProvincesResponseObject, error) {
	return g.forward(ctx, upstream.Surveillance)
}

func (g *Gateway) GetProvince(ctx context.Context, _ api.GetProvinceRequestObject) (api.GetProvinceResponseObject, error) {
	return g.forward(ctx, upstream.Surveillance)
}

func (g *Gateway) GetProvinceGeometry(ctx context.Context, _ api.GetProvinceGeometryRequestObject) (api.GetProvinceGeometryResponseObject, error) {
	return g.forward(ctx, upstream.Surveillance)
}

func (g *Gateway) ListDataVersions(ctx context.Context, _ api.ListDataVersionsRequestObject) (api.ListDataVersionsResponseObject, error) {
	return g.forward(ctx, upstream.Surveillance)
}

func (g *Gateway) ListObservations(ctx context.Context, _ api.ListObservationsRequestObject) (api.ListObservationsResponseObject, error) {
	return g.forward(ctx, upstream.Surveillance)
}

// ---------- dự báo & mô hình (forecast) ----------

func (g *Gateway) ListForecastRuns(ctx context.Context, _ api.ListForecastRunsRequestObject) (api.ListForecastRunsResponseObject, error) {
	return g.forward(ctx, upstream.Forecast)
}

func (g *Gateway) GetForecastRun(ctx context.Context, _ api.GetForecastRunRequestObject) (api.GetForecastRunResponseObject, error) {
	return g.forward(ctx, upstream.Forecast)
}

func (g *Gateway) GetJob(ctx context.Context, _ api.GetJobRequestObject) (api.GetJobResponseObject, error) {
	return g.forward(ctx, upstream.Forecast)
}

func (g *Gateway) GetModelCard(ctx context.Context, _ api.GetModelCardRequestObject) (api.GetModelCardResponseObject, error) {
	return g.forward(ctx, upstream.Forecast)
}

func (g *Gateway) ListLimitations(ctx context.Context, _ api.ListLimitationsRequestObject) (api.ListLimitationsResponseObject, error) {
	return g.forward(ctx, upstream.Forecast)
}

func (g *Gateway) ListModelVersions(ctx context.Context, _ api.ListModelVersionsRequestObject) (api.ListModelVersionsResponseObject, error) {
	return g.forward(ctx, upstream.Forecast)
}

// CreateForecastRun: vai trò tối thiểu `analyst` kiểm ở đây (từ chối sớm, không tốn một lượt gọi); forecast kiểm lại.
func (g *Gateway) CreateForecastRun(ctx context.Context, req api.CreateForecastRunRequestObject) (api.CreateForecastRunResponseObject, error) {
	if err := authx.RequireRoles(ctx, authx.RoleAnalyst, authx.RoleAdmin); err != nil {
		return nil, err
	}
	body, err := json.Marshal(req.Body)
	if err != nil {
		return nil, httpx.ValidationError("thân yêu cầu không hợp lệ")
	}
	resp, err := g.Up.Do(ctx, upstream.Request{
		Service: upstream.Forecast,
		Method:  http.MethodPost,
		Path:    internalBase + "/forecast-runs",
		Body:    body,
		Actor:   actorOf(ctx),
		Headers: map[string]string{"Idempotency-Key": req.Params.IdempotencyKey.String()},
	})
	if err != nil {
		return nil, fail(err)
	}
	return toRaw(resp), nil
}

// checkHorizon: mã sinh chỉ kiểm kiểu; giá trị hợp lệ là {1,2,3,6} — kiểm ở cửa vào, trước mọi lời gọi service.
func checkHorizon(h api.Horizon) error {
	switch int(h) {
	case 1, 2, 3, 6:
		return nil
	}
	return httpx.ValidationError("tham số không hợp lệ", httpx.FieldError{Field: "horizon", Message: "chỉ nhận 1, 2, 3 hoặc 6"})
}

// resolveRun trả run_id cần dùng: đúng run_id được truyền, hoặc lượt `completed` mới nhất. `final` khác nil nghĩa là
// service đã trả một phản hồi lỗi hợp đồng (vd 404) — chuyển tiếp nguyên văn.
func (g *Gateway) resolveRun(ctx context.Context, runID *openapi_types.UUID) (id string, final *Raw, err error) {
	if runID != nil {
		return runID.String(), nil, nil
	}
	resp, err := g.get(ctx, upstream.Forecast, internalBase+"/forecast-runs", url.Values{"status": {"completed"}, "limit": {"1"}})
	if err != nil {
		return "", nil, fail(err)
	}
	if resp.Status != http.StatusOK {
		r := toRaw(resp)
		return "", &r, nil
	}
	var page struct {
		Items []struct {
			ID string `json:"run_id"`
		} `json:"items"`
	}
	if err := json.Unmarshal(resp.Body, &page); err != nil {
		return "", nil, httpx.DependencyUnavailable()
	}
	if len(page.Items) == 0 || page.Items[0].ID == "" {
		return "", nil, httpx.New(http.StatusNotFound, "forecast.run_not_found", "Không tìm thấy lượt dự báo", "chưa có lượt dự báo nào hoàn tất")
	}
	return page.Items[0].ID, nil, nil
}

func (g *Gateway) GetProvinceForecasts(ctx context.Context, req api.GetProvinceForecastsRequestObject) (api.GetProvinceForecastsResponseObject, error) {
	run, final, err := g.resolveRun(ctx, req.Params.RunId)
	if err != nil {
		return nil, err
	}
	if final != nil {
		return *final, nil
	}
	resp, err := g.get(ctx, upstream.Forecast,
		internalBase+"/forecast-runs/"+run+"/provinces/"+url.PathEscape(string(req.ProvinceId))+"/forecasts", nil)
	if err != nil {
		return nil, fail(err)
	}
	return toRaw(resp), nil
}

func (g *Gateway) GetProvinceExplanation(ctx context.Context, req api.GetProvinceExplanationRequestObject) (api.GetProvinceExplanationResponseObject, error) {
	if err := checkHorizon(req.Params.Horizon); err != nil {
		return nil, err
	}
	run, final, err := g.resolveRun(ctx, req.Params.RunId)
	if err != nil {
		return nil, err
	}
	if final != nil {
		return *final, nil
	}
	resp, err := g.get(ctx, upstream.Forecast,
		internalBase+"/forecast-runs/"+run+"/provinces/"+url.PathEscape(string(req.ProvinceId))+"/explanation",
		url.Values{"horizon": {strconv.Itoa(int(req.Params.Horizon))}})
	if err != nil {
		return nil, fail(err)
	}
	return toRaw(resp), nil
}

// GetRiskMap là BFF: ghép danh mục tỉnh (surveillance) với dự báo của lượt (forecast). Danh mục tỉnh và dự báo
// là nguồn CHÍNH (thiếu thì lỗi); cảnh báo là nguồn phụ — Đợt 1 chưa có workflow nên open_alert_count = 0.
func (g *Gateway) GetRiskMap(ctx context.Context, req api.GetRiskMapRequestObject) (api.GetRiskMapResponseObject, error) {
	if err := checkHorizon(req.Params.Horizon); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, riskMapTimeout)
	defer cancel()

	run, final, err := g.resolveRun(ctx, req.Params.RunId)
	if err != nil {
		return nil, err
	}
	if final != nil {
		return *final, nil
	}

	var (
		wg                             sync.WaitGroup
		fcResp, prResp, wfResp         *upstream.Response
		fcErr, prErr, wfErr            error
		horizon                        = strconv.Itoa(int(req.Params.Horizon))
		forecastsPath                  = internalBase + "/forecast-runs/" + run + "/forecasts"
		provincesPath                  = internalBase + "/provinces"
		alertsPath                     = internalBase + "/workflow/alerts"
		forecastsQueries               = url.Values{"horizon": {horizon}}
		alertsQueries                  = url.Values{"status": {"open"}, "run_id": {run}}
	)
	wg.Add(3)
	go func() {
		defer wg.Done()
		fcResp, fcErr = g.get(ctx, upstream.Forecast, forecastsPath, forecastsQueries)
	}()
	go func() { defer wg.Done(); prResp, prErr = g.get(ctx, upstream.Surveillance, provincesPath, nil) }()
	go func() { defer wg.Done(); wfResp, wfErr = g.get(ctx, upstream.Workflow, alertsPath, alertsQueries) }()
	wg.Wait()
	if fcErr != nil {
		return nil, fail(fcErr)
	}
	if prErr != nil {
		return nil, fail(prErr)
	}
	if fcResp.Status != http.StatusOK {
		return toRaw(fcResp), nil // 404/409… của lượt dự báo: chuyển tiếp nguyên văn
	}
	if prResp.Status != http.StatusOK {
		return toRaw(prResp), nil
	}

	var fc struct {
		Meta    json.RawMessage   `json:"meta"`
		Horizon int               `json:"horizon"`
		Legend  json.RawMessage   `json:"legend"`
		Items   []json.RawMessage `json:"items"`
	}
	var provinces struct {
		Items []struct {
			ProvinceID string `json:"province_id"`
			Name       string `json:"name"`
			Region     string `json:"region"`
		} `json:"items"`
	}
	if json.Unmarshal(fcResp.Body, &fc) != nil || json.Unmarshal(prResp.Body, &provinces) != nil {
		return nil, httpx.DependencyUnavailable()
	}
	byProvince := make(map[string]json.RawMessage, len(fc.Items))
	for _, raw := range fc.Items {
		var head struct {
			ProvinceID string `json:"province_id"`
		}
		if json.Unmarshal(raw, &head) != nil || head.ProvinceID == "" {
			return nil, httpx.DependencyUnavailable()
		}
		byProvince[head.ProvinceID] = raw
	}

	var alerts []struct {
		ProvinceID string `json:"province_id"`
	}
	var warnings []any
	if wfErr == nil && wfResp != nil && wfResp.Status == http.StatusOK {
		if json.Unmarshal(wfResp.Body, &alerts) != nil {
			warnings = append(warnings, map[string]string{"code": "gateway.alerts_unavailable", "message": "Lỗi dữ liệu từ workflow"})
		}
	} else {
		warnings = append(warnings, map[string]string{"code": "gateway.alerts_unavailable", "message": "Không thể lấy cảnh báo"})
	}

	alertCountByProv := make(map[string]int)
	for _, a := range alerts {
		alertCountByProv[a.ProvinceID]++
	}

	type item struct {
		ProvinceID     string          `json:"province_id"`
		Name           string          `json:"name"`
		Region         string          `json:"region"`
		Forecast       json.RawMessage `json:"forecast"`
		OpenAlertCount int             `json:"open_alert_count"`
	}
	items := make([]item, 0, len(provinces.Items))
	for _, p := range provinces.Items {
		f, ok := byProvince[p.ProvinceID]
		if !ok {
			f = json.RawMessage("null")
		}
		items = append(items, item{
			ProvinceID:     p.ProvinceID,
			Name:           p.Name,
			Region:         p.Region,
			Forecast:       f,
			OpenAlertCount: alertCountByProv[p.ProvinceID],
		})
	}
	return jsonRaw(http.StatusOK, map[string]any{
		"meta":     fc.Meta,
		"horizon":  fc.Horizon,
		"legend":   fc.Legend,
		"items":    items,
		"warnings": warnings,
	})
}

// ---------- xác thực (identity, bọc cookie HttpOnly) ----------

func (g *Gateway) refreshCookie(value string, maxAge int) string {
	c := http.Cookie{ //nolint:gosec // Secure cấu hình được: chỉ tắt khi chạy dev qua http (mặc định bật)
		Name:     RefreshCookie,
		Value:    value,
		Path:     cookiePath,
		MaxAge:   maxAge, // âm = xoá
		HttpOnly: true,
		Secure:   g.CookieSecure,
		SameSite: http.SameSiteStrictMode,
	}
	return c.String()
}

func (g *Gateway) clearCookie() string { return g.refreshCookie("", -1) }

func (g *Gateway) identityPost(ctx context.Context, path string, body any) (*upstream.Response, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	resp, err := g.Up.Do(ctx, upstream.Request{Service: upstream.Identity, Method: http.MethodPost, Path: internalBase + path, Body: b})
	return resp, fail(err)
}

// tokenResponse dựng phản hồi công khai từ InternalTokenResponse: BỎ refresh_token khỏi thân, đặt vào cookie.
func (g *Gateway) tokenResponse(resp *upstream.Response) (Raw, error) {
	var in struct {
		AccessToken      string          `json:"access_token"`
		TokenType        string          `json:"token_type"`
		ExpiresIn        int             `json:"expires_in"`
		RefreshToken     string          `json:"refresh_token"`
		RefreshExpiresIn int             `json:"refresh_expires_in"`
		User             json.RawMessage `json:"user"`
	}
	if err := json.Unmarshal(resp.Body, &in); err != nil || in.RefreshToken == "" || in.AccessToken == "" {
		return Raw{}, httpx.DependencyUnavailable()
	}
	out, err := jsonRaw(http.StatusOK, map[string]any{
		"access_token": in.AccessToken,
		"token_type":   in.TokenType,
		"expires_in":   in.ExpiresIn,
		"user":         in.User,
	})
	if err != nil {
		return Raw{}, err
	}
	out.Header.Add("Set-Cookie", g.refreshCookie(in.RefreshToken, in.RefreshExpiresIn))
	return out, nil
}

func (g *Gateway) Login(ctx context.Context, req api.LoginRequestObject) (api.LoginResponseObject, error) {
	resp, err := g.identityPost(ctx, "/auth/login", req.Body)
	if err != nil {
		return nil, err
	}
	if resp.Status != http.StatusOK {
		return toRaw(resp), nil
	}
	return g.tokenResponse(resp)
}

func (g *Gateway) RefreshToken(ctx context.Context, _ api.RefreshTokenRequestObject) (api.RefreshTokenResponseObject, error) {
	cookie, err := ginOf(ctx).Request.Cookie(RefreshCookie)
	if err != nil || cookie.Value == "" {
		return nil, httpx.New(http.StatusUnauthorized, "auth.refresh_invalid", "Phiên không hợp lệ", "thiếu refresh token")
	}
	resp, err := g.identityPost(ctx, "/auth/refresh", map[string]string{"refresh_token": cookie.Value})
	if err != nil {
		return nil, err
	}
	if resp.Status != http.StatusOK {
		out := toRaw(resp)
		out.Header.Add("Set-Cookie", g.clearCookie()) // token đã hỏng/bị dùng lại: xoá để client không thử lại mãi
		return out, nil
	}
	return g.tokenResponse(resp)
}

func (g *Gateway) Logout(ctx context.Context, _ api.LogoutRequestObject) (api.LogoutResponseObject, error) {
	if cookie, err := ginOf(ctx).Request.Cookie(RefreshCookie); err == nil && cookie.Value != "" {
		resp, err := g.identityPost(ctx, "/auth/logout", map[string]string{"refresh_token": cookie.Value})
		if err != nil {
			return nil, err // identity lỗi: KHÔNG xoá cookie để client có thể thử lại (token vẫn còn hiệu lực)
		}
		if resp.Status != http.StatusNoContent {
			return toRaw(resp), nil
		}
	}
	return Raw{Status: http.StatusNoContent, Header: http.Header{"Set-Cookie": {g.clearCookie()}}}, nil
}

func (g *Gateway) GetMe(ctx context.Context, _ api.GetMeRequestObject) (api.GetMeResponseObject, error) {
	a, ok := authx.ActorFrom(ctx)
	if !ok {
		return nil, httpx.Unauthenticated("cần đăng nhập")
	}
	resp, err := g.get(ctx, upstream.Identity, internalBase+"/users/"+url.PathEscape(a.ID), nil)
	if err != nil {
		return nil, fail(err)
	}
	return toRaw(resp), nil
}
