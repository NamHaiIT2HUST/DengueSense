// Package app dựng gateway: cấu hình và router.
package app

import (
	"crypto/ed25519"
	"log/slog"
	"net"
	"time"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
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

	// Khoá công khai Ed25519 để xác minh access token. Đợt 0: nạp tĩnh từ biến môi trường.
	// Đợt 1: thay bằng JWKS lấy từ `identity` (khi service này có).
	JWTPublicKey ed25519.PublicKey
	JWTIssuer    string
	JWTAudience  string
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
	}

	level, err := obsx.ParseLevel(l.String("LOG_LEVEL", "info"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = level

	keyB64 := l.RequiredString("JWT_PUBLIC_KEY")
	if err := l.Err(); err != nil {
		return Config{}, err
	}
	key, err := authx.ParsePublicKey(keyB64)
	if err != nil {
		return Config{}, err // lỗi của ParsePublicKey không chứa giá trị khoá
	}
	cfg.JWTPublicKey = key
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
