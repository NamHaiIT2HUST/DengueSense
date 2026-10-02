package configx_test

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/configx"
)

func env(m map[string]string) func(string) (string, bool) {
	return func(k string) (string, bool) { v, ok := m[k]; return v, ok }
}

func TestLoader_ReadsValuesAndDefaults(t *testing.T) {
	l := configx.NewWithLookup("SVC", env(map[string]string{
		"SVC_ADDR":     " :9090 ",
		"SVC_PORTS":    "3",
		"SVC_TIMEOUT":  "15s",
		"SVC_FEATURE":  "true",
		"SVC_REQUIRED": "x",
	}))

	assert.Equal(t, ":9090", l.String("ADDR", ":8080"), "phải cắt khoảng trắng")
	assert.Equal(t, "fallback", l.String("MISSING", "fallback"))
	assert.Equal(t, 3, l.Int("PORTS", 1))
	assert.Equal(t, 7, l.Int("NOPE", 7))
	assert.Equal(t, 15*time.Second, l.Duration("TIMEOUT", time.Second))
	assert.True(t, l.Bool("FEATURE", false))
	assert.Equal(t, "x", l.RequiredString("REQUIRED"))
	require.NoError(t, l.Err())
}

func TestLoader_MissingRequiredIsReportedTogether(t *testing.T) {
	l := configx.NewWithLookup("GW", env(map[string]string{"GW_EMPTY": "   "}))
	_ = l.RequiredString("A")
	_ = l.RequiredString("EMPTY") // rỗng coi như thiếu
	err := l.Err()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "GW_A")
	assert.Contains(t, err.Error(), "GW_EMPTY")
}

func TestLoader_InvalidValuesFailWithoutLeakingTheValue(t *testing.T) {
	secret := "s3cr3t-value"
	l := configx.NewWithLookup("GW", env(map[string]string{
		"GW_N": secret, "GW_D": secret, "GW_B": secret,
	}))
	l.Int("N", 1)
	l.Duration("D", time.Second)
	l.Bool("B", false)
	err := l.Err()
	require.Error(t, err)
	assert.False(t, strings.Contains(err.Error(), secret), "thông báo lỗi không được chứa giá trị cấu hình")
	for _, name := range []string{"GW_N", "GW_D", "GW_B"} {
		assert.Contains(t, err.Error(), name)
	}
}

func TestLoader_DurationMustBePositive(t *testing.T) {
	l := configx.NewWithLookup("GW", env(map[string]string{"GW_D": "-5s"}))
	l.Duration("D", time.Second)
	require.Error(t, l.Err())
}
