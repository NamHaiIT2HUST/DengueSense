package app_test

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/app"
)

func lookup(m map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) { v, ok := m[k]; return v, ok }
}

func TestLoadConfig_DefaultsAndOverrides(t *testing.T) {
	pub, _, err := authx.GenerateKeyPair()
	require.NoError(t, err)

	cfg, err := app.LoadConfig(lookup(map[string]string{"GATEWAY_JWT_PUBLIC_KEY": authx.EncodeKey(pub)}))
	require.NoError(t, err)
	assert.Equal(t, ":8080", cfg.ListenAddr)
	assert.Equal(t, 20*time.Second, cfg.ShutdownTimeout)
	assert.EqualValues(t, 1<<20, cfg.MaxBodyBytes)
	assert.Equal(t, "denguesense-identity", cfg.JWTIssuer)
	assert.True(t, pub.Equal(cfg.JWTPublicKey))

	cfg, err = app.LoadConfig(lookup(map[string]string{
		"GATEWAY_JWT_PUBLIC_KEY": authx.EncodeKey(pub),
		"GATEWAY_LISTEN_ADDR":    ":9999",
		"GATEWAY_LOG_LEVEL":      "debug",
	}))
	require.NoError(t, err)
	assert.Equal(t, ":9999", cfg.ListenAddr)
}

func TestLoadConfig_FailsFastWhenKeyMissingOrInvalid(t *testing.T) {
	_, err := app.LoadConfig(lookup(nil))
	require.Error(t, err, "không có khoá xác thực thì không được khởi động (không mặc định tắt xác thực)")
	assert.Contains(t, err.Error(), "GATEWAY_JWT_PUBLIC_KEY")

	_, err = app.LoadConfig(lookup(map[string]string{"GATEWAY_JWT_PUBLIC_KEY": "MAT-KHAU-KHONG-PHAI-KHOA"}))
	require.Error(t, err)
	assert.False(t, strings.Contains(err.Error(), "MAT-KHAU"), "lỗi không được chứa giá trị cấu hình")
}

func TestLoadConfig_RejectsBadLogLevel(t *testing.T) {
	pub, _, _ := authx.GenerateKeyPair()
	_, err := app.LoadConfig(lookup(map[string]string{
		"GATEWAY_JWT_PUBLIC_KEY": authx.EncodeKey(pub), "GATEWAY_LOG_LEVEL": "verbose",
	}))
	assert.Error(t, err)
}

func TestHealthURL(t *testing.T) {
	assert.Equal(t, "http://127.0.0.1:8080/readyz", app.HealthURL(lookup(nil)))
	assert.Equal(t, "http://127.0.0.1:9090/readyz", app.HealthURL(lookup(map[string]string{"GATEWAY_LISTEN_ADDR": "0.0.0.0:9090"})))
	assert.Equal(t, "http://127.0.0.1:7000/readyz", app.HealthURL(lookup(map[string]string{"GATEWAY_LISTEN_ADDR": ":7000"})))
	assert.Equal(t, "http://127.0.0.1:8080/readyz", app.HealthURL(lookup(map[string]string{"GATEWAY_LISTEN_ADDR": "hong"})))
}
