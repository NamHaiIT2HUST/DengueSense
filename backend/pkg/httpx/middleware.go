package httpx

import (
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"runtime/debug"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
)

// HeaderRequestID là tên header truyền mã yêu cầu qua mọi service (docs/09 §6.8).
const HeaderRequestID = "X-Request-ID"

// Chỉ chấp nhận mã do client gửi nếu an toàn để ghi vào log/header (chống chèn dòng log).
var validRequestID = regexp.MustCompile(`^[A-Za-z0-9._-]{8,64}$`)

// RequestID gắn mã yêu cầu (dùng mã đến nếu hợp lệ, không thì sinh UUIDv7) vào context và header phản hồi.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(HeaderRequestID)
		if !validRequestID.MatchString(id) {
			id = uuid.Must(uuid.NewV7()).String()
		}
		c.Header(HeaderRequestID, id)
		c.Request = c.Request.WithContext(obsx.WithRequestID(c.Request.Context(), id))
		c.Next()
	}
}

// SecurityHeaders đặt header bảo mật cơ bản; `Cache-Control: no-store` là mặc định an toàn cho API
// có xác thực — endpoint dữ liệu bất biến (vd GeoJSON theo version) tự ghi đè.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Cache-Control", "no-store")
		c.Next()
	}
}

// MaxBody giới hạn kích thước thân request (docs/09 §6.7).
func MaxBody(limit int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}

// AccessLog ghi 1 dòng log mỗi request. Không ghi query string, header, thân request.
// /healthz và /readyz ở mức debug để không làm ngập log.
func AccessLog(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		route := c.FullPath()
		if route == "" {
			route = "unmatched" // tránh bùng nổ nhãn khi bị dò đường dẫn
		}
		status := c.Writer.Status()
		level := slog.LevelInfo
		switch {
		case route == "/healthz" || route == "/readyz":
			level = slog.LevelDebug
		case status >= http.StatusInternalServerError:
			level = slog.LevelError
		case status >= http.StatusBadRequest:
			level = slog.LevelWarn
		}
		log.LogAttrs(c.Request.Context(), level, "http_request",
			slog.String("method", c.Request.Method),
			slog.String("route", route),
			slog.Int("status", status),
			slog.Int64("duration_ms", time.Since(start).Milliseconds()),
			slog.Int("bytes", c.Writer.Size()),
		)
	}
}

// Recover biến panic thành 500 problem+json; chi tiết + stack chỉ ghi vào log, không trả cho client.
func Recover(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				if r == http.ErrAbortHandler { //nolint:errorlint // sentinel do net/http định nghĩa để dừng handler
					panic(r)
				}
				log.ErrorContext(c.Request.Context(), "panic",
					slog.String("panic", fmt.Sprint(r)),
					slog.String("stack", string(debug.Stack())),
				)
				WriteProblem(c, Internal())
			}
		}()
		c.Next()
	}
}

// NotFoundHandler / MethodNotAllowedHandler trả problem+json thay cho thân mặc định của gin.
func NotFoundHandler() gin.HandlerFunc {
	return func(c *gin.Context) { WriteProblem(c, NotFound("đường dẫn không tồn tại")) }
}

func MethodNotAllowedHandler() gin.HandlerFunc {
	return func(c *gin.Context) { WriteProblem(c, MethodNotAllowed()) }
}

// NewEngine dựng gin.Engine với chuỗi middleware chuẩn của mọi service Go.
// `ContextWithFallback` để *gin.Context truyền như context.Context vẫn đọc được giá trị trong
// request context (request_id, actor) — cần cho strict handler sinh từ oapi-codegen.
func NewEngine(log *slog.Logger, maxBody int64) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.ContextWithFallback = true
	r.HandleMethodNotAllowed = true
	r.RemoveExtraSlash = false
	r.NoRoute(NotFoundHandler())
	r.NoMethod(MethodNotAllowedHandler())
	r.Use(RequestID(), SecurityHeaders(), AccessLog(log), Recover(log), MaxBody(maxBody))
	return r
}

// TrimBearer tách token khỏi header `Authorization: Bearer <token>`.
func TrimBearer(header string) (string, bool) {
	scheme, token, found := strings.Cut(strings.TrimSpace(header), " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	token = strings.TrimSpace(token)
	return token, token != ""
}
