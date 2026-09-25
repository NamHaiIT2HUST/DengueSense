package httpapi_test

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/contracttest"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/adapters/memory"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

const (
	issuer       = "denguesense-identity"
	userAudience = "denguesense-gateway"
	password     = "mat-khau-thu-nghiem-1"
	gatewaySec   = "bi-mat-gateway-rat-dai-va-ngau-nhien"
)

type env struct {
	router  http.Handler
	logs    *bytes.Buffer
	keys    authx.StaticKeySet
	signer  *authx.Ed25519Signer
	svcTok  string // token dịch vụ hợp lệ của gateway gửi tới identity
	readyFn func(context.Context) error
}

func newEnv(t *testing.T) *env {
	t.Helper()
	pub, priv, err := authx.GenerateKeyPair()
	require.NoError(t, err)
	signer, err := authx.NewEd25519Signer(priv, issuer, userAudience)
	require.NoError(t, err)
	signer = signer.WithKeyID("k1")

	store := memory.NewStore()
	hasher := domain.NewHasher(domain.PasswordParams{MemoryKiB: 8, Time: 1, Threads: 1, KeyLen: 32, SaltLen: 16})
	logs := &bytes.Buffer{}
	log := obsx.NewLogger(logs, "identity", "test", slog.LevelDebug)
	svc := app.New(store, memory.Tokens{S: store}, hasher, signer, app.Config{
		MaxFailedAttempts:   5,
		LockDuration:        15 * time.Minute,
		RefreshTTL:          7 * 24 * time.Hour,
		ServiceSecretHashes: map[string][sha256.Size]byte{"gateway": sha256.Sum256([]byte(gatewaySec))},
		AudiencePolicy:      app.DefaultAudiencePolicy(),
	}, nil, log)

	_, err = svc.CreateUser(context.Background(), domain.User{
		Username: "can.bo.a", DisplayName: "Cán bộ A", OrgID: "cdc-hcm", Roles: []authx.Role{authx.RoleOfficer, authx.RoleViewer},
	}, password, hasher)
	require.NoError(t, err)

	keys := authx.StaticKeySet{"k1": pub}
	verifier, err := authx.NewServiceVerifier(keys, issuer, "identity")
	require.NoError(t, err)
	e := &env{logs: logs, keys: keys, signer: signer}
	e.readyFn = func(context.Context) error { return nil }
	e.router = httpapi.NewRouter(httpapi.Deps{
		Log: log, Service: svc, Verifier: verifier, MaxBody: 1 << 20,
		JWKS:  authx.NewJWKS(map[string]ed25519.PublicKey{"k1": pub}),
		Ready: func(ctx context.Context) error { return e.readyFn(ctx) },
	})
	e.svcTok, err = signer.SignService("gateway", "identity")
	require.NoError(t, err)
	return e
}

func (e *env) do(t *testing.T, method, path, bearer string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *bytes.Reader
	if s, ok := body.(string); ok {
		rdr = bytes.NewReader([]byte(s))
	} else if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		rdr = bytes.NewReader(b)
	} else {
		rdr = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, rdr)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w
}

func decode[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &v), w.Body.String())
	return v
}

type problem struct {
	Code   string `json:"code"`
	Status int    `json:"status"`
	Errors []struct {
		Field string `json:"field"`
	} `json:"errors"`
}

type tokenResp struct {
	AccessToken      string `json:"access_token"`
	TokenType        string `json:"token_type"`
	ExpiresIn        int    `json:"expires_in"`
	RefreshToken     string `json:"refresh_token"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	User             struct {
		ID          string   `json:"id"`
		Username    string   `json:"username"`
		DisplayName string   `json:"display_name"`
		Roles       []string `json:"roles"`
		OrgID       string   `json:"org_id"`
	} `json:"user"`
}

func (e *env) login(t *testing.T) tokenResp {
	t.Helper()
	w := e.do(t, "POST", "/internal/v1/auth/login", e.svcTok, map[string]string{"username": "can.bo.a", "password": password})
	require.Equal(t, 200, w.Code, w.Body.String())
	return decode[tokenResp](t, w)
}

// ---------- Hợp đồng ↔ code ----------

func TestPublicRoutes_MatchContract(t *testing.T) {
	var fromContract []string
	for _, op := range contracttest.Load(t, "identity-internal.yaml") {
		if op.Public {
			fromContract = append(fromContract, op.Method+" "+op.Path)
			assert.True(t, httpapi.IsPublic(op.Method, op.Path), "hợp đồng đánh dấu công khai nhưng code chưa miễn: %s %s", op.Method, op.Path)
		}
	}
	assert.ElementsMatch(t, []string{
		"GET /healthz", "GET /readyz", "GET /internal/v1/.well-known/jwks.json", "POST /internal/v1/service-tokens",
	}, fromContract, "tập route công khai thay đổi: rà soát bảo mật rồi cập nhật cả hợp đồng lẫn publicRoutes")
}

func TestEveryContractOperation_FailClosed(t *testing.T) {
	e := newEnv(t)
	userTok, err := e.signer.Sign(authx.Actor{ID: "u1", Roles: []authx.Role{authx.RoleAdmin}})
	require.NoError(t, err)
	wrongAud, err := e.signer.SignService("gateway", "surveillance")
	require.NoError(t, err)

	for _, op := range contracttest.Load(t, "identity-internal.yaml") {
		t.Run(op.Method+" "+op.Path, func(t *testing.T) {
			path := contracttest.ConcretePath(op.Path)
			noToken := e.do(t, op.Method, path, "", nil)
			assert.NotEqual(t, http.StatusNotFound, noToken.Code, "route phải được đăng ký")
			if op.Public {
				assert.NotEqual(t, http.StatusUnauthorized, noToken.Code)
				return
			}
			assert.Equal(t, http.StatusUnauthorized, noToken.Code, "thiếu token dịch vụ phải 401")
			assert.Equal(t, http.StatusUnauthorized, e.do(t, op.Method, path, userTok, nil).Code, "token NGƯỜI DÙNG không thay được token dịch vụ")
			assert.Equal(t, http.StatusUnauthorized, e.do(t, op.Method, path, wrongAud, nil).Code, "token cấp cho service khác")
			assert.Equal(t, http.StatusUnauthorized, e.do(t, op.Method, path, "rac.rac.rac", nil).Code)
		})
	}
}

// ---------- Luồng nghiệp vụ qua HTTP ----------

func TestFullFlow_LoginRefreshRotateLogoutAndUser(t *testing.T) {
	e := newEnv(t)
	s1 := e.login(t)

	assert.Equal(t, "Bearer", s1.TokenType)
	assert.Equal(t, 900, s1.ExpiresIn)
	assert.Equal(t, 7*24*3600, s1.RefreshExpiresIn)
	assert.Equal(t, "can.bo.a", s1.User.Username)
	assert.Equal(t, []string{"officer", "viewer"}, s1.User.Roles)

	// Access token xác minh được bằng JWKS công khai của identity.
	jw := e.do(t, "GET", "/internal/v1/.well-known/jwks.json", "", nil)
	require.Equal(t, 200, jw.Code)
	var jwks authx.JWKS
	require.NoError(t, json.Unmarshal(jw.Body.Bytes(), &jwks))
	set, err := jwks.KeySet()
	require.NoError(t, err)
	verifier, err := authx.NewKeySetVerifier(set, issuer, userAudience)
	require.NoError(t, err)
	actor, err := verifier.Verify(s1.AccessToken)
	require.NoError(t, err, "gateway xác minh được token bằng JWKS lấy qua HTTP")
	assert.Equal(t, s1.User.ID, actor.ID)
	assert.NotContains(t, jw.Body.String(), "\"d\"", "JWKS không được chứa thành phần khoá riêng")

	// GET user bằng token dịch vụ.
	u := e.do(t, "GET", "/internal/v1/users/"+s1.User.ID, e.svcTok, nil)
	require.Equal(t, 200, u.Code, u.Body.String())
	assert.Contains(t, u.Body.String(), `"display_name":"Cán bộ A"`)
	assert.NotContains(t, u.Body.String(), "password", "không bao giờ trả mật khẩu/hash")
	assert.Equal(t, 404, e.do(t, "GET", "/internal/v1/users/0192f3a1-0000-7000-8000-0000000000ff", e.svcTok, nil).Code)

	// Xoay vòng.
	r := e.do(t, "POST", "/internal/v1/auth/refresh", e.svcTok, map[string]string{"refresh_token": s1.RefreshToken})
	require.Equal(t, 200, r.Code, r.Body.String())
	s2 := decode[tokenResp](t, r)
	assert.NotEqual(t, s1.RefreshToken, s2.RefreshToken)

	// Dùng lại token cũ → 401 auth.refresh_invalid; token mới cũng chết.
	bad := e.do(t, "POST", "/internal/v1/auth/refresh", e.svcTok, map[string]string{"refresh_token": s1.RefreshToken})
	assert.Equal(t, 401, bad.Code)
	assert.Equal(t, "auth.refresh_invalid", decode[problem](t, bad).Code)
	assert.Equal(t, 401, e.do(t, "POST", "/internal/v1/auth/refresh", e.svcTok, map[string]string{"refresh_token": s2.RefreshToken}).Code)

	// Đăng xuất idempotent.
	s3 := e.login(t)
	assert.Equal(t, 204, e.do(t, "POST", "/internal/v1/auth/logout", e.svcTok, map[string]string{"refresh_token": s3.RefreshToken}).Code)
	assert.Equal(t, 204, e.do(t, "POST", "/internal/v1/auth/logout", e.svcTok, map[string]string{"refresh_token": s3.RefreshToken}).Code)
	assert.Equal(t, 401, e.do(t, "POST", "/internal/v1/auth/refresh", e.svcTok, map[string]string{"refresh_token": s3.RefreshToken}).Code)
}

func TestLogin_ErrorsHaveStableCodesAndDoNotLeak(t *testing.T) {
	e := newEnv(t)
	login := func(user, pw string) *httptest.ResponseRecorder {
		return e.do(t, "POST", "/internal/v1/auth/login", e.svcTok, map[string]string{"username": user, "password": pw})
	}

	wrong := login("can.bo.a", "sai-mat-khau-xxxxx")
	unknown := login("khong.ton.tai", "sai-mat-khau-xxxxx")
	assert.Equal(t, 401, wrong.Code)
	assert.Equal(t, 401, unknown.Code)
	assert.Equal(t, "auth.invalid_credentials", decode[problem](t, wrong).Code)
	assert.Equal(t, "auth.invalid_credentials", decode[problem](t, unknown).Code)

	// Bốn lần sai nữa (tổng 5) → khoá.
	for i := 0; i < 4; i++ {
		login("can.bo.a", "sai-mat-khau-xxxxx")
	}
	locked := login("can.bo.a", password)
	assert.Equal(t, 401, locked.Code)
	assert.Equal(t, "auth.account_locked", decode[problem](t, locked).Code, "đúng mật khẩu cũng bị khoá")

	// Không lộ mật khẩu/hash trong phản hồi lỗi hay log.
	all := wrong.Body.String() + locked.Body.String() + e.logs.String()
	assert.NotContains(t, all, "sai-mat-khau-xxxxx")
	assert.NotContains(t, all, password)
	assert.NotContains(t, all, "argon2id")
}

func TestInputValidation(t *testing.T) {
	e := newEnv(t)
	post := func(path string, body any) (int, problem) {
		w := e.do(t, "POST", path, e.svcTok, body)
		return w.Code, decode[problem](t, w)
	}

	code, p := post("/internal/v1/auth/login", map[string]string{"username": "can.bo.a"})
	assert.Equal(t, 400, code)
	assert.Equal(t, "common.validation_error", p.Code)
	require.NotEmpty(t, p.Errors)
	assert.Equal(t, "password", p.Errors[0].Field)

	code, _ = post("/internal/v1/auth/login", map[string]string{"username": "", "password": "x"})
	assert.Equal(t, 400, code)
	code, _ = post("/internal/v1/auth/login", map[string]string{"username": "u", "password": strings.Repeat("a", 257)})
	assert.Equal(t, 400, code, "mật khẩu > 256 ký tự bị từ chối trước khi băm")
	code, _ = post("/internal/v1/auth/login", `{"username": "u", "password": `)
	assert.Equal(t, 400, code, "JSON hỏng")
	code, _ = post("/internal/v1/auth/refresh", map[string]string{"refresh_token": "ngan"})
	assert.Equal(t, 400, code)
	code, _ = post("/internal/v1/auth/logout", map[string]string{"refresh_token": "ngan"})
	assert.Equal(t, 400, code)
	code, _ = post("/internal/v1/auth/login", map[string]any{"username": "u", "password": "p", "truong_la": 1})
	assert.Contains(t, []int{200, 400, 401}, code, "trường lạ không làm sập")
}

func TestServiceTokens_IssueAndPolicy(t *testing.T) {
	e := newEnv(t)
	issue := func(body map[string]string) *httptest.ResponseRecorder {
		return e.do(t, "POST", "/internal/v1/service-tokens", "", body) // công khai, không cần Bearer
	}

	ok := issue(map[string]string{"service": "gateway", "audience": "surveillance", "client_secret": gatewaySec})
	require.Equal(t, 200, ok.Code, ok.Body.String())
	var got struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		ExpiresIn   int    `json:"expires_in"`
	}
	require.NoError(t, json.Unmarshal(ok.Body.Bytes(), &got))
	assert.Equal(t, "Bearer", got.TokenType)
	assert.Equal(t, 300, got.ExpiresIn)
	sv, _ := authx.NewServiceVerifier(e.keys, issuer, "surveillance")
	id, err := sv.Verify(got.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, "gateway", id.Service)

	for name, body := range map[string]map[string]string{
		"sai bí mật":       {"service": "gateway", "audience": "surveillance", "client_secret": "sai-bi-mat-xxxxxxxxxxxxxxxx"},
		"audience cấm":     {"service": "gateway", "audience": "optimize", "client_secret": gatewaySec},
		"service chưa cấu": {"service": "workflow", "audience": "optimize", "client_secret": gatewaySec},
	} {
		w := issue(body)
		assert.Equal(t, 401, w.Code, name)
		assert.Equal(t, "auth.invalid_service_credentials", decode[problem](t, w).Code, name)
	}
	assert.Equal(t, 400, issue(map[string]string{"service": "gateway", "audience": "surveillance", "client_secret": "ngan"}).Code)
	assert.NotContains(t, e.logs.String(), gatewaySec, "không log client_secret")
}

func TestReadyz_ReportsDependencyFailureWithoutDetail(t *testing.T) {
	e := newEnv(t)
	assert.Equal(t, 200, e.do(t, "GET", "/readyz", "", nil).Code)
	assert.Equal(t, 200, e.do(t, "GET", "/healthz", "", nil).Code)

	e.readyFn = func(context.Context) error {
		return errors.New("dial tcp 10.0.0.5:5432: password authentication failed")
	}
	w := e.do(t, "GET", "/readyz", "", nil)
	require.Equal(t, 503, w.Code)
	assert.Equal(t, "common.dependency_unavailable", decode[problem](t, w).Code)
	assert.NotContains(t, w.Body.String(), "10.0.0.5")
	assert.Equal(t, 200, e.do(t, "GET", "/healthz", "", nil).Code, "healthz không phụ thuộc trạng thái phụ thuộc")
}

func TestUnknownRouteIsProblemJSON(t *testing.T) {
	e := newEnv(t)
	w := e.do(t, "GET", "/internal/v1/khong-co", e.svcTok, nil)
	assert.Equal(t, 404, w.Code)
	assert.Equal(t, "common.not_found", decode[problem](t, w).Code)
}
