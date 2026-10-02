package obsx_test

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
)

func decode(t *testing.T, buf *bytes.Buffer) map[string]any {
	t.Helper()
	var m map[string]any
	require.NoError(t, json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &m))
	return m
}

func TestLogger_EmitsRequiredFields(t *testing.T) {
	var buf bytes.Buffer
	log := obsx.NewLogger(&buf, "gateway", "abc1234", slog.LevelInfo)
	log.Info("xin chào")

	m := decode(t, &buf)
	assert.Equal(t, "xin chào", m["msg"])
	assert.Equal(t, "INFO", m["level"])
	assert.Equal(t, "gateway", m["service"])
	assert.Equal(t, "abc1234", m["version"])
	assert.Contains(t, m, "ts", "khoá thời gian phải là ts")
	assert.NotContains(t, m, "time")
	assert.NotContains(t, m, "request_id")
}

func TestLogger_AddsRequestIDFromContext(t *testing.T) {
	var buf bytes.Buffer
	log := obsx.NewLogger(&buf, "gateway", "v", slog.LevelInfo)
	ctx := obsx.WithRequestID(context.Background(), "req-12345678")

	log.InfoContext(ctx, "có ngữ cảnh")
	assert.Equal(t, "req-12345678", decode(t, &buf)["request_id"])

	buf.Reset()
	log.With("k", "v").WithGroup("g").InfoContext(ctx, "nhóm")
	assert.Equal(t, "req-12345678", decode(t, &buf)["g"].(map[string]any)["request_id"],
		"WithAttrs/WithGroup không được làm mất request_id")
}

func TestLogger_RespectsLevel(t *testing.T) {
	var buf bytes.Buffer
	log := obsx.NewLogger(&buf, "s", "v", slog.LevelWarn)
	log.Info("bị lọc")
	assert.Zero(t, buf.Len())
	log.Warn("qua")
	assert.NotZero(t, buf.Len())
}

func TestParseLevel(t *testing.T) {
	for in, want := range map[string]slog.Level{
		"": slog.LevelInfo, "INFO": slog.LevelInfo, "debug": slog.LevelDebug,
		" warn ": slog.LevelWarn, "warning": slog.LevelWarn, "error": slog.LevelError,
	} {
		got, err := obsx.ParseLevel(in)
		require.NoError(t, err, in)
		assert.Equal(t, want, got, in)
	}
	_, err := obsx.ParseLevel("verbose")
	assert.Error(t, err)
}

func TestRequestID_EmptyWhenUnset(t *testing.T) {
	assert.Equal(t, "", obsx.RequestID(context.Background()))
}
