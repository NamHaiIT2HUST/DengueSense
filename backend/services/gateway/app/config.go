// Package app dựng gateway: cấu hình và router.
package app

import (
	"log/slog"
	"net"
	"time"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/configx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
)

const (
	envPrefix       = "GATEWAY"
	defaultListen   = ":8080"
	defaultMaxBody  = 1 << 20 // 1 MB (docs/09 §6.7)
	defaultShutdown = 20 * time.Second
	defaultIssuer   = "denguesense-identity"
	defaultAudience = "denguesense-gateway"
)

// Config của gateway (biến môi trường tiền tố GATEWAY_).
type Config struct {
	ListenAddr      string
	LogLevel        slog.Level
	ShutdownTimeout time.Duration
	MaxBodyBytes    int64

	// Khoá xác minh access token lấy từ JWKS của `identity` (làm mới định kỳ, hỗ trợ xoay khoá).
	JWTIssuer   string
	JWTAudience string
	JWKSRefresh time.Duration

	// Service phía sau. ServiceClientSecret là bí mật RIÊNG của gateway để xin token dịch vụ (không log).
	IdentityURL         string
	SurveillanceURL     string
	ForecastURL         string
	WorkflowURL         string
	ServiceClientSecret string
	UpstreamTimeout     time.Duration

	// Cookie refresh: Secure bật mặc định; chỉ tắt khi chạy dev qua http.
	CookieSecure bool

	// Giới hạn đăng nhập/làm mới theo IP: tối đa AuthRateLimit lần mỗi AuthRateWindow.
	AuthRateLimit  int
	AuthRateWindow time.Duration
}

// LoadConfig đọc cấu hình; thiếu/sai biến bắt buộc → lỗi liệt kê đủ tên biến (không lộ giá trị).
func LoadConfig(lookup func(string) (string, bool)) (Config, error) {
	l := configx.NewWithLookup(envPrefix, lookup)
	cfg := Config{
		ListenAddr:      l.String("LISTEN_ADDR", defaultListen),
		ShutdownTimeout: l.Duration("SHUTDOWN_TIMEOUT", defaultShutdown),
		MaxBodyBytes:    int64(l.Int("MAX_BODY_BYTES", defaultMaxBody)),
		JWTIssuer:       l.String("JWT_ISSUER", defaultIssuer),
		JWTAudience:     l.String("JWT_AUDIENCE", defaultAudience),
		JWKSRefresh:     l.Duration("JWKS_REFRESH", 5*time.Minute),

		IdentityURL:         l.RequiredString("IDENTITY_URL"),
		SurveillanceURL:     l.RequiredString("SURVEILLANCE_URL"),
		ForecastURL:         l.RequiredString("FORECAST_URL"),
		WorkflowURL:         l.RequiredString("WORKFLOW_URL"),
		ServiceClientSecret: l.RequiredString("SERVICE_CLIENT_SECRET"),
		UpstreamTimeout:     l.Duration("UPSTREAM_TIMEOUT", 5*time.Second),

		CookieSecure:   l.Bool("COOKIE_SECURE", true),
		AuthRateLimit:  l.Int("AUTH_RATE_LIMIT", 30),
		AuthRateWindow: l.Duration("AUTH_RATE_WINDOW", time.Minute),
	}

	level, err := obsx.ParseLevel(l.String("LOG_LEVEL", "info"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = level

	if err := l.Err(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

// HealthURL trả URL readiness cục bộ cho `gateway -healthcheck` (image distroless không có curl).
func HealthURL(lookup func(string) (string, bool)) string {
	addr := defaultListen
	if v, ok := lookup(envPrefix + "_LISTEN_ADDR"); ok && v != "" {
		addr = v
	}
	_, port, err := net.SplitHostPort(addr)
	if err != nil || port == "" {
		port = "8080"
	}
	return "http://127.0.0.1:" + port + "/readyz"
}
