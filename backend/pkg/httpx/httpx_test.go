package httpx_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
)

func newTestEngine(t *testing.T) (*gin.Engine, *bytes.Buffer) {
	t.Helper()
	var buf bytes.Buffer
	log := obsx.NewLogger(&buf, "test", "v", slog.LevelDebug)
	return httpx.NewEngine(log, 1<<10), &buf
}

func do(r http.Handler, method, path string, body string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func problemOf(t *testing.T, w *httptest.ResponseRecorder) httpx.Problem {
	t.Helper()
	assert.Equal(t, "application/problem+json", w.Header().Get("Content-Type"))
	var p httpx.Problem
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &p))
	return p
}

func TestRequestID_GeneratesOrAcceptsSafeValue(t *testing.T) {
	r, _ := newTestEngine(t)
	r.GET("/x", func(c *gin.Context) { c.String(200, obsx.RequestID(c.Request.Context())) })

	w := do(r, "GET", "/x", "", nil)
	generated := w.Header().Get(httpx.HeaderRequestID)
	assert.Len(t, generated, 36, "UUID được sinh khi client không gửi")
	assert.Equal(t, generated, w.Body.String(), "context và header phải cùng mã")

	w = do(r, "GET", "/x", "", map[string]string{httpx.HeaderRequestID: "client-req-0001"})
	assert.Equal(t, "client-req-0001", w.Header().Get(httpx.HeaderRequestID))

	for _, bad := range []string{"short", "has space in it 123", "inject\nline-12345", strings.Repeat("a", 65)} {
		w = do(r, "GET", "/x", "", map[string]string{httpx.HeaderRequestID: bad})
		got := w.Header().Get(httpx.HeaderRequestID)
		assert.NotEqual(t, bad, got, "mã không an toàn phải bị thay: %q", bad)
		assert.Len(t, got, 36)
	}
}

func TestProblem_ShapeAndNoInternalLeak(t *testing.T) {
	r, _ := newTestEngine(t)
	r.GET("/bad", func(c *gin.Context) {
		httpx.WriteProblem(c, httpx.ValidationError("sai đầu vào", httpx.FieldError{Field: "horizon", Message: "phải thuộc {1,2,3,6}"}))
	})

	w := do(r, "GET", "/bad", "", map[string]string{httpx.HeaderRequestID: "req-abcdef12"})
	require.Equal(t, http.StatusBadRequest, w.Code)
	p := problemOf(t, w)
	assert.Equal(t, "common.validation_error", p.Code)
	assert.Equal(t, "https://denguesense.vn/errors/validation-error", p.Type)
	assert.Equal(t, 400, p.Status)
	assert.Equal(t, "req-abcdef12", p.RequestID)
	assert.Equal(t, "/bad", p.Instance)
	require.Len(t, p.Errors, 1)
	assert.Equal(t, "horizon", p.Errors[0].Field)
}

func TestAsError_UnknownErrorBecomesInternalWithoutDetail(t *testing.T) {
	e := httpx.AsError(errors.New("pq: password authentication failed for user svc_x"))
	assert.Equal(t, http.StatusInternalServerError, e.Status)
	assert.Equal(t, "common.internal_error", e.Code)
	assert.NotContains(t, e.Detail+e.Title, "password")

	want := httpx.NotFound("x")
	assert.Same(t, want, httpx.AsError(want))
}

func TestRecover_PanicBecomes500WithoutLeakingAndIsLogged(t *testing.T) {
	r, logs := newTestEngine(t)
	r.GET("/boom", func(*gin.Context) { panic("bí mật nội bộ: mật khẩu=abc") })

	w := do(r, "GET", "/boom", "", nil)
	require.Equal(t, 500, w.Code)
	p := problemOf(t, w)
	assert.Equal(t, "common.internal_error", p.Code)
	assert.NotContains(t, w.Body.String(), "bí mật", "thân phản hồi không được lộ nội dung panic")
	assert.Contains(t, logs.String(), "bí mật nội bộ", "chi tiết panic phải nằm trong log")
	assert.Contains(t, logs.String(), "stack")
}

func TestNotFoundAndMethodNotAllowedAreProblemJSON(t *testing.T) {
	r, _ := newTestEngine(t)
	r.GET("/only-get", func(c *gin.Context) { c.Status(204) })

	w := do(r, "GET", "/khong-co", "", nil)
	require.Equal(t, 404, w.Code)
	assert.Equal(t, "common.not_found", problemOf(t, w).Code)

	w = do(r, "POST", "/only-get", "", nil)
	require.Equal(t, 405, w.Code)
	assert.Equal(t, "common.method_not_allowed", problemOf(t, w).Code)
}

func TestSecurityHeaders_DefaultsAndOverridable(t *testing.T) {
	r, _ := newTestEngine(t)
	r.GET("/a", func(c *gin.Context) { c.Status(200) })
	r.GET("/b", func(c *gin.Context) {
		c.Header("Cache-Control", "public, max-age=31536000, immutable")
		c.Status(200)
	})

	w := do(r, "GET", "/a", "", nil)
	assert.Equal(t, "nosniff", w.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "no-store", w.Header().Get("Cache-Control"))
	assert.Equal(t, "no-referrer", w.Header().Get("Referrer-Policy"))

	w = do(r, "GET", "/b", "", nil)
	assert.Contains(t, w.Header().Get("Cache-Control"), "immutable", "endpoint bất biến phải ghi đè được")
}

func TestMaxBody_RejectsOversizedBody(t *testing.T) {
	r, _ := newTestEngine(t) // giới hạn 1 KiB
	r.POST("/echo", func(c *gin.Context) {
		if _, err := c.GetRawData(); err != nil {
			httpx.WriteProblem(c, httpx.ValidationError("thân request quá lớn"))
			return
		}
		c.Status(204)
	})
	assert.Equal(t, 204, do(r, "POST", "/echo", strings.Repeat("a", 100), nil).Code)
	assert.Equal(t, 400, do(r, "POST", "/echo", strings.Repeat("a", 5000), nil).Code)
}

func TestAccessLog_FieldsLevelsAndNoQueryString(t *testing.T) {
	r, logs := newTestEngine(t)
	httpx.RegisterHealth(r, nil)
	r.GET("/items/:id", func(c *gin.Context) { c.Status(200) })

	do(r, "GET", "/items/42?token=SECRET", "", nil)
	do(r, "GET", "/nope", "", nil)
	do(r, "GET", "/healthz", "", nil)

	var lines []map[string]any
	for _, ln := range bytes.Split(bytes.TrimSpace(logs.Bytes()), []byte("\n")) {
		var m map[string]any
		require.NoError(t, json.Unmarshal(ln, &m))
		lines = append(lines, m)
	}
	require.Len(t, lines, 3)
	assert.Equal(t, "/items/:id", lines[0]["route"], "log mẫu route, không log id thô")
	assert.Equal(t, "INFO", lines[0]["level"])
	assert.NotEmpty(t, lines[0]["request_id"])
	assert.Equal(t, "unmatched", lines[1]["route"])
	assert.Equal(t, "WARN", lines[1]["level"])
	assert.Equal(t, "DEBUG", lines[2]["level"], "health check ở mức debug")
	assert.NotContains(t, logs.String(), "SECRET", "không được log query string")
}

func TestHealthAndReadiness(t *testing.T) {
	r, _ := newTestEngine(t)
	var ready error
	httpx.RegisterHealth(r, func(context.Context) error { return ready })

	assert.Equal(t, 200, do(r, "GET", "/healthz", "", nil).Code)
	assert.Equal(t, 200, do(r, "GET", "/readyz", "", nil).Code)

	ready = errors.New("dial tcp 10.0.0.5:5432: connection refused")
	w := do(r, "GET", "/readyz", "", nil)
	require.Equal(t, 503, w.Code)
	assert.Equal(t, "common.dependency_unavailable", problemOf(t, w).Code)
	assert.NotContains(t, w.Body.String(), "10.0.0.5", "không lộ địa chỉ phụ thuộc")
	assert.Equal(t, 200, do(r, "GET", "/healthz", "", nil).Code, "healthz không phụ thuộc trạng thái phụ thuộc")
}

func TestContextWithFallback_GinContextReadsRequestContext(t *testing.T) {
	r, _ := newTestEngine(t)
	var seen string
	r.GET("/x", func(c *gin.Context) {
		var ctx context.Context = c // như strict handler của oapi-codegen truyền vào
		seen = obsx.RequestID(ctx)
	})
	do(r, "GET", "/x", "", map[string]string{httpx.HeaderRequestID: "req-fallback-1"})
	assert.Equal(t, "req-fallback-1", seen)
}

func TestTrimBearer(t *testing.T) {
	tok, ok := httpx.TrimBearer("Bearer abc.def.ghi")
	assert.True(t, ok)
	assert.Equal(t, "abc.def.ghi", tok)
	tok, ok = httpx.TrimBearer("bearer   xyz ")
	assert.True(t, ok)
	assert.Equal(t, "xyz", tok)
	for _, bad := range []string{"", "Bearer", "Bearer ", "Basic abc", "abc"} {
		_, ok = httpx.TrimBearer(bad)
		assert.False(t, ok, bad)
	}
}

func TestServe_GracefulShutdownLetsInFlightRequestFinish(t *testing.T) {
	r, _ := newTestEngine(t)
	started := make(chan struct{})
	r.GET("/slow", func(c *gin.Context) {
		close(started)
		time.Sleep(300 * time.Millisecond)
		c.String(200, "xong")
	})
	log := obsx.NewLogger(&bytes.Buffer{}, "t", "v", slog.LevelInfo)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- httpx.Serve(ctx, ln, r, 5*time.Second, log) }()

	type result struct {
		body string
		err  error
	}
	resCh := make(chan result, 1)
	go func() {
		resp, err := http.Get("http://" + ln.Addr().String() + "/slow")
		if err != nil {
			resCh <- result{err: err}
			return
		}
		defer func() { _ = resp.Body.Close() }()
		var b bytes.Buffer
		_, _ = b.ReadFrom(resp.Body)
		resCh <- result{body: b.String()}
	}()

	<-started
	cancel() // SIGTERM giả lập khi request còn đang xử lý

	res := <-resCh
	require.NoError(t, res.err)
	assert.Equal(t, "xong", res.body, "request đang xử lý phải được hoàn tất")
	require.NoError(t, <-done, "tắt êm phải trả nil")

	resp, err := http.Get("http://" + ln.Addr().String() + "/healthz")
	if err == nil {
		_ = resp.Body.Close()
	}
	assert.Error(t, err, "sau khi tắt không còn nhận kết nối mới")
}

func TestHealthcheckMain(t *testing.T) {
	r, _ := newTestEngine(t)
	httpx.RegisterHealth(r, func(context.Context) error { return nil })
	ok := httptest.NewServer(r)
	defer ok.Close()
	assert.Equal(t, 0, httpx.HealthcheckMain(ok.URL+"/readyz"))
	assert.Equal(t, 1, httpx.HealthcheckMain(ok.URL+"/khong-co"))

	dead := httptest.NewServer(r)
	url := dead.URL
	dead.Close()
	assert.Equal(t, 1, httpx.HealthcheckMain(url+"/healthz"))
}

// Mọi mã lỗi mà httpx phát ra PHẢI có trong danh mục contracts/errors.md (nguồn sự thật).
func TestEveryHttpxErrorCodeIsInCatalog(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "contracts", "errors.md"))
	require.NoError(t, err)
	catalog := string(raw)

	for _, e := range []*httpx.Error{
		httpx.ValidationError("x"), httpx.Unauthenticated("x"), httpx.Forbidden("x"), httpx.NotFound("x"),
		httpx.MethodNotAllowed(), httpx.NotImplemented(), httpx.Internal(), httpx.DependencyUnavailable(),
	} {
		assert.Contains(t, catalog, "| `"+e.Code+"` | "+strconv.Itoa(e.Status)+" |",
			"mã %s (HTTP %d) thiếu hoặc lệch trạng thái trong contracts/errors.md", e.Code, e.Status)
	}
}
