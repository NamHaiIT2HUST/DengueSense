// Package obsx: log có cấu trúc (JSON, 1 dòng / sự kiện) và ngữ cảnh yêu cầu (docs/09 §13.1).
//
// Trường bắt buộc mỗi dòng log: ts, level, msg, service, version; thêm request_id khi log kèm context
// đã gắn WithRequestID. KHÔNG bao giờ log token, mật khẩu, khoá, toàn văn dự thảo.
package obsx

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
)

type ctxKey struct{}

// WithRequestID gắn mã yêu cầu vào context.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, ctxKey{}, id)
}

// RequestID lấy mã yêu cầu từ context ("" nếu chưa có).
func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(ctxKey{}).(string)
	return id
}

// ParseLevel đổi chuỗi cấu hình thành mức log.
func ParseLevel(s string) (slog.Level, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return slog.LevelDebug, nil
	case "", "info":
		return slog.LevelInfo, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return slog.LevelInfo, fmt.Errorf("mức log không hợp lệ (debug|info|warn|error)")
	}
}

// contextHandler tự thêm request_id từ context vào mỗi bản ghi.
type contextHandler struct{ slog.Handler }

func (h contextHandler) Handle(ctx context.Context, r slog.Record) error {
	if id := RequestID(ctx); id != "" {
		r.AddAttrs(slog.String("request_id", id))
	}
	return h.Handler.Handle(ctx, r)
}

func (h contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return contextHandler{h.Handler.WithAttrs(attrs)}
}

func (h contextHandler) WithGroup(name string) slog.Handler {
	return contextHandler{h.Handler.WithGroup(name)}
}

// NewLogger tạo logger JSON: khoá thời gian là "ts", luôn kèm service và version (git sha).
func NewLogger(w io.Writer, service, version string, level slog.Level) *slog.Logger {
	h := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level: level,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if len(groups) == 0 && a.Key == slog.TimeKey {
				a.Key = "ts"
			}
			return a
		},
	})
	return slog.New(contextHandler{h}).With("service", service, "version", version)
}
