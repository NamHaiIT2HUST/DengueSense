// Package memory: hiện thực trong bộ nhớ của app.Repository — dùng cho test và chạy thử không cần DB. Phải qua CÙNG bộ
// kiểm hợp đồng `repotest` như bản Postgres.
package memory

import (
	"bytes"
	"context"
	"sort"
	"sync"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/domain"
)

type version struct {
	dv    domain.DataVersion
	panel []byte
	obs   []domain.Observation
}

// Repo là kho trong bộ nhớ, an toàn cho truy cập song song.
type Repo struct {
	mu        sync.Mutex
	provinces map[string]domain.Province
	geometry  map[string][]byte
	geoOrder  []string
	versions  map[string]*version
	// Outbox là các sự kiện đã ghi cùng giao dịch công bố (test kiểm).
	Outbox []eventx.Envelope
}

// New tạo kho rỗng.
func New() *Repo {
	return &Repo{provinces: map[string]domain.Province{}, geometry: map[string][]byte{}, versions: map[string]*version{}}
}

func (r *Repo) UpsertProvinces(_ context.Context, ps []domain.Province) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, p := range ps {
		p.Population = nil
		r.provinces[p.ID] = p
	}
	return nil
}

// latest trả phiên bản mới nhất (published_at rồi tên); gọi khi đã giữ khoá.
func (r *Repo) latest() *version {
	var best *version
	for _, v := range r.versions {
		if best == nil || v.dv.PublishedAt.After(best.dv.PublishedAt) ||
			(v.dv.PublishedAt.Equal(best.dv.PublishedAt) && v.dv.Version > best.dv.Version) {
			best = v
		}
	}
	return best
}

func (r *Repo) population(id string) *int64 {
	v := r.latest()
	if v == nil {
		return nil
	}
	var pop *int64
	last := ""
	for _, o := range v.obs {
		if o.ProvinceID == id && o.Population != nil && o.Month > last {
			last, pop = o.Month, o.Population
		}
	}
	return pop
}

func (r *Repo) ListProvinces(_ context.Context) ([]domain.Province, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]domain.Province, 0, len(r.provinces))
	for _, p := range r.provinces {
		p.Population = r.population(p.ID)
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

func (r *Repo) GetProvince(_ context.Context, id string) (domain.Province, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	p, ok := r.provinces[id]
	if !ok {
		return domain.Province{}, domain.ErrProvinceNotFound
	}
	p.Population = r.population(id)
	return p, nil
}

func (r *Repo) PutGeometry(_ context.Context, ver string, geojson []byte) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if old, ok := r.geometry[ver]; ok {
		if bytes.Equal(old, geojson) {
			return nil
		}
		return domain.ErrGeometryConflict
	}
	r.geometry[ver] = append([]byte(nil), geojson...)
	r.geoOrder = append(r.geoOrder, ver)
	return nil
}

func (r *Repo) GetGeometry(_ context.Context, ver string) (string, []byte, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if ver == "" {
		if len(r.geoOrder) == 0 {
			return "", nil, domain.ErrGeometryNotFound
		}
		ver = r.geoOrder[len(r.geoOrder)-1]
	}
	g, ok := r.geometry[ver]
	if !ok {
		return "", nil, domain.ErrGeometryNotFound
	}
	return ver, append([]byte(nil), g...), nil
}

func (r *Repo) CreateDataVersion(_ context.Context, dv domain.DataVersion, panel []byte, obs []domain.Observation, ev eventx.Envelope) (domain.DataVersion, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if old, ok := r.versions[dv.Version]; ok {
		if old.dv.SHA256 == dv.SHA256 {
			return old.dv, false, nil
		}
		return domain.DataVersion{}, false, domain.ErrDataVersionConflict
	}
	r.versions[dv.Version] = &version{
		dv: dv, panel: append([]byte(nil), panel...), obs: append([]domain.Observation(nil), obs...),
	}
	r.Outbox = append(r.Outbox, ev)
	return dv, true, nil
}

func (r *Repo) ListDataVersions(_ context.Context) ([]domain.DataVersion, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]domain.DataVersion, 0, len(r.versions))
	for _, v := range r.versions {
		out = append(out, v.dv)
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].PublishedAt.Equal(out[j].PublishedAt) {
			return out[i].PublishedAt.After(out[j].PublishedAt)
		}
		return out[i].Version > out[j].Version
	})
	return out, nil
}

func (r *Repo) GetDataVersion(_ context.Context, ver string) (domain.DataVersion, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	v, ok := r.versions[ver]
	if !ok {
		return domain.DataVersion{}, domain.ErrDataVersionNotFound
	}
	return v.dv, nil
}

func (r *Repo) GetPanel(_ context.Context, ver string) ([]byte, string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	v, ok := r.versions[ver]
	if !ok {
		return nil, "", domain.ErrDataVersionNotFound
	}
	return append([]byte(nil), v.panel...), v.dv.SHA256, nil
}

func (r *Repo) ListObservations(_ context.Context, ver, provinceID, from, to string) (string, []domain.Observation, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.provinces[provinceID]; !ok {
		return "", nil, domain.ErrProvinceNotFound
	}
	var v *version
	if ver == "" {
		if v = r.latest(); v == nil {
			return "", nil, domain.ErrDataVersionNotFound
		}
	} else if v = r.versions[ver]; v == nil {
		return "", nil, domain.ErrDataVersionNotFound
	}
	var out []domain.Observation
	for _, o := range v.obs {
		if o.ProvinceID != provinceID || (from != "" && o.Month < from) || (to != "" && o.Month > to) {
			continue
		}
		out = append(out, o)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Month < out[j].Month })
	return v.dv.Version, out, nil
}
