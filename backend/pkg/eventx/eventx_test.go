package eventx_test

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
)

// Đường dẫn tới hợp đồng sự kiện (nguồn sự thật, dùng chung với test Python).
var eventsDir = filepath.Join("..", "..", "..", "contracts", "events")

func compile(t *testing.T, file string) *jsonschema.Schema {
	t.Helper()
	f, err := os.Open(filepath.Join(eventsDir, file))
	require.NoError(t, err)
	defer func() { _ = f.Close() }()
	doc, err := jsonschema.UnmarshalJSON(f)
	require.NoError(t, err)

	c := jsonschema.NewCompiler()
	c.DefaultDraft(jsonschema.Draft2020)
	c.AssertFormat() // kiểm cả format uuid / date-time
	url := "https://denguesense.vn/contracts/events/" + file
	require.NoError(t, c.AddResource(url, doc))
	sch, err := c.Compile(url)
	require.NoError(t, err)
	return sch
}

func validate(t *testing.T, sch *jsonschema.Schema, v any) error {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	inst, err := jsonschema.UnmarshalJSON(bytes.NewReader(raw))
	require.NoError(t, err)
	return sch.Validate(inst)
}

func completed() eventx.ForecastRunCompleted {
	return eventx.ForecastRunCompleted{
		RunID: uuid.Must(uuid.NewV7()).String(), RunMode: "backtest", OriginMonth: "2010-03",
		ModelVersion: "m4-r2@1.0.0", DataVersion: "v0.2.0", ProvinceCount: 34, Horizons: []int{1, 2, 3, 6},
	}
}

func TestGoTypes_MatchContractSchemas(t *testing.T) {
	cases := map[string]struct {
		file string
		data any
	}{
		eventx.TypeForecastRunCompleted: {"forecast.run.completed.v1.json", completed()},
		eventx.TypeForecastRunFailed: {"forecast.run.failed.v1.json", eventx.ForecastRunFailed{
			RunID: uuid.Must(uuid.NewV7()).String(), RunMode: "live_experimental", OriginMonth: "2026-08", ErrorCode: "forecast.run_failed",
		}},
		eventx.TypeDataVersionPublished: {"surveillance.data_version.published.v1.json", eventx.DataVersionPublished{
			DataVersion: "v0.3.0", FirstMonth: "1994-01", LastMonth: "2025-12", RealShare: 0.727,
		}},
	}
	envSchema := compile(t, "envelope.v1.json")
	for typ, tc := range cases {
		t.Run(typ, func(t *testing.T) {
			require.NoError(t, validate(t, compile(t, tc.file), tc.data), "kiểu Go phải khớp schema data")

			env, err := eventx.New("denguesense/"+typ[:strings.Index(typ, ".")], typ, 1, "run/x", tc.data)
			require.NoError(t, err)
			assert.Equal(t, "contracts/events/"+tc.file, env.DataSchema, "dataschema phải trỏ tới file có thật")
			_, statErr := os.Stat(filepath.Join(eventsDir, tc.file))
			assert.NoError(t, statErr)
			require.NoError(t, validate(t, envSchema, env), "phong bì phải khớp envelope.v1.json")
		})
	}
}

func TestSchemaHasTeeth_InvalidDataIsRejected(t *testing.T) {
	sch := compile(t, "forecast.run.completed.v1.json")
	bad := completed()
	bad.ProvinceCount = 0
	assert.Error(t, validate(t, sch, bad), "province_count=0 vi phạm minimum")

	bad = completed()
	bad.Horizons = []int{4}
	assert.Error(t, validate(t, sch, bad), "horizon 4 không thuộc {1,2,3,6}")

	bad = completed()
	bad.RunID = "khong-phai-uuid"
	assert.Error(t, validate(t, sch, bad), "run_id phải là uuid (AssertFormat bật)")

	bad = completed()
	bad.OriginMonth = "2010-13"
	assert.Error(t, validate(t, sch, bad))
}

func TestNew_ValidatesInputsAndBuildsEnvelope(t *testing.T) {
	at := time.Date(2026, 9, 25, 9, 14, 9, 0, time.FixedZone("ICT", 7*3600))
	env, err := eventx.NewAt(at, "denguesense/forecast", eventx.TypeForecastRunCompleted, 1, "run/abc", completed())
	require.NoError(t, err)

	assert.Equal(t, "1.0", env.SpecVersion)
	_, err = uuid.Parse(env.ID)
	assert.NoError(t, err)
	assert.Equal(t, time.UTC, env.Time.Location(), "thời điểm luôn UTC")
	assert.Equal(t, at.UTC(), env.Time)
	assert.Equal(t, "run/abc", env.Subject)

	e2, _ := eventx.NewAt(at, "denguesense/forecast", eventx.TypeForecastRunCompleted, 1, "", completed())
	assert.NotEqual(t, env.ID, e2.ID, "mỗi sự kiện một ID riêng")

	for name, args := range map[string]struct {
		source, typ string
		ver         int
	}{
		"source lạ":     {"forecast", eventx.TypeForecastRunCompleted, 1},
		"type sai":      {"denguesense/forecast", "ForecastCompleted", 1},
		"type thiếu":    {"denguesense/forecast", "forecast.completed", 1},
		"version 0":     {"denguesense/forecast", eventx.TypeForecastRunCompleted, 0},
		"source hoa":    {"denguesense/Forecast", eventx.TypeForecastRunCompleted, 1},
		"type có dấu -": {"denguesense/forecast", "forecast.run.com-pleted", 1},
	} {
		_, err := eventx.New(args.source, args.typ, args.ver, "", completed())
		assert.Error(t, err, name)
	}
}

func TestEnvelope_RoundTripAndStrictDecode(t *testing.T) {
	env, err := eventx.New("denguesense/forecast", eventx.TypeForecastRunCompleted, 1, "", completed())
	require.NoError(t, err)

	raw, err := json.Marshal(env)
	require.NoError(t, err)
	var back eventx.Envelope
	require.NoError(t, json.Unmarshal(raw, &back))

	var got eventx.ForecastRunCompleted
	require.NoError(t, back.Decode(&got))
	assert.Equal(t, completed().ModelVersion, got.ModelVersion)
	assert.Equal(t, []int{1, 2, 3, 6}, got.Horizons)

	// Trường lạ trong data bị từ chối (đồng nhất additionalProperties=false của schema).
	back.Data = json.RawMessage(`{"run_id":"x","truong_la":1}`)
	assert.Error(t, back.Decode(&got))
}
