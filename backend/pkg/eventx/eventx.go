// Package eventx: phong bì sự kiện CloudEvents 1.0 và kiểu dữ liệu của các sự kiện Go cần đọc/ghi
// (docs/09 §7, ADR-0003). Nguồn sự thật của schema là contracts/events/*.json — test của package này
// kiểm kiểu Go khớp schema.
//
// Phạm vi Đợt 0: phong bì + kiểu dữ liệu. Outbox relay và inbox (cần DB) được thêm cùng service đầu
// tiên dùng chúng (Đợt 1) — không viết trước khi có nơi chạy thật để kiểm.
package eventx

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
)

// SpecVersion là phiên bản CloudEvents dùng chung.
const SpecVersion = "1.0"

// Tên sự kiện (`type`, cũng là subject NATS): <service>.<thực_thể>.<động_từ_quá_khứ>.
const (
	TypeForecastRunCompleted = "forecast.run.completed"
	TypeForecastRunFailed    = "forecast.run.failed"
	TypeDataVersionPublished = "surveillance.data_version.published"
)

var (
	typePattern   = regexp.MustCompile(`^[a-z]+(\.[a-z_]+){2,}$`)
	sourcePattern = regexp.MustCompile(`^denguesense/[a-z]+$`)
)

// Envelope là phong bì mọi sự kiện (khớp contracts/events/envelope.v1.json).
type Envelope struct {
	SpecVersion string          `json:"specversion"`
	ID          string          `json:"id"`
	Source      string          `json:"source"`
	Type        string          `json:"type"`
	DataSchema  string          `json:"dataschema"`
	Time        time.Time       `json:"time"`
	Subject     string          `json:"subject,omitempty"`
	TraceParent string          `json:"traceparent,omitempty"`
	Data        json.RawMessage `json:"data"`
}

// New tạo phong bì tại thời điểm hiện tại. `version` là phiên bản schema của `type` (bắt đầu từ 1).
func New(source, eventType string, version int, subject string, data any) (Envelope, error) {
	return NewAt(time.Now(), source, eventType, version, subject, data)
}

// NewAt như New nhưng chỉ định thời điểm (test, phát lại).
func NewAt(at time.Time, source, eventType string, version int, subject string, data any) (Envelope, error) {
	if !sourcePattern.MatchString(source) {
		return Envelope{}, fmt.Errorf("source %q không hợp lệ (dạng denguesense/<service>)", source)
	}
	if !typePattern.MatchString(eventType) {
		return Envelope{}, fmt.Errorf("type %q không hợp lệ (dạng <service>.<thực_thể>.<động_từ_quá_khứ>)", eventType)
	}
	if version < 1 {
		return Envelope{}, errors.New("version schema phải ≥ 1")
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return Envelope{}, fmt.Errorf("mã hoá data: %w", err)
	}
	return Envelope{
		SpecVersion: SpecVersion,
		ID:          uuid.Must(uuid.NewV7()).String(),
		Source:      source,
		Type:        eventType,
		DataSchema:  fmt.Sprintf("contracts/events/%s.v%d.json", eventType, version),
		Time:        at.UTC(),
		Subject:     subject,
		Data:        raw,
	}, nil
}

// Decode giải mã `data` vào `out`, từ chối trường lạ (đồng nhất với additionalProperties=false của schema).
func (e Envelope) Decode(out any) error {
	dec := json.NewDecoder(bytes.NewReader(e.Data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(out); err != nil {
		return fmt.Errorf("giải mã data của %s: %w", e.Type, err)
	}
	return nil
}

// ForecastRunCompleted là `data` của forecast.run.completed (schema v1).
type ForecastRunCompleted struct {
	RunID         string `json:"run_id"`
	RunMode       string `json:"run_mode"`
	OriginMonth   string `json:"origin_month"`
	ModelVersion  string `json:"model_version"`
	DataVersion   string `json:"data_version"`
	ProvinceCount int    `json:"province_count"`
	Horizons      []int  `json:"horizons"`
}

// ForecastRunFailed là `data` của forecast.run.failed (schema v1).
type ForecastRunFailed struct {
	RunID       string `json:"run_id"`
	RunMode     string `json:"run_mode"`
	OriginMonth string `json:"origin_month"`
	ErrorCode   string `json:"error_code"`
}

// DataVersionPublished là `data` của surveillance.data_version.published (schema v1).
type DataVersionPublished struct {
	DataVersion string  `json:"data_version"`
	FirstMonth  string  `json:"first_month"`
	LastMonth   string  `json:"last_month"`
	RealShare   float64 `json:"real_share"`
}
