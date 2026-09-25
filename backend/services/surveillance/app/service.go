// Package app: use case của `surveillance`. Điều phối domain và repository; không biết HTTP/SQL.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/domain"
)

// Repository là cổng lưu trữ (Postgres, bộ nhớ). Mọi hiện thực phải qua bộ kiểm `repotest`.
type Repository interface {
	// UpsertProvinces nạp/cập nhật danh mục tỉnh (dữ liệu tham chiếu, idempotent).
	UpsertProvinces(ctx context.Context, ps []domain.Province) error
	// ListProvinces trả danh mục kèm dân số tham chiếu (giá trị không-null mới nhất của phiên bản dữ liệu mới nhất).
	ListProvinces(ctx context.Context) ([]domain.Province, error)
	GetProvince(ctx context.Context, id string) (domain.Province, error)

	// PutGeometry lưu ranh giới theo phiên bản, BẤT BIẾN: cùng version + cùng nội dung → no-op; khác nội dung → lỗi.
	PutGeometry(ctx context.Context, version string, geojson []byte) error
	// GetGeometry trả (phiên bản, GeoJSON); version rỗng = mới nhất. ErrGeometryNotFound nếu không có.
	GetGeometry(ctx context.Context, version string) (string, []byte, error)

	// CreateDataVersion lưu phiên bản + panel + quan sát + sự kiện (outbox) trong MỘT giao dịch.
	// created=false khi phiên bản đã có với CÙNG sha256 (idempotent, không phát lại sự kiện);
	// ErrDataVersionConflict khi đã có với sha256 khác.
	CreateDataVersion(ctx context.Context, dv domain.DataVersion, panel []byte, obs []domain.Observation, ev eventx.Envelope) (stored domain.DataVersion, created bool, err error)
	ListDataVersions(ctx context.Context) ([]domain.DataVersion, error) // mới nhất trước
	GetDataVersion(ctx context.Context, version string) (domain.DataVersion, error)
	GetPanel(ctx context.Context, version string) (panel []byte, sha256hex string, err error)
	// ListObservations: version rỗng = mới nhất; from/to rỗng = không giới hạn. Trả phiên bản đã dùng.
	// Tỉnh không tồn tại → ErrProvinceNotFound; phiên bản không có → ErrDataVersionNotFound.
	ListObservations(ctx context.Context, version, provinceID, from, to string) (string, []domain.Observation, error)
}

// Service là các use case.
type Service struct {
	repo  Repository
	clock func() time.Time
	log   *slog.Logger
}

// New tạo Service. `clock` nil → time.Now.
func New(repo Repository, clock func() time.Time, log *slog.Logger) *Service {
	if clock == nil {
		clock = time.Now
	}
	if log == nil {
		log = slog.Default()
	}
	return &Service{repo: repo, clock: clock, log: log}
}

func (s *Service) Provinces(ctx context.Context) ([]domain.Province, error) {
	return s.repo.ListProvinces(ctx)
}

func (s *Service) Province(ctx context.Context, id string) (domain.Province, error) {
	return s.repo.GetProvince(ctx, id)
}

func (s *Service) Geometry(ctx context.Context, version string) (string, []byte, error) {
	return s.repo.GetGeometry(ctx, version)
}

func (s *Service) DataVersions(ctx context.Context) ([]domain.DataVersion, error) {
	return s.repo.ListDataVersions(ctx)
}

func (s *Service) DataVersion(ctx context.Context, version string) (domain.DataVersion, error) {
	return s.repo.GetDataVersion(ctx, version)
}

func (s *Service) Panel(ctx context.Context, version string) ([]byte, string, error) {
	return s.repo.GetPanel(ctx, version)
}

// Observations trả chuỗi quan sát của một tỉnh. Khoảng tháng sai định dạng/đảo ngược là lỗi đầu vào.
func (s *Service) Observations(ctx context.Context, version, provinceID, from, to string) (string, []domain.Observation, error) {
	if from != "" && !domain.ValidYearMonth(from) || to != "" && !domain.ValidYearMonth(to) {
		return "", nil, &domain.InvalidPanelError{Problems: []string{"from/to phải có dạng YYYY-MM"}}
	}
	if from != "" && to != "" && from > to {
		return "", nil, &domain.InvalidPanelError{Problems: []string{"from không được sau to"}}
	}
	return s.repo.ListObservations(ctx, version, provinceID, from, to)
}

// PublishResult là kết quả công bố phiên bản dữ liệu.
type PublishResult struct {
	DataVersion domain.DataVersion
	// Created=false: phiên bản đã có với đúng nội dung này (gọi lại an toàn).
	Created bool
}

// PublishDataVersion đọc, kiểm và công bố một panel. Phiên bản BẤT BIẾN: trùng tên khác nội dung → ErrDataVersionConflict.
func (s *Service) PublishDataVersion(ctx context.Context, panel []byte, m domain.Manifest) (PublishResult, error) {
	obs, err := domain.ParsePanel(panel)
	if err != nil {
		return PublishResult{}, err
	}
	provs, err := s.repo.ListProvinces(ctx)
	if err != nil {
		return PublishResult{}, err
	}
	known := make(map[string]struct{}, len(provs))
	for _, p := range provs {
		known[p.ID] = struct{}{}
	}
	dv, err := domain.ValidatePanel(panel, obs, m, func(id string) bool { _, ok := known[id]; return ok })
	if err != nil {
		return PublishResult{}, err
	}
	dv.PublishedAt = s.clock().UTC()
	domain.SortObservations(obs)

	ev, err := eventx.NewAt(dv.PublishedAt, "denguesense/surveillance", eventx.TypeDataVersionPublished, 1, dv.Version,
		eventx.DataVersionPublished{DataVersion: dv.Version, FirstMonth: dv.FirstMonth, LastMonth: dv.LastMonth, RealShare: dv.RealShare})
	if err != nil {
		return PublishResult{}, fmt.Errorf("dựng sự kiện: %w", err)
	}
	stored, created, err := s.repo.CreateDataVersion(ctx, dv, panel, obs, ev)
	if errors.Is(err, domain.ErrDataVersionConflict) {
		return PublishResult{}, err
	}
	if err != nil {
		return PublishResult{}, fmt.Errorf("lưu phiên bản dữ liệu: %w", err)
	}
	if created {
		s.log.InfoContext(ctx, "đã công bố phiên bản dữ liệu", "data_version", stored.Version, "n_rows", stored.NRows, "real_share", stored.RealShare)
	}
	return PublishResult{DataVersion: stored, Created: created}, nil
}

// ImportPanel công bố một panel nội bộ: dựng manifest từ nội dung rồi đi qua ĐÚNG đường kiểm/công bố của
// PublishDataVersion (không có đường tắt bỏ qua kiểm tra). Dùng bởi lệnh `import-panel` của CLI.
func (s *Service) ImportPanel(ctx context.Context, version string, panel []byte, knownIssues []string) (PublishResult, error) {
	obs, err := domain.ParsePanel(panel)
	if err != nil {
		return PublishResult{}, err
	}
	return s.PublishDataVersion(ctx, panel, domain.BuildManifest(version, panel, obs, knownIssues))
}

// SeedProvinces nạp danh mục tỉnh và (tuỳ chọn) ranh giới. Idempotent; ranh giới bất biến theo phiên bản.
func (s *Service) SeedProvinces(ctx context.Context, ps []domain.Province) error {
	for _, p := range ps {
		if !domain.ValidProvinceID(p.ID) || p.Name == "" || !p.Region.Valid() {
			return fmt.Errorf("tỉnh không hợp lệ: %q", p.ID)
		}
	}
	return s.repo.UpsertProvinces(ctx, ps)
}

// SeedGeometry nạp ranh giới một phiên bản.
func (s *Service) SeedGeometry(ctx context.Context, version string, geojson []byte) error {
	return s.repo.PutGeometry(ctx, version, geojson)
}
