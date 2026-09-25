// Package config đọc và kiểm cấu hình của service `surveillance` từ biến môi trường (tiền tố SURVEILLANCE_).
package config

import (
	"crypto/ed25519"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/configx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
)

const (
	prefix          = "SURVEILLANCE"
	defaultListen   = ":8082"
	defaultMaxBody  = 34 << 20 // > trần panel 32 MiB + multipart
	defaultShutdown = 20 * time.Second
)

// Config đầy đủ để chạy server.
type Config struct {
	ListenAddr      string
	LogLevel        slog.Level
	ShutdownTimeout time.Duration
	MaxBodyBytes    int64
	DatabaseURL     string

	// Khoá CÔNG KHAI của `identity` để kiểm token dịch vụ (Đợt 1: nạp tĩnh; sau chuyển sang JWKS).
	JWTPublicKey ed25519.PublicKey
	KeyID        string
	Issuer       string
}

// LoadDatabaseURL chỉ đọc DSN (cho `migrate`, `seed`, `import-panel`).
func LoadDatabaseURL(lookup func(string) (string, bool)) (string, error) {
	l := configx.NewWithLookup(prefix, lookup)
	dsn := l.RequiredString("DB_URL")
	return dsn, l.Err()
}

// Load đọc toàn bộ cấu hình; thiếu/sai → lỗi liệt kê TÊN biến (không lộ giá trị).
func Load(lookup func(string) (string, bool)) (Config, error) {
	l := configx.NewWithLookup(prefix, lookup)
	cfg := Config{
		ListenAddr:      l.String("LISTEN_ADDR", defaultListen),
		ShutdownTimeout: l.Duration("SHUTDOWN_TIMEOUT", defaultShutdown),
		MaxBodyBytes:    int64(l.Int("MAX_BODY_BYTES", defaultMaxBody)),
		DatabaseURL:     l.RequiredString("DB_URL"),
		KeyID:           l.String("JWT_KEY_ID", "k1"),
		Issuer:          l.String("JWT_ISSUER", "denguesense-identity"),
	}
	keyB64 := l.RequiredString("JWT_PUBLIC_KEY")
	level, err := obsx.ParseLevel(l.String("LOG_LEVEL", "info"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = level
	if err := l.Err(); err != nil {
		return Config{}, err
	}
	key, err := authx.ParsePublicKey(keyB64)
	if err != nil {
		return Config{}, fmt.Errorf("biến %s_JWT_PUBLIC_KEY: %w", prefix, err)
	}
	cfg.JWTPublicKey = key
	return cfg, nil
}

// HealthURL trả URL readiness cục bộ cho `surveillance -healthcheck`.
func HealthURL(lookup func(string) (string, bool)) string {
	addr := defaultListen
	if v, ok := lookup(prefix + "_LISTEN_ADDR"); ok && v != "" {
		addr = v
	}
	port := "8082"
	if i := strings.LastIndex(addr, ":"); i >= 0 && i+1 < len(addr) {
		port = addr[i+1:]
	}
	return "http://127.0.0.1:" + port + "/readyz"
}
