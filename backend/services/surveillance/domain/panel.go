package domain

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/parquet-go/parquet-go"
)

const (
	maxProblems     = 20
	realShareEps    = 1e-6
	maxPanelRows    = 200_000 // trần chống tệp khổng lồ; panel thật ~9,3 nghìn dòng
	maxIncidenceCap = 1e6
)

var requiredColumns = []string{"province_id", "month", "cases", "data_source"}

// panelRecord là các cột của panel mà `surveillance` dùng (cột khí hậu/ONI dành cho `forecast`, đọc thẳng từ file).
type panelRecord struct {
	ProvinceID       string    `parquet:"province_id"`
	Month            time.Time `parquet:"month,timestamp(microsecond)"`
	Cases            float64   `parquet:"cases"`
	DataSource       string    `parquet:"data_source"`
	Population       *int64    `parquet:"population,optional"`
	IncidencePer100k *float64  `parquet:"incidence_per_100k,optional"`
}

// SHA256Hex là SHA-256 (hex) của nội dung.
func SHA256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// ParsePanel đọc file Parquet thành quan sát. Thiếu cột bắt buộc/sai kiểu → InvalidPanelError.
func ParsePanel(panel []byte) ([]Observation, error) {
	// Thiếu cột KHÔNG làm parquet-go báo lỗi mà điền giá trị 0 — nguy hiểm (thiếu `cases` → toàn số ca bằng 0). Nên kiểm
	// cột bắt buộc TRƯỚC khi đọc.
	file, err := parquet.OpenFile(bytes.NewReader(panel), int64(len(panel)))
	if err != nil {
		return nil, &InvalidPanelError{Problems: []string{"không đọc được file Parquet"}}
	}
	have := map[string]bool{}
	for _, f := range file.Schema().Fields() {
		have[f.Name()] = true
	}
	var missing []string
	for _, c := range requiredColumns {
		if !have[c] {
			missing = append(missing, c)
		}
	}
	if len(missing) > 0 {
		return nil, &InvalidPanelError{Problems: []string{fmt.Sprintf("thiếu cột bắt buộc: %v", missing)}}
	}
	recs, err := parquet.Read[panelRecord](bytes.NewReader(panel), int64(len(panel)))
	if err != nil {
		return nil, &InvalidPanelError{Problems: []string{"không đọc được file Parquet hoặc thiếu cột bắt buộc " +
			"(province_id, month, cases, data_source)"}}
	}
	if len(recs) > maxPanelRows {
		return nil, &InvalidPanelError{Problems: []string{fmt.Sprintf("quá %d dòng", maxPanelRows)}}
	}
	out := make([]Observation, len(recs))
	for i, r := range recs {
		m := r.Month.UTC()
		out[i] = Observation{
			ProvinceID:       r.ProvinceID,
			Month:            fmt.Sprintf("%04d-%02d", m.Year(), int(m.Month())),
			Cases:            r.Cases,
			IncidencePer100k: r.IncidencePer100k,
			Source:           DataSource(r.DataSource),
			Population:       r.Population,
		}
	}
	return out, nil
}

type problems []string

func (p *problems) add(format string, a ...any) {
	if len(*p) < maxProblems {
		*p = append(*p, fmt.Sprintf(format, a...))
	}
}

// ValidatePanel kiểm nội dung panel VÀ đối chiếu với manifest; trả DataVersion (chưa có PublishedAt) nếu hợp lệ.
//
// Kiểm: sha256 khớp; tên phiên bản đúng dạng; mọi tỉnh thuộc danh mục; tháng hợp lệ; không trùng (tỉnh, tháng);
// số ca hữu hạn ≥ 0; nguồn dữ liệu hợp lệ; số dòng/số tỉnh/khoảng tháng/tỉ lệ dữ liệu thật khớp manifest.
// (Không đòi tháng liên tục: panel thật có tỉnh thiếu tháng — điều đó được ghi trong `known_issues`, không bị giấu.)
func ValidatePanel(panel []byte, obs []Observation, m Manifest, knownProvince func(string) bool) (DataVersion, error) {
	var p problems
	if !ValidVersion(m.Version) {
		p.add("version phải có dạng vX.Y.Z")
	}
	if !sha256RE.MatchString(m.SHA256) {
		p.add("sha256 trong manifest phải là 64 ký tự hex")
	} else if got := SHA256Hex(panel); got != m.SHA256 {
		p.add("sha256 của file không khớp manifest")
	}
	if len(obs) == 0 {
		p.add("panel không có dòng nào")
	}

	type key struct{ p, m string }
	seen := make(map[key]struct{}, len(obs))
	provinces := map[string]struct{}{}
	first, last := "", ""
	real := 0
	for i, o := range obs {
		switch {
		case !ValidProvinceID(o.ProvinceID) || !knownProvince(o.ProvinceID):
			p.add("dòng %d: tỉnh %q không thuộc danh mục 34 tỉnh", i, o.ProvinceID)
		case !ValidYearMonth(o.Month):
			p.add("dòng %d: tháng %q không hợp lệ", i, o.Month)
		}
		if _, dup := seen[key{o.ProvinceID, o.Month}]; dup {
			p.add("dòng %d: trùng (tỉnh %s, tháng %s)", i, o.ProvinceID, o.Month)
		}
		seen[key{o.ProvinceID, o.Month}] = struct{}{}
		provinces[o.ProvinceID] = struct{}{}
		if math.IsNaN(o.Cases) || math.IsInf(o.Cases, 0) || o.Cases < 0 {
			p.add("dòng %d: số ca phải hữu hạn và ≥ 0", i)
		}
		if o.IncidencePer100k != nil {
			v := *o.IncidencePer100k
			if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 || v > maxIncidenceCap {
				p.add("dòng %d: tỉ suất ca không hợp lệ", i)
			}
		}
		if !o.Source.Valid() {
			p.add("dòng %d: data_source %q không hợp lệ", i, o.Source)
		}
		if o.Source == SourceReal {
			real++
		}
		if first == "" || o.Month < first {
			first = o.Month
		}
		if o.Month > last {
			last = o.Month
		}
	}

	share := 0.0
	if len(obs) > 0 {
		share = float64(real) / float64(len(obs))
	}
	if m.NRows != len(obs) {
		p.add("manifest.n_rows=%d nhưng panel có %d dòng", m.NRows, len(obs))
	}
	if m.NProvinces != len(provinces) {
		p.add("manifest.n_provinces=%d nhưng panel có %d tỉnh", m.NProvinces, len(provinces))
	}
	if m.FirstMonth != first || m.LastMonth != last {
		p.add("manifest khai khoảng tháng %s..%s nhưng panel là %s..%s", m.FirstMonth, m.LastMonth, first, last)
	}
	if math.Abs(m.RealShare-share) > realShareEps {
		p.add("manifest.real_share=%.6f nhưng panel là %.6f", m.RealShare, share)
	}
	if len(p) > 0 {
		return DataVersion{}, &InvalidPanelError{Problems: p}
	}
	issues := append([]string(nil), m.KnownIssues...)
	return DataVersion{
		Version: m.Version, FirstMonth: first, LastMonth: last, RealShare: share,
		NRows: len(obs), NProvinces: len(provinces), SHA256: m.SHA256, KnownIssues: issues,
	}, nil
}

// SortObservations sắp theo (tỉnh, tháng) — thứ tự ổn định cho lưu trữ và trả về.
func SortObservations(obs []Observation) {
	sort.Slice(obs, func(i, j int) bool {
		if obs[i].ProvinceID != obs[j].ProvinceID {
			return obs[i].ProvinceID < obs[j].ProvinceID
		}
		return obs[i].Month < obs[j].Month
	})
}

// BuildManifest dựng manifest TỪ CHÍNH nội dung panel — dùng cho nhập nội bộ (CLI/ingest-worker) khi file nguồn
// chưa có manifest theo hợp đồng. Số liệu tổng hợp luôn khớp panel; `known_issues` do người nhập khai.
func BuildManifest(version string, panel []byte, obs []Observation, knownIssues []string) Manifest {
	provinces := map[string]struct{}{}
	first, last := "", ""
	real := 0
	for _, o := range obs {
		provinces[o.ProvinceID] = struct{}{}
		if o.Source == SourceReal {
			real++
		}
		if first == "" || o.Month < first {
			first = o.Month
		}
		if o.Month > last {
			last = o.Month
		}
	}
	share := 0.0
	if len(obs) > 0 {
		share = float64(real) / float64(len(obs))
	}
	return Manifest{
		Version: version, NRows: len(obs), NProvinces: len(provinces), FirstMonth: first, LastMonth: last,
		RealShare: share, SHA256: SHA256Hex(panel), KnownIssues: knownIssues,
	}
}
