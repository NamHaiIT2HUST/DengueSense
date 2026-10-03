package handler_test

import (
	"crypto/ed25519"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/handler"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/upstream"
)

const (
	runID    = "0192f0e1-7c1a-7000-8000-000000000001"
	userID   = "0192f0e1-7c1a-7000-8000-0000000000aa"
	svcToken = "token-dich-vu-gia"
)

// call là một lời gọi tới service giả.
type call struct {
	Method, Path, Query string
	Header              http.Header
	Body                string
}

// backends dựng identity/surveillance/forecast GIẢ nhưng nói đúng hợp đồng nội bộ; ghi lại mọi lời gọi.
type backends struct {
	mu    sync.Mutex
	calls []call

	pub   ed25519.PublicKey
	priv  ed25519.PrivateKey
	kid   string
	jwksN atomic.Int32
	svcN  atomic.Int32

	// hành vi có thể ghi đè theo test
	loginStatus    int
	refreshStatus  int
	logoutStatus   int
	forecastStatus map[string]int // theo hậu tố đường dẫn → mã trả về (mặc định 200)
	runs           string         // thân của GET /forecast-runs
	provincesDown  bool
	surveillance   string
	forecastDown   bool
}

func (b *backends) record(r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	b.mu.Lock()
	b.calls = append(b.calls, call{r.Method, r.URL.Path, r.URL.RawQuery, r.Header.Clone(), string(body)})
	b.mu.Unlock()
}

func (b *backends) callsTo(path string) []call {
	b.mu.Lock()
	defer b.mu.Unlock()
	var out []call
	for _, c := range b.calls {
		if c.Path == path {
			out = append(out, c)
		}
	}
	return out
}

func writeJSON(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = io.WriteString(w, body)
}

func problemJSON(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_, _ = io.WriteString(w, `{"type":"x","title":"t","status":`+strconv.Itoa(status)+`,"code":"`+code+`","instance":"/internal/v1/auth/login"}`)
}

const userJSON = `{"id":"` + userID + `","username":"an","display_name":"An","roles":["analyst"],"org_id":"cdc"}`

func (b *backends) identity() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /internal/v1/.well-known/jwks.json", func(w http.ResponseWriter, r *http.Request) {
		b.jwksN.Add(1)
		j := authx.NewJWKS(map[string]ed25519.PublicKey{b.kid: b.pub})
		out, _ := json.Marshal(j)
		writeJSON(w, 200, string(out))
	})
	mux.HandleFunc("POST /internal/v1/service-tokens", func(w http.ResponseWriter, r *http.Request) {
		b.svcN.Add(1)
		writeJSON(w, 200, `{"access_token":"`+svcToken+`","token_type":"Bearer","expires_in":300}`)
	})
	tokenBody := `{"access_token":"acc-1","token_type":"Bearer","expires_in":900,"refresh_token":"ref-BI-MAT","refresh_expires_in":604800,"user":` + userJSON + `}`
	mux.HandleFunc("POST /internal/v1/auth/login", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		if b.loginStatus != 0 {
			problemJSON(w, b.loginStatus, "auth.invalid_credentials")
			return
		}
		writeJSON(w, 200, tokenBody)
	})
	mux.HandleFunc("POST /internal/v1/auth/refresh", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		if b.refreshStatus != 0 {
			problemJSON(w, b.refreshStatus, "auth.refresh_invalid")
			return
		}
		writeJSON(w, 200, strings.Replace(tokenBody, "ref-BI-MAT", "ref-MOI", 1))
	})
	mux.HandleFunc("POST /internal/v1/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		if b.logoutStatus != 0 {
			w.WriteHeader(b.logoutStatus)
			return
		}
		w.WriteHeader(204)
	})
	mux.HandleFunc("GET /internal/v1/users/{id}", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 200, userJSON)
	})
	return mux
}

func (b *backends) surveillanceHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /internal/v1/provinces", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		if b.provincesDown {
			w.WriteHeader(500)
			_, _ = io.WriteString(w, "loi noi bo: secret-stacktrace")
			return
		}
		writeJSON(w, 200, `{"items":[
			{"province_id":"ha_noi","name":"Hà Nội","region":"north"},
			{"province_id":"an_giang","name":"An Giang","region":"south"}]}`)
	})
	mux.HandleFunc("GET /internal/v1/observations", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		if b.surveillance == "401" {
			problemJSON(w, 401, "common.unauthenticated")
			return
		}
		writeJSON(w, 200, `{"items":[],"next_cursor":null}`)
	})
	return mux
}

func (b *backends) forecastHandler() http.Handler {
	mux := http.NewServeMux()
	status := func(key string) int {
		if s, ok := b.forecastStatus[key]; ok {
			return s
		}
		return 200
	}
	mux.HandleFunc("GET /internal/v1/forecast-runs", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 200, b.runs)
	})
	mux.HandleFunc("POST /internal/v1/forecast-runs", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		w.Header().Set("Location", "/internal/v1/jobs/j1")
		writeJSON(w, 202, `{"id":"j1"}`)
	})
	mux.HandleFunc("GET /internal/v1/jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 200, `{"job_id":"j1","status":"succeeded","result_ref":"/internal/v1/forecast-runs/`+runID+`"}`)
	})
	mux.HandleFunc("GET /internal/v1/forecast-runs/{run}/forecasts", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		if b.forecastDown {
			w.WriteHeader(503)
			return
		}
		if s := status("forecasts"); s != 200 {
			problemJSON(w, s, "forecast.run_not_ready")
			return
		}
		writeJSON(w, 200, `{"meta":{"model_version":"m4-r2@1.0.0"},"horizon":1,"legend":{"exceed_prob":[],"cases_per_100k":[]},
			"items":[{"province_id":"ha_noi","horizon":1,"exceed_prob":0.4}]}`)
	})
	mux.HandleFunc("GET /internal/v1/forecast-runs/{run}/provinces/{p}/forecasts", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 200, `{"meta":{},"items":[]}`)
	})
	mux.HandleFunc("GET /internal/v1/forecast-runs/{run}/provinces/{p}/explanation", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 200, `{"meta":{},"province_id":"ha_noi"}`)
	})
	return mux
}

func (b *backends) workflowHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /internal/v1/workflow/alerts", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 200, `[]`)
	})
	mux.HandleFunc("POST /internal/v1/workflow/alerts/{id}/confirm", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		w.WriteHeader(204)
	})
	mux.HandleFunc("GET /internal/v1/workflow/cases", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 200, `[]`)
	})
	mux.HandleFunc("POST /internal/v1/workflow/cases", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 201, `{"id":"`+runID+`","title":"Case 1","status":"open","created_by":"`+userID+`","created_at":"2026-10-01T00:00:00Z"}`)
	})
	mux.HandleFunc("POST /internal/v1/workflow/drafts/{id}/reviews", func(w http.ResponseWriter, r *http.Request) {
		b.record(r)
		writeJSON(w, 200, `{"id":"`+runID+`","draft_id":"`+runID+`","draft_version":1,"reviewer_id":"`+userID+`","action":"approve","reviewed_at":"2026-10-01T00:00:00Z","draft_status":"APPROVED"}`)
	})
	return mux
}

type env struct {
	skew    *atomic.Int64 // độ lệch đồng hồ của bộ nạp JWKS (nanô giây)
	b       *backends
	gateway http.Handler
	signer  *authx.Ed25519Signer
	keys    *upstream.RemoteKeySet
}

func newEnv(t *testing.T, mutate func(*backends)) *env {
	t.Helper()
	pub, priv, err := authx.GenerateKeyPair()
	require.NoError(t, err)
	b := &backends{pub: pub, priv: priv, kid: "k1", forecastStatus: map[string]int{},
		runs: `{"items":[{"run_id":"` + runID + `"}],"next_cursor":null}`}
	if mutate != nil {
		mutate(b)
	}
	idSrv := httptest.NewServer(b.identity())
	survSrv := httptest.NewServer(b.surveillanceHandler())
	fcSrv := httptest.NewServer(b.forecastHandler())
	wfSrv := httptest.NewServer(b.workflowHandler())
	t.Cleanup(idSrv.Close)
	t.Cleanup(survSrv.Close)
	t.Cleanup(fcSrv.Close)
	t.Cleanup(wfSrv.Close)

	log := slog.New(slog.DiscardHandler)
	client := &http.Client{Timeout: 3 * time.Second}
	skew := new(atomic.Int64)
	keys := upstream.NewRemoteKeySet(idSrv.URL, client, log).WithClock(func() time.Time {
		return time.Now().Add(time.Duration(skew.Load()))
	})
	require.NoError(t, keys.Refresh(t.Context()))
	verifier, err := authx.NewKeySetVerifier(keys, "denguesense-identity", "denguesense-gateway")
	require.NoError(t, err)
	up := upstream.NewClient(map[string]string{
		upstream.Identity: idSrv.URL, upstream.Surveillance: survSrv.URL, upstream.Forecast: fcSrv.URL, upstream.Workflow: wfSrv.URL,
	}, upstream.NewTokenSource(idSrv.URL, "bi-mat-thu-nghiem-dai-hon-16", client), client, log)

	signer, err := authx.NewEd25519Signer(priv, "denguesense-identity", "denguesense-gateway")
	require.NoError(t, err)
	signer = signer.WithKeyID("k1")

	router := app.NewRouter(app.Deps{
		Log: log, Verifier: verifier, Server: &handler.Gateway{Up: up, CookieSecure: true},
		Ready: keys.Ready, MaxBody: 1 << 20, Limiter: app.NewAuthLimiter(3, time.Minute),
	})
	return &env{b: b, gateway: router, signer: signer, keys: keys, skew: skew}
}

func (e *env) user(t *testing.T, roles ...authx.Role) string {
	t.Helper()
	tok, err := e.signer.Sign(authx.Actor{ID: userID, Roles: roles, OrgID: "cdc"})
	require.NoError(t, err)
	return tok
}

func (e *env) do(method, path, bearer, body string, hdr ...string) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rd)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	w := httptest.NewRecorder()
	e.gateway.ServeHTTP(w, req)
	return w
}

func code(t *testing.T, w *httptest.ResponseRecorder) string {
	t.Helper()
	var p struct {
		Code string `json:"code"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &p), w.Body.String())
	return p.Code
}

// ---------- xác thực & cookie ----------

func TestLogin_RefreshTokenGoesToHttpOnlyCookieNotBody(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("POST", "/api/v1/auth/login", "", `{"username":"an","password":"mat-khau-dai-du"}`)
	require.Equal(t, 200, w.Code, w.Body.String())

	assert.NotContains(t, w.Body.String(), "refresh_token", "thân công khai không được chứa refresh token")
	assert.NotContains(t, w.Body.String(), "ref-BI-MAT")
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, "acc-1", body["access_token"])
	assert.Contains(t, body, "user")

	cookies := w.Result().Cookies()
	require.Len(t, cookies, 1)
	c := cookies[0]
	assert.Equal(t, "refresh_token", c.Name)
	assert.Equal(t, "ref-BI-MAT", c.Value)
	assert.True(t, c.HttpOnly)
	assert.True(t, c.Secure)
	assert.Equal(t, http.SameSiteStrictMode, c.SameSite)
	assert.Equal(t, "/api/v1/auth", c.Path)
	assert.Equal(t, 604800, c.MaxAge)
}

func TestLogin_WrongCredentialsPassThroughWithoutCookie(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.loginStatus = 401 })
	w := e.do("POST", "/api/v1/auth/login", "", `{"username":"an","password":"sai-mat-khau-day"}`)
	require.Equal(t, 401, w.Code)
	assert.Equal(t, "auth.invalid_credentials", code(t, w))
	assert.Empty(t, w.Result().Cookies())
	assert.NotContains(t, w.Body.String(), "/internal/", "problem không được lộ đường dẫn nội bộ")
}

func TestLogin_IsRateLimitedPerIP(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.loginStatus = 401 })
	for i := 0; i < 3; i++ {
		w := e.do("POST", "/api/v1/auth/login", "", `{"username":"an","password":"sai-mat-khau-day"}`)
		require.Equal(t, 401, w.Code)
	}
	w := e.do("POST", "/api/v1/auth/login", "", `{"username":"an","password":"sai-mat-khau-day"}`)
	require.Equal(t, 429, w.Code)
	assert.Equal(t, "common.rate_limited", code(t, w))
	assert.NotEmpty(t, w.Header().Get("Retry-After"))
	assert.Len(t, e.b.callsTo("/internal/v1/auth/login"), 3, "yêu cầu bị chặn không được tới identity")

	// X-Forwarded-For không lách được giới hạn.
	w = e.do("POST", "/api/v1/auth/login", "", `{"username":"an","password":"sai-mat-khau-day"}`, "X-Forwarded-For", "1.2.3.4")
	assert.Equal(t, 429, w.Code)
}

func TestRefresh_UsesCookieAndRotatesIt(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("POST", "/api/v1/auth/refresh", "", "", "Cookie", "refresh_token=ref-BI-MAT")
	require.Equal(t, 200, w.Code, w.Body.String())
	sent := e.b.callsTo("/internal/v1/auth/refresh")
	require.Len(t, sent, 1)
	assert.JSONEq(t, `{"refresh_token":"ref-BI-MAT"}`, sent[0].Body)
	require.Len(t, w.Result().Cookies(), 1)
	assert.Equal(t, "ref-MOI", w.Result().Cookies()[0].Value)
	assert.NotContains(t, w.Body.String(), "ref-MOI")
}

func TestRefresh_MissingCookieIs401WithoutCallingIdentity(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("POST", "/api/v1/auth/refresh", "", "")
	require.Equal(t, 401, w.Code)
	assert.Equal(t, "auth.refresh_invalid", code(t, w))
	assert.Empty(t, e.b.callsTo("/internal/v1/auth/refresh"))
}

func TestRefresh_RejectedTokenClearsCookie(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.refreshStatus = 401 })
	w := e.do("POST", "/api/v1/auth/refresh", "", "", "Cookie", "refresh_token=da-bi-dung-lai")
	require.Equal(t, 401, w.Code)
	require.Len(t, w.Result().Cookies(), 1)
	assert.Equal(t, -1, w.Result().Cookies()[0].MaxAge, "cookie hỏng phải bị xoá")
}

func TestLogout_RevokesAndClearsCookie(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("POST", "/api/v1/auth/logout", "", "", "Cookie", "refresh_token=ref-BI-MAT") // KHÔNG cần access token
	require.Equal(t, 204, w.Code)
	require.Len(t, w.Result().Cookies(), 1)
	assert.Equal(t, -1, w.Result().Cookies()[0].MaxAge)
	assert.Len(t, e.b.callsTo("/internal/v1/auth/logout"), 1)
}

func TestLogout_IdentityDownKeepsCookieSoClientCanRetry(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.logoutStatus = 500 })
	w := e.do("POST", "/api/v1/auth/logout", "", "", "Cookie", "refresh_token=ref-BI-MAT")
	require.Equal(t, 503, w.Code)
	assert.Empty(t, w.Result().Cookies())
}

func TestGetMe_AsksIdentityForTheTokenSubject(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("GET", "/api/v1/me", e.user(t, authx.RoleAnalyst), "")
	require.Equal(t, 200, w.Code, w.Body.String())
	assert.Len(t, e.b.callsTo("/internal/v1/users/"+userID), 1)
}

// ---------- chuyển tiếp ----------

func TestForward_UsesServiceTokenAndActorHeadersNeverTheUserToken(t *testing.T) {
	e := newEnv(t, nil)
	user := e.user(t, authx.RoleAnalyst, authx.RoleViewer)
	w := e.do("GET", "/api/v1/observations?province_id=ha_noi&from=2010-01", user, "")
	require.Equal(t, 200, w.Code, w.Body.String())

	got := e.b.callsTo("/internal/v1/observations")
	require.Len(t, got, 1)
	assert.Equal(t, "Bearer "+svcToken, got[0].Header.Get("Authorization"), "phải là token dịch vụ")
	assert.NotContains(t, got[0].Header.Get("Authorization"), user, "không được chuyển token người dùng đi tiếp")
	assert.Equal(t, userID, got[0].Header.Get("X-Actor-ID"))
	assert.Equal(t, "analyst,viewer", got[0].Header.Get("X-Actor-Roles"))
	assert.Equal(t, "cdc", got[0].Header.Get("X-Org-ID"))
	assert.Equal(t, "province_id=ha_noi&from=2010-01", got[0].Query)
}

func TestForward_ActorHeadersFromClientAreIgnored(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("GET", "/api/v1/observations?province_id=ha_noi", e.user(t, authx.RoleViewer), "",
		"X-Actor-ID", "ke-gia-mao", "X-Actor-Roles", "admin")
	require.Equal(t, 200, w.Code)
	got := e.b.callsTo("/internal/v1/observations")[0]
	assert.Equal(t, userID, got.Header.Get("X-Actor-ID"))
	assert.Equal(t, "viewer", got.Header.Get("X-Actor-Roles"))
}

func TestServiceTokenIsCachedAcrossRequests(t *testing.T) {
	e := newEnv(t, nil)
	tok := e.user(t, authx.RoleViewer)
	for i := 0; i < 4; i++ {
		require.Equal(t, 200, e.do("GET", "/api/v1/observations?province_id=ha_noi", tok, "").Code)
	}
	assert.EqualValues(t, 1, e.b.svcN.Load(), "chỉ xin token dịch vụ một lần cho cả 4 request")
}

func TestUpstream5xxBecomes503WithoutLeakingInternals(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.provincesDown = true })
	w := e.do("GET", "/api/v1/provinces", e.user(t, authx.RoleViewer), "")
	require.Equal(t, 503, w.Code)
	assert.Equal(t, "common.dependency_unavailable", code(t, w))
	assert.NotContains(t, w.Body.String(), "secret-stacktrace")
}

func TestUpstream401FromNonIdentityServiceIsOurMisconfigNotTheUsers(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.surveillance = "401" })
	w := e.do("GET", "/api/v1/observations?province_id=ha_noi", e.user(t, authx.RoleViewer), "")
	assert.Equal(t, 503, w.Code, "người dùng đã đăng nhập không được nhận 401 do gateway cấu hình sai")
}

func TestCreateForecastRun_RoleCheckedBeforeCallingForecast(t *testing.T) {
	e := newEnv(t, nil)
	body := `{"mode":"backtest","origin_month":"2010-03"}`
	idem := "Idempotency-Key"
	key := "0192f0e1-7c1a-7000-8000-00000000beef"

	w := e.do("POST", "/api/v1/forecast-runs", e.user(t, authx.RoleViewer), body, idem, key)
	require.Equal(t, 403, w.Code, w.Body.String())
	assert.Empty(t, e.b.callsTo("/internal/v1/forecast-runs"), "viewer bị chặn ngay ở gateway")

	w = e.do("POST", "/api/v1/forecast-runs", e.user(t, authx.RoleAnalyst), body, idem, key)
	require.Equal(t, 202, w.Code, w.Body.String())
	assert.Equal(t, "/api/v1/jobs/j1", w.Header().Get("Location"), "Location nội bộ phải được viết lại")
	sent := e.b.callsTo("/internal/v1/forecast-runs")
	require.Len(t, sent, 1)
	assert.Equal(t, key, sent[0].Header.Get("Idempotency-Key"))
	assert.JSONEq(t, body, sent[0].Body)
}

// ---------- BFF ----------

func TestRiskMap_MergesProvincesWithForecastsUsingLatestCompletedRun(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("GET", "/api/v1/risk-map?horizon=1", e.user(t, authx.RoleViewer), "")
	require.Equal(t, 200, w.Code, w.Body.String())

	var rm struct {
		Meta    map[string]any `json:"meta"`
		Horizon int            `json:"horizon"`
		Items   []struct {
			ProvinceID     string         `json:"province_id"`
			Name           string         `json:"name"`
			Region         string         `json:"region"`
			Forecast       map[string]any `json:"forecast"`
			OpenAlertCount *int           `json:"open_alert_count"`
		} `json:"items"`
		Warnings []any          `json:"warnings"`
		Legend   map[string]any `json:"legend"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &rm))
	assert.Equal(t, 1, rm.Horizon)
	assert.Equal(t, "m4-r2@1.0.0", rm.Meta["model_version"], "provenance của lượt phải đi kèm")
	require.Len(t, rm.Items, 2)
	assert.Equal(t, "ha_noi", rm.Items[0].ProvinceID)
	assert.Equal(t, "Hà Nội", rm.Items[0].Name)
	assert.NotNil(t, rm.Items[0].Forecast)
	assert.Nil(t, rm.Items[1].Forecast, "tỉnh không có dự báo trong lượt → forecast null")
	require.NotNil(t, rm.Items[0].OpenAlertCount)
	assert.Equal(t, 0, *rm.Items[0].OpenAlertCount)
	assert.NotNil(t, rm.Warnings)
	assert.Contains(t, rm.Legend, "exceed_prob")

	q := e.b.callsTo("/internal/v1/forecast-runs")
	require.Len(t, q, 1)
	assert.Contains(t, q[0].Query, "status=completed")
	assert.Len(t, e.b.callsTo("/internal/v1/forecast-runs/"+runID+"/forecasts"), 1)
}

func TestRiskMap_ExplicitRunIDSkipsLookup(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("GET", "/api/v1/risk-map?horizon=1&run_id="+runID, e.user(t, authx.RoleViewer), "")
	require.Equal(t, 200, w.Code)
	assert.Empty(t, e.b.callsTo("/internal/v1/forecast-runs"))
}

func TestRiskMap_NoCompletedRunIs404(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.runs = `{"items":[],"next_cursor":null}` })
	w := e.do("GET", "/api/v1/risk-map?horizon=1", e.user(t, authx.RoleViewer), "")
	require.Equal(t, 404, w.Code)
	assert.Equal(t, "forecast.run_not_found", code(t, w))
}

func TestRiskMap_RunNotReadyIsForwardedAs409(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.forecastStatus["forecasts"] = 409 })
	w := e.do("GET", "/api/v1/risk-map?horizon=1", e.user(t, authx.RoleViewer), "")
	require.Equal(t, 409, w.Code)
	assert.Equal(t, "forecast.run_not_ready", code(t, w))
}

func TestRiskMap_ForecastDownIs503NotAPartialMapWithoutForecasts(t *testing.T) {
	e := newEnv(t, func(b *backends) { b.forecastDown = true })
	w := e.do("GET", "/api/v1/risk-map?horizon=1", e.user(t, authx.RoleViewer), "")
	assert.Equal(t, 503, w.Code)
}

func TestProvinceForecastsAndExplanation_ResolveLatestRun(t *testing.T) {
	e := newEnv(t, nil)
	tok := e.user(t, authx.RoleViewer)

	require.Equal(t, 200, e.do("GET", "/api/v1/provinces/ha_noi/forecasts", tok, "").Code)
	assert.Len(t, e.b.callsTo("/internal/v1/forecast-runs/"+runID+"/provinces/ha_noi/forecasts"), 1)

	require.Equal(t, 200, e.do("GET", "/api/v1/provinces/ha_noi/explanations?horizon=3", tok, "").Code)
	ex := e.b.callsTo("/internal/v1/forecast-runs/" + runID + "/provinces/ha_noi/explanation")
	require.Len(t, ex, 1)
	assert.Equal(t, "horizon=3", ex[0].Query)
}

// ---------- JWKS ----------

func TestJWKS_UnknownKidTriggersRefreshForKeyRotation(t *testing.T) {
	e := newEnv(t, nil)
	before := e.b.jwksN.Load()

	// Khoá mới xuất hiện ở identity (xoay khoá) — gateway chưa biết kid "k2".
	pub2, priv2, err := authx.GenerateKeyPair()
	require.NoError(t, err)
	e.b.pub, e.b.kid = pub2, "k2"
	s2, err := authx.NewEd25519Signer(priv2, "denguesense-identity", "denguesense-gateway")
	require.NoError(t, err)
	tok, err := s2.WithKeyID("k2").Sign(authx.Actor{ID: userID, Roles: []authx.Role{authx.RoleViewer}, OrgID: "cdc"})
	require.NoError(t, err)

	// Lần làm mới gần nhất < 10 s trước → chưa được làm mới ngay (chống ngập identity): token bị từ chối.
	assert.Equal(t, 401, e.do("GET", "/api/v1/provinces", tok, "").Code)
	assert.Equal(t, before, e.b.jwksN.Load(), "không làm mới dồn dập")

	// Sau khoảng nghỉ, kid lạ kích hoạt làm mới và token của khoá mới được nhận.
	e.skew.Store(int64(11 * time.Second))
	assert.Equal(t, 200, e.do("GET", "/api/v1/provinces", tok, "").Code)
	assert.Equal(t, before+1, e.b.jwksN.Load())
}

func TestJWKS_Readiness(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("GET", "/readyz", "", "")
	assert.Equal(t, 200, w.Code)
}

func TestJWKS_NotReadyWithoutKeysAndTokensAreRejected(t *testing.T) {
	log := slog.New(slog.DiscardHandler)
	keys := upstream.NewRemoteKeySet("http://127.0.0.1:1", &http.Client{Timeout: time.Second}, log)
	assert.Error(t, keys.Ready(t.Context()))
}

func TestInternalPathsNeverLeakIntoPublicBodies(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("GET", "/api/v1/jobs/0192f0e1-7c1a-7000-8000-000000000009", e.user(t, authx.RoleViewer), "")
	require.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), `"/api/v1/forecast-runs/`)
	assert.NotContains(t, w.Body.String(), "/internal/")
}

func TestInvalidHorizonIsRejectedBeforeAnyUpstreamCall(t *testing.T) {
	e := newEnv(t, nil)
	tok := e.user(t, authx.RoleViewer)
	for _, path := range []string{"/api/v1/risk-map?horizon=5", "/api/v1/provinces/ha_noi/explanations?horizon=4"} {
		w := e.do("GET", path, tok, "")
		require.Equal(t, 400, w.Code, path)
		assert.Equal(t, "common.validation_error", code(t, w))
	}
	assert.Empty(t, e.b.callsTo("/internal/v1/forecast-runs"), "không tốn lời gọi cho tham số sai")
}

func TestLogout_WithoutCookieIsIdempotent204(t *testing.T) {
	e := newEnv(t, nil)
	w := e.do("POST", "/api/v1/auth/logout", "", "")
	require.Equal(t, 204, w.Code)
	assert.Empty(t, e.b.callsTo("/internal/v1/auth/logout"), "không có cookie thì không cần gọi identity")
	require.Len(t, w.Result().Cookies(), 1)
	assert.Equal(t, -1, w.Result().Cookies()[0].MaxAge)
}

func TestWorkflow_ListAlertsAndConfirmRBAC(t *testing.T) {
	e := newEnv(t, nil)
	// Viewer xem được danh sách cảnh báo
	w := e.do("GET", "/api/v1/alerts", e.user(t, authx.RoleViewer), "")
	require.Equal(t, 200, w.Code)
	assert.Len(t, e.b.callsTo("/internal/v1/workflow/alerts"), 1)

	// Viewer không thể xác nhận cảnh báo (403)
	w = e.do("POST", "/api/v1/alerts/"+runID+"/confirm", e.user(t, authx.RoleViewer), "")
	require.Equal(t, 403, w.Code)

	// Officer xác nhận cảnh báo thành công (204)
	w = e.do("POST", "/api/v1/alerts/"+runID+"/confirm", e.user(t, authx.RoleOfficer), "")
	require.Equal(t, 204, w.Code)
	assert.Len(t, e.b.callsTo("/internal/v1/workflow/alerts/"+runID+"/confirm"), 1)
}

func TestWorkflow_ReviewRequiresApproverRole(t *testing.T) {
	e := newEnv(t, nil)
	body := `{"draft_version":1,"action":"approve","note":"dong y"}`

	// Officer không thể duyệt (403)
	w := e.do("POST", "/api/v1/drafts/"+runID+"/reviews", e.user(t, authx.RoleOfficer), body)
	require.Equal(t, 403, w.Code)

	// Admin không thể duyệt (403 - tách quản trị khỏi quyết định nghiệp vụ)
	w = e.do("POST", "/api/v1/drafts/"+runID+"/reviews", e.user(t, authx.RoleAdmin), body)
	require.Equal(t, 403, w.Code)

	// Approver duyệt thành công (200)
	w = e.do("POST", "/api/v1/drafts/"+runID+"/reviews", e.user(t, authx.RoleApprover), body)
	require.Equal(t, 200, w.Code)
	assert.Len(t, e.b.callsTo("/internal/v1/workflow/drafts/"+runID+"/reviews"), 1)
}
