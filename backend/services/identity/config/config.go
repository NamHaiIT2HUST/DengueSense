// Package config đọc và kiểm cấu hình của service `identity` từ biến môi trường (tiền tố IDENTITY_).
package config

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/configx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
)

const (
	prefix          = "IDENTITY"
	defaultListen   = ":8081"
	defaultMaxBody  = 1 << 20
	defaultShutdown = 20 * time.Second
	// Audience của token dịch vụ gửi TỚI identity (tên service).
	ServiceAudience = "identity"
)

// KnownServices là các service được phép có client_secret (khớp enum `ServiceTokenRequest.service` của hợp đồng).
var KnownServices = []string{"gateway", "surveillance", "forecast", "optimize", "workflow", "genai", "notification", "ingest-worker"}

// Config đầy đủ để chạy server.
type Config struct {
	ListenAddr      string
	LogLevel        slog.Level
	ShutdownTimeout time.Duration
	MaxBodyBytes    int64
	DatabaseURL     string

	PrivateKey   ed25519.PrivateKey
	KeyID        string
	Issuer       string
	UserAudience string // audience của token NGƯỜI DÙNG (gateway)

	RefreshTTL        time.Duration
	MaxFailedAttempts int
	LockDuration      time.Duration
	// ServiceSecretHashes: SHA-256 (hex trong env) của client_secret từng service. Service không cấu hình thì không xin được token.
	ServiceSecretHashes map[string][sha256.Size]byte
}

// LoadDatabaseURL chỉ đọc DSN (cho `migrate`, không cần khoá ký).
func LoadDatabaseURL(lookup func(string) (string, bool)) (string, error) {
	l := configx.NewWithLookup(prefix, lookup)
	dsn := l.RequiredString("DB_URL")
	return dsn, l.Err()
}

// Load đọc toàn bộ cấu hình; thiếu/sai → lỗi liệt kê TÊN biến (không lộ giá trị).
func Load(lookup func(string) (string, bool)) (Config, error) {
	l := configx.NewWithLookup(prefix, lookup)
	cfg := Config{
		ListenAddr:        l.String("LISTEN_ADDR", defaultListen),
		ShutdownTimeout:   l.Duration("SHUTDOWN_TIMEOUT", defaultShutdown),
		MaxBodyBytes:      int64(l.Int("MAX_BODY_BYTES", defaultMaxBody)),
		DatabaseURL:       l.RequiredString("DB_URL"),
		KeyID:             l.String("JWT_KEY_ID", "k1"),
		Issuer:            l.String("JWT_ISSUER", "denguesense-identity"),
		UserAudience:      l.String("USER_AUDIENCE", "denguesense-gateway"),
		RefreshTTL:        l.Duration("REFRESH_TTL", 7*24*time.Hour),
		MaxFailedAttempts: l.Int("MAX_FAILED_ATTEMPTS", 5),
		LockDuration:      l.Duration("LOCK_DURATION", 15*time.Minute),
	}
	keyB64 := l.RequiredString("JWT_PRIVATE_KEY")

	level, err := obsx.ParseLevel(l.String("LOG_LEVEL", "info"))
	if err != nil {
		return Config{}, err
	}
	cfg.LogLevel = level
	if cfg.MaxFailedAttempts < 1 {
		return Config{}, fmt.Errorf("biến %s_MAX_FAILED_ATTEMPTS phải ≥ 1", prefix)
	}

	cfg.ServiceSecretHashes = make(map[string][sha256.Size]byte)
	for _, svc := range KnownServices {
		key := "SERVICE_SECRET_SHA256_" + strings.ToUpper(strings.ReplaceAll(svc, "-", "_"))
		raw := l.String(key, "")
		if raw == "" {
			continue
		}
		b, err := hex.DecodeString(raw)
		if err != nil || len(b) != sha256.Size {
			return Config{}, fmt.Errorf("biến %s_%s phải là SHA-256 dạng hex (64 ký tự)", prefix, key)
		}
		var h [sha256.Size]byte
		copy(h[:], b)
		cfg.ServiceSecretHashes[svc] = h
	}

	if err := l.Err(); err != nil {
		return Config{}, err
	}
	key, err := authx.ParsePrivateKey(keyB64)
	if err != nil {
		return Config{}, fmt.Errorf("biến %s_JWT_PRIVATE_KEY: %w", prefix, err) // lỗi của ParsePrivateKey không chứa giá trị khoá
	}
	cfg.PrivateKey = key
	return cfg, nil
}

// HashSecret trả SHA-256 (hex) của client_secret — để đặt vào IDENTITY_SERVICE_SECRET_SHA256_<TÊN>.
func HashSecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

// HealthURL trả URL readiness cục bộ cho `identity -healthcheck`.
func HealthURL(lookup func(string) (string, bool)) string {
	addr := defaultListen
	if v, ok := lookup(prefix + "_LISTEN_ADDR"); ok && v != "" {
		addr = v
	}
	port := "8081"
	if i := strings.LastIndex(addr, ":"); i >= 0 && i+1 < len(addr) {
		port = addr[i+1:]
	}
	return "http://127.0.0.1:" + port + "/readyz"
}
