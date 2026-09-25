// Package domain: thực thể và quy tắc của `surveillance` (danh mục tỉnh, phiên bản dữ liệu bất biến, quan sát theo
// tháng). Không biết HTTP hay SQL (docs/09 §14.2).
package domain

import (
	"errors"
	"regexp"
	"time"
)

// Region là vùng dịch tễ của tỉnh.
type Region string

// Các vùng (khớp enum `Region` của hợp đồng).
const (
	RegionBac   Region = "Bắc"
	RegionTrung Region = "Trung"
	RegionNam   Region = "Nam"
)

// Valid báo vùng có nằm trong enum của hợp đồng.
func (r Region) Valid() bool { return r == RegionBac || r == RegionTrung || r == RegionNam }

// DataSource là nguồn của một dòng dữ liệu (luật T2: không-thật phải phân biệt được).
type DataSource string

// Các nguồn dữ liệu (khớp enum `DataSource` của hợp đồng).
const (
	SourceReal      DataSource = "real"
	SourceEstimated DataSource = "estimated"
	SourceImputed   DataSource = "imputed"
	SourceSimulated DataSource = "simulated"
)

// Valid báo nguồn có nằm trong enum của hợp đồng.
func (s DataSource) Valid() bool {
	switch s {
	case SourceReal, SourceEstimated, SourceImputed, SourceSimulated:
		return true
	}
	return false
}

// Province là một trong 34 tỉnh (danh mục đóng).
type Province struct {
	ID     string
	Name   string
	Region Region
	// Population là dân số tham chiếu (tháng cuối của phiên bản dữ liệu mới nhất); nil nếu chưa có.
	Population *int64
}

// Observation là quan sát một tỉnh trong một tháng.
type Observation struct {
	ProvinceID       string
	Month            string // YYYY-MM
	Cases            float64
	IncidencePer100k *float64
	Source           DataSource
	Population       *int64
}

// DataVersion là một phiên bản panel ĐÃ CÔNG BỐ — bất biến.
type DataVersion struct {
	Version     string
	PublishedAt time.Time
	FirstMonth  string
	LastMonth   string
	RealShare   float64
	NRows       int
	NProvinces  int
	SHA256      string
	KnownIssues []string
}

// Manifest là siêu dữ liệu do bên nhập khai (khớp `PanelManifest` của hợp đồng); được ĐỐI CHIẾU với nội dung panel,
// không tin mù quáng.
type Manifest struct {
	Version     string   `json:"version"`
	NRows       int      `json:"n_rows"`
	NProvinces  int      `json:"n_provinces"`
	FirstMonth  string   `json:"first_month"`
	LastMonth   string   `json:"last_month"`
	RealShare   float64  `json:"real_share"`
	SHA256      string   `json:"sha256"`
	KnownIssues []string `json:"known_issues,omitempty"`
}

// Các lỗi nghiệp vụ; adapter HTTP ánh xạ sang mã lỗi của contracts/errors.md.
var (
	ErrProvinceNotFound    = errors.New("không tìm thấy tỉnh")
	ErrDataVersionNotFound = errors.New("không tìm thấy phiên bản dữ liệu")
	ErrGeometryNotFound    = errors.New("không tìm thấy phiên bản ranh giới")
	// ErrGeometryConflict: phiên bản ranh giới đã tồn tại với nội dung khác (bất biến).
	ErrGeometryConflict = errors.New("phiên bản ranh giới đã tồn tại với nội dung khác")
	// ErrDataVersionConflict: `version` đã tồn tại với NỘI DUNG KHÁC (phiên bản bất biến).
	ErrDataVersionConflict = errors.New("phiên bản dữ liệu đã tồn tại với nội dung khác")
)

// InvalidPanelError: panel/manifest không hợp lệ; `Problems` liệt kê từng lỗi (tối đa maxProblems).
type InvalidPanelError struct{ Problems []string }

func (e *InvalidPanelError) Error() string {
	if len(e.Problems) == 0 {
		return "panel không hợp lệ"
	}
	return "panel không hợp lệ: " + e.Problems[0]
}

var (
	versionRE   = regexp.MustCompile(`^v[0-9]+\.[0-9]+\.[0-9]+$`)
	yearMonthRE = regexp.MustCompile(`^[0-9]{4}-(0[1-9]|1[0-2])$`)
	provinceRE  = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	sha256RE    = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

// ValidVersion báo tên phiên bản dữ liệu hợp lệ (vX.Y.Z).
func ValidVersion(v string) bool { return versionRE.MatchString(v) }

// ValidYearMonth báo tháng hợp lệ (YYYY-MM).
func ValidYearMonth(m string) bool { return yearMonthRE.MatchString(m) }

// ValidProvinceID báo mã tỉnh hợp lệ về định dạng (slug).
func ValidProvinceID(id string) bool { return provinceRE.MatchString(id) }
