package app_test

import (
	"bytes"
	"crypto/ed25519"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/handler"
)

const (
	iss = "denguesense-identity"
	aud = "denguesense-gateway"
)

var contractPath = filepath.Join("..", "..", "..", "..", "contracts", "openapi", "public-v1.yaml")

type operation struct {
	method, path, id string
	public           bool // `security: []` ở cấp operation
}

// loadOperations đọc TRỰC TIẾP hợp đồng — nguồn sự thật — để test không lệch khỏi nó.
func loadOperations(t *testing.T) []operation {
	t.Helper()
	raw, err := os.ReadFile(contractPath)
	require.NoError(t, err)
	var spec struct {
		Paths map[string]map[string]yaml.Node `yaml:"paths"`
	}
	require.NoError(t, yaml.Unmarshal(raw, &spec))

	var ops []operation
	for path, methods := range spec.Paths {
		for method, node := range methods {
			if !isHTTPMethod(method) {
				continue
			}
			var op struct {
				OperationID string       `yaml:"operationId"`
				Security    *[]yaml.Node `yaml:"security"`
			}
			require.NoError(t, node.Decode(&op))
			ops = append(ops, operation{
				method: strings.ToUpper(method),
				path:   path,
				id:     op.OperationID,
				public: op.Security != nil && len(*op.Security) == 0,
			})
		}
	}
	sort.Slice(ops, func(i, j int) bool { return ops[i].method+ops[i].path < ops[j].method+ops[j].path })
	require.GreaterOrEqual(t, len(ops), 19, "phải đọc được đủ các operation của hợp đồng")
	return ops
}

func isHTTPMethod(m string) bool {
	switch strings.ToLower(m) {
	case "get", "post", "put", "patch", "delete":
		return true
	}
	return false
}

var pathParam = regexp.MustCompile(`\{[^}]+\}`)

// concretePath thay {tham_số} bằng giá trị mẫu để gọi được route.
func concretePath(path string) string {
	return app.BasePath + pathParam.ReplaceAllString(path, "0192f3a1-0000-7000-8000-000000000001")
}

type fixture struct {
	router http.Handler
	signer *authx.Ed25519Signer
	logs   *bytes.Buffer
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	pub, priv, err := authx.GenerateKeyPair()
	require.NoError(t, err)
	return fixtureWith(t, pub, priv, handler.NotImplemented{})
}

func fixtureWith(t *testing.T, pub ed25519.PublicKey, priv ed25519.PrivateKey, srv handlerServer) fixture {
	t.Helper()
	v, err := authx.NewEd25519Verifier(pub, iss, aud)
	require.NoError(t, err)
	s, err := authx.NewEd25519Signer(priv, iss, aud)
	require.NoError(t, err)
	var logs bytes.Buffer
	router := app.NewRouter(app.Deps{
		Log:      obsx.NewLogger(&logs, "gateway", "test", slog.LevelDebug),
		Verifier: v,
		Server:   srv,
		MaxBody:  1 << 20,
	})
	return fixture{router: router, signer: s, logs: &logs}
}

func (f fixture) token(t *testing.T, roles ...authx.Role) string {
	t.Helper()
	tok, err := f.signer.Sign(authx.Actor{ID: "u1", Roles: roles, OrgID: "cdc-hcm"})
	require.NoError(t, err)
	return tok
}

func (f fixture) do(method, path, bearer, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	f.router.ServeHTTP(w, req)
	return w
}

func problem(t *testing.T, w *httptest.ResponseRecorder) httpx.Problem {
	t.Helper()
	assert.Equal(t, "application/problem+json", w.Header().Get("Content-Type"))
	var p httpx.Problem
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &p))
	return p
}

// ---------- Hợp đồng ↔ code ----------

func TestPublicRoutes_MatchContract(t *testing.T) {
	var fromContract []string
	for _, op := range loadOperations(t) {
		if op.public {
			fromContract = append(fromContract, op.method+" "+app.BasePath+op.path)
		}
	}
	sort.Strings(fromContract)
	require.NotEmpty(t, fromContract)

	// Mọi route công khai trong hợp đồng phải được code miễn xác thực …
	for _, key := range fromContract {
		method, path, _ := strings.Cut(key, " ")
		assert.True(t, app.IsPublic(method, path), "hợp đồng đánh dấu công khai nhưng code chưa miễn: %s", key)
	}
	// … và code không được miễn thêm route nào ngoài hợp đồng.
	assert.Equal(t, []string{"POST /api/v1/auth/login", "POST /api/v1/auth/refresh"}, fromContract,
		"tập route công khai thay đổi: rà soát bảo mật rồi cập nhật cả hợp đồng lẫn publicRoutes")
}

func TestEveryContractOperation_FailClosed(t *testing.T) {
	f := newFixture(t)
	viewer := f.token(t, authx.RoleViewer)

	for _, op := range loadOperations(t) {
		path := concretePath(op.path)
		t.Run(op.method+" "+op.path, func(t *testing.T) {
			noToken := f.do(op.method, path, "", "")
			withToken := f.do(op.method, path, viewer, "{}")

			assert.NotEqual(t, http.StatusNotFound, noToken.Code, "route phải được đăng ký (không 404)")
			assert.NotEqual(t, http.StatusMethodNotAllowed, noToken.Code)
			if op.public {
				assert.NotEqual(t, http.StatusUnauthorized, noToken.Code, "route công khai không đòi token")
				return
			}
			require.Equal(t, http.StatusUnauthorized, noToken.Code, "route bảo vệ PHẢI 401 khi thiếu token")
			assert.Equal(t, "common.unauthenticated", problem(t, noToken).Code)
			assert.Contains(t, noToken.Header().Get("WWW-Authenticate"), "Bearer")

			assert.Equal(t, http.StatusUnauthorized, f.do(op.method, path, "token.rac.rưởi", "").Code)

			// Có token hợp lệ: qua được xác thực (không 401/403); Đợt 0 chưa hiện thực nên 501 hoặc 400 (thiếu tham số).
			assert.Contains(t, []int{http.StatusNotImplemented, http.StatusBadRequest}, withToken.Code)
		})
	}
}

func TestNotImplemented_IsProblemJSONWithStableCode(t *testing.T) {
	f := newFixture(t)
	w := f.do("GET", app.BasePath+"/provinces", f.token(t, authx.RoleViewer), "")
	require.Equal(t, http.StatusNotImplemented, w.Code)
	p := problem(t, w)
	assert.Equal(t, "common.not_implemented", p.Code)
	assert.Equal(t, http.StatusNotImplemented, p.Status)
	assert.NotEmpty(t, p.RequestID)
	assert.Equal(t, w.Header().Get(httpx.HeaderRequestID), p.RequestID, "request_id phản hồi khớp header")
}

func TestRequiredQueryParamMissingIsValidationProblem(t *testing.T) {
	f := newFixture(t)
	// /risk-map bắt buộc `horizon` (hợp đồng): thiếu ⇒ 400 problem+json, không tới handler.
	w := f.do("GET", app.BasePath+"/risk-map", f.token(t, authx.RoleViewer), "")
	require.Equal(t, http.StatusBadRequest, w.Code)
	assert.Equal(t, "common.validation_error", problem(t, w).Code)

	// horizon ngoài enum {1,2,3,6} — mã sinh chỉ kiểm kiểu; kiểm giá trị là việc của handler thật (Đợt 1).
	w = f.do("GET", app.BasePath+"/risk-map?horizon=abc", f.token(t, authx.RoleViewer), "")
	require.Equal(t, http.StatusBadRequest, w.Code, "sai kiểu tham số phải 400")
}

func TestMalformedJSONBodyIsValidationProblemWithoutLeak(t *testing.T) {
	f := newFixture(t)
	w := f.do("POST", app.BasePath+"/auth/login", "", `{"username": "a", "password": `)
	require.Equal(t, http.StatusBadRequest, w.Code)
	p := problem(t, w)
	assert.Equal(t, "common.validation_error", p.Code)
	assert.NotContains(t, w.Body.String(), "unexpected", "không lộ thông báo của bộ giải mã JSON")
}

func TestUnknownRoutesAndMethods(t *testing.T) {
	f := newFixture(t)
	w := f.do("GET", app.BasePath+"/khong-co", f.token(t, authx.RoleAdmin), "")
	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Equal(t, "common.not_found", problem(t, w).Code)

	w = f.do("DELETE", app.BasePath+"/provinces", f.token(t, authx.RoleAdmin), "")
	assert.Equal(t, http.StatusMethodNotAllowed, w.Code)
	assert.Equal(t, "common.method_not_allowed", problem(t, w).Code)
}

func TestHealthEndpointsAreOutsideAuth(t *testing.T) {
	f := newFixture(t)
	assert.Equal(t, http.StatusOK, f.do("GET", "/healthz", "", "").Code)
	assert.Equal(t, http.StatusOK, f.do("GET", "/readyz", "", "").Code)
}

func TestTokenSignedByAnotherKeyIsRejected(t *testing.T) {
	f := newFixture(t)
	_, otherPriv, _ := authx.GenerateKeyPair()
	other, _ := authx.NewEd25519Signer(otherPriv, iss, aud)
	tok, err := other.Sign(authx.Actor{ID: "attacker", Roles: []authx.Role{authx.RoleAdmin}})
	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, f.do("GET", app.BasePath+"/me", tok, "").Code)
}

func TestExpiredTokenIsRejected(t *testing.T) {
	pub, priv, _ := authx.GenerateKeyPair()
	f := fixtureWith(t, pub, priv, handler.NotImplemented{})
	old, _ := authx.NewEd25519Signer(priv, iss, aud)
	tok, err := old.WithClock(func() time.Time { return time.Now().Add(-time.Hour) }).
		Sign(authx.Actor{ID: "u", Roles: []authx.Role{authx.RoleViewer}})
	require.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, f.do("GET", app.BasePath+"/me", tok, "").Code)
}

// ---------- Actor xuống tới handler ----------

type spyServer struct {
	handler.NotImplemented
	sawActor authx.Actor
	sawOK    bool
}

// GetMe kiểm Actor (từ token) và request_id đi xuống tới handler qua context.
func (s *spyServer) GetMe(ctx contextT, _ getMeReq) (getMeResp, error) {
	s.sawActor, s.sawOK = authx.ActorFrom(ctx)
	return nil, authx.RequireRoles(ctx, authx.RoleApprover) // viewer → 403
}

func TestActorReachesHandlerAndRequireRolesForbids(t *testing.T) {
	pub, priv, _ := authx.GenerateKeyPair()
	spy := &spyServer{}
	f := fixtureWith(t, pub, priv, spy)

	w := f.do("GET", app.BasePath+"/me", f.token(t, authx.RoleViewer), "")
	require.True(t, spy.sawOK, "Actor phải có trong context của handler")
	assert.Equal(t, "u1", spy.sawActor.ID)
	assert.Equal(t, "cdc-hcm", spy.sawActor.OrgID)
	require.Equal(t, http.StatusForbidden, w.Code)
	assert.Equal(t, "common.forbidden", problem(t, w).Code)
}

type panicServer struct{ handler.NotImplemented }

func (panicServer) GetMe(contextT, getMeReq) (getMeResp, error) {
	panic("SECRET_DB_PASSWORD=abc")
}

type errServer struct{ handler.NotImplemented }

func (errServer) GetMe(contextT, getMeReq) (getMeResp, error) {
	return nil, assert.AnError
}

func TestHandlerPanicAndUnknownErrorNeverLeak(t *testing.T) {
	pub, priv, _ := authx.GenerateKeyPair()

	f := fixtureWith(t, pub, priv, panicServer{})
	w := f.do("GET", app.BasePath+"/me", f.token(t, authx.RoleViewer), "")
	require.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Equal(t, "common.internal_error", problem(t, w).Code)
	assert.NotContains(t, w.Body.String(), "SECRET")

	f = fixtureWith(t, pub, priv, errServer{})
	w = f.do("GET", app.BasePath+"/me", f.token(t, authx.RoleViewer), "")
	require.Equal(t, http.StatusInternalServerError, w.Code)
	assert.NotContains(t, w.Body.String(), assert.AnError.Error(), "nội dung lỗi lạ không được ra ngoài")
	assert.Contains(t, f.logs.String(), assert.AnError.Error(), "nhưng phải nằm trong log")
}
