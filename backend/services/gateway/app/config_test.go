package app_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/app"
)

func lookup(m map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) { v, ok := m[k]; return v, ok }
}

func baseEnv() map[string]string {
	return map[string]string{
		"GATEWAY_IDENTITY_URL":          "http://identity:8081",
		"GATEWAY_SURVEILLANCE_URL":      "http://surveillance:8082",
		"GATEWAY_FORECAST_URL":          "http://forecast:8001",
		"GATEWAY_WORKFLOW_URL":          "http://workflow:8001",
		"GATEWAY_SERVICE_CLIENT_SECRET": "bi-mat-thu-nghiem-dai-hon-16",
	}
}

func TestLoadConfig_DefaultsAndOverrides(t *testing.T) {
	cfg, err := app.LoadConfig(lookup(baseEnv()))
	require.NoError(t, err)
	assert.Equal(t, ":8080", cfg.ListenAddr)
	assert.Equal(t, 20*time.Second, cfg.ShutdownTimeout)
	assert.EqualValues(t, 1<<20, cfg.MaxBodyBytes)
	assert.Equal(t, "denguesense-identity", cfg.JWTIssuer)
	assert.True(t, cfg.CookieSecure, "cookie Secure phải bật mặc định")
	assert.Equal(t, 30, cfg.AuthRateLimit)

	env := baseEnv()
	env["GATEWAY_LISTEN_ADDR"] = ":9999"
	env["GATEWAY_LOG_LEVEL"] = "debug"
	env["GATEWAY_COOKIE_SECURE"] = "false"
	cfg, err = app.LoadConfig(lookup(env))
	require.NoError(t, err)
	assert.Equal(t, ":9999", cfg.ListenAddr)
	assert.False(t, cfg.CookieSecure)
}

func TestLoadConfig_FailsFastListingEveryMissingVariable(t *testing.T) {
	_, err := app.LoadConfig(lookup(nil))
	require.Error(t, err, "thiếu cấu hình thì không được khởi động (không mặc định tắt xác thực)")
	for _, name := range []string{"GATEWAY_IDENTITY_URL", "GATEWAY_SURVEILLANCE_URL", "GATEWAY_FORECAST_URL", "GATEWAY_SERVICE_CLIENT_SECRET"} {
		assert.Contains(t, err.Error(), name)
	}
}

func TestLoadConfig_RejectsBadLogLevel(t *testing.T) {
	env := baseEnv()
	env["GATEWAY_LOG_LEVEL"] = "verbose"
	_, err := app.LoadConfig(lookup(env))
	assert.Error(t, err)
}

func TestHealthURL(t *testing.T) {
	assert.Equal(t, "http://127.0.0.1:8080/readyz", app.HealthURL(lookup(nil)))
	assert.Equal(t, "http://127.0.0.1:9090/readyz", app.HealthURL(lookup(map[string]string{"GATEWAY_LISTEN_ADDR": "0.0.0.0:9090"})))
	assert.Equal(t, "http://127.0.0.1:7000/readyz", app.HealthURL(lookup(map[string]string{"GATEWAY_LISTEN_ADDR": ":7000"})))
	assert.Equal(t, "http://127.0.0.1:8080/readyz", app.HealthURL(lookup(map[string]string{"GATEWAY_LISTEN_ADDR": "hong"})))
}
