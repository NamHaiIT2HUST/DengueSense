// Package repotest: bộ kiểm HỢP ĐỒNG cho app.Repository của `surveillance`. Chạy cho MỌI hiện thực (memory, postgres) để
// hai bên không lệch hành vi — đặc biệt các ngữ nghĩa dễ sai: phiên bản dữ liệu BẤT BIẾN, idempotent khi nội dung trùng,
// sự kiện ghi cùng giao dịch, "mới nhất", lọc quan sát.
package repotest

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/domain"
)

// Env là kho cần kiểm cùng cách đếm sự kiện outbox (mỗi hiện thực đọc theo cách riêng).
type Env struct {
	Repo        app.Repository
	OutboxCount func(ctx context.Context) (int, error)
}

var t0 = time.Date(2026, 9, 25, 9, 0, 0, 0, time.UTC)

func provinces() []domain.Province {
	return []domain.Province{
		{ID: "ha_noi", Name: "Hà Nội", Region: domain.RegionBac},
		{ID: "ho_chi_minh", Name: "Hồ Chí Minh", Region: domain.RegionNam},
		{ID: "khanh_hoa", Name: "Khánh Hòa", Region: domain.RegionTrung},
	}
}

func pop(v int64) *int64 { return &v }

func obs(p, m string, cases float64, src domain.DataSource, population *int64) domain.Observation {
	inc := cases / 10
	return domain.Observation{ProvinceID: p, Month: m, Cases: cases, IncidencePer100k: &inc, Source: src, Population: population}
}

func version(name string, at time.Time, sha string) domain.DataVersion {
	return domain.DataVersion{
		Version: name, PublishedAt: at, FirstMonth: "2010-01", LastMonth: "2010-03", RealShare: 0.75,
		NRows: 4, NProvinces: 2, SHA256: sha, KnownIssues: []string{"chỉ để kiểm thử"},
	}
}

func event(v string) eventx.Envelope {
	e, err := eventx.NewAt(t0, "denguesense/surveillance", eventx.TypeDataVersionPublished, 1, v,
		eventx.DataVersionPublished{DataVersion: v, FirstMonth: "2010-01", LastMonth: "2010-03", RealShare: 0.75})
	if err != nil {
		panic(err)
	}
	return e
}

func sha(c byte) string {
	b := make([]byte, 64)
	for i := range b {
		b[i] = c
	}
	return string(b)
}

func testObs() []domain.Observation {
	return []domain.Observation{
		obs("ha_noi", "2010-01", 5, domain.SourceReal, pop(8_000_000)),
		obs("ha_noi", "2010-02", 9, domain.SourceReal, pop(8_100_000)),
		obs("ha_noi", "2010-03", 12, domain.SourceEstimated, nil),
		obs("khanh_hoa", "2010-01", 30, domain.SourceReal, pop(1_200_000)),
	}
}

// Run chạy toàn bộ bộ kiểm; `newEnv` trả kho SẠCH (đã nạp danh mục tỉnh) cho mỗi test con.
func Run(t *testing.T, newEnv func(t *testing.T) Env) {
	seeded := func(t *testing.T) (Env, context.Context) {
		t.Helper()
		e := newEnv(t)
		ctx := context.Background()
		require.NoError(t, e.Repo.UpsertProvinces(ctx, provinces()))
		return e, ctx
	}

	t.Run("danh mục tỉnh: nạp idempotent, sắp theo mã, chưa có dân số khi chưa có dữ liệu", func(t *testing.T) {
		e, ctx := seeded(t)
		require.NoError(t, e.Repo.UpsertProvinces(ctx, provinces()), "nạp lại là no-op")
		ps, err := e.Repo.ListProvinces(ctx)
		require.NoError(t, err)
		require.Len(t, ps, 3)
		assert.Equal(t, []string{"ha_noi", "ho_chi_minh", "khanh_hoa"}, []string{ps[0].ID, ps[1].ID, ps[2].ID})
		assert.Nil(t, ps[0].Population)
		got, err := e.Repo.GetProvince(ctx, "khanh_hoa")
		require.NoError(t, err)
		assert.Equal(t, domain.RegionTrung, got.Region)
		_, err = e.Repo.GetProvince(ctx, "khong_co")
		assert.ErrorIs(t, err, domain.ErrProvinceNotFound)
	})

	t.Run("ranh giới: bất biến theo phiên bản, mới nhất là bản nạp sau cùng", func(t *testing.T) {
		e, ctx := seeded(t)
		_, _, err := e.Repo.GetGeometry(ctx, "")
		assert.ErrorIs(t, err, domain.ErrGeometryNotFound)
		require.NoError(t, e.Repo.PutGeometry(ctx, "2025-07", []byte(`{"type":"FeatureCollection","features":[]}`)))
		require.NoError(t, e.Repo.PutGeometry(ctx, "2025-07", []byte(`{"type":"FeatureCollection","features":[]}`)), "cùng nội dung: no-op")
		assert.ErrorIs(t, e.Repo.PutGeometry(ctx, "2025-07", []byte(`{"type":"FeatureCollection","features":[1]}`)), domain.ErrGeometryConflict)
		require.NoError(t, e.Repo.PutGeometry(ctx, "2026-01", []byte(`{"type":"FeatureCollection","features":[]}`)))
		v, g, err := e.Repo.GetGeometry(ctx, "")
		require.NoError(t, err)
		assert.Equal(t, "2026-01", v)
		assert.JSONEq(t, `{"type":"FeatureCollection","features":[]}`, string(g))
		_, _, err = e.Repo.GetGeometry(ctx, "1999-01")
		assert.ErrorIs(t, err, domain.ErrGeometryNotFound)
	})

	t.Run("phiên bản dữ liệu: công bố, đọc lại nguyên vẹn, sự kiện ghi cùng giao dịch", func(t *testing.T) {
		e, ctx := seeded(t)
		panel := []byte("PAR1-noi-dung-thu")
		stored, created, err := e.Repo.CreateDataVersion(ctx, version("v0.1.0", t0, sha('a')), panel, testObs(), event("v0.1.0"))
		require.NoError(t, err)
		assert.True(t, created)
		assert.Equal(t, "v0.1.0", stored.Version)

		got, err := e.Repo.GetDataVersion(ctx, "v0.1.0")
		require.NoError(t, err)
		assert.Equal(t, sha('a'), got.SHA256)
		assert.Equal(t, 0.75, got.RealShare)
		assert.Equal(t, []string{"chỉ để kiểm thử"}, got.KnownIssues)
		assert.True(t, got.PublishedAt.Equal(t0))

		gotPanel, gotSha, err := e.Repo.GetPanel(ctx, "v0.1.0")
		require.NoError(t, err)
		assert.Equal(t, panel, gotPanel)
		assert.Equal(t, sha('a'), gotSha)

		n, err := e.OutboxCount(ctx)
		require.NoError(t, err)
		assert.Equal(t, 1, n)

		_, err = e.Repo.GetDataVersion(ctx, "v9.9.9")
		assert.ErrorIs(t, err, domain.ErrDataVersionNotFound)
		_, _, err = e.Repo.GetPanel(ctx, "v9.9.9")
		assert.ErrorIs(t, err, domain.ErrDataVersionNotFound)
	})

	t.Run("BẤT BIẾN: cùng tên + cùng nội dung là idempotent (không phát lại sự kiện); khác nội dung bị từ chối", func(t *testing.T) {
		e, ctx := seeded(t)
		_, _, err := e.Repo.CreateDataVersion(ctx, version("v0.1.0", t0, sha('a')), []byte("x"), testObs(), event("v0.1.0"))
		require.NoError(t, err)

		again, created, err := e.Repo.CreateDataVersion(ctx, version("v0.1.0", t0.Add(time.Hour), sha('a')), []byte("x"), testObs(), event("v0.1.0"))
		require.NoError(t, err)
		assert.False(t, created)
		assert.True(t, again.PublishedAt.Equal(t0), "giữ thời điểm công bố gốc")

		_, _, err = e.Repo.CreateDataVersion(ctx, version("v0.1.0", t0, sha('b')), []byte("y"), testObs(), event("v0.1.0"))
		assert.ErrorIs(t, err, domain.ErrDataVersionConflict)

		n, err := e.OutboxCount(ctx)
		require.NoError(t, err)
		assert.Equal(t, 1, n, "chỉ một sự kiện cho một lần công bố thật")
		_, gotSha, err := e.Repo.GetPanel(ctx, "v0.1.0")
		require.NoError(t, err)
		assert.Equal(t, sha('a'), gotSha, "nội dung gốc không bị đổi")
	})

	t.Run("mới nhất trước; dân số tham chiếu lấy giá trị không-null mới nhất của bản mới nhất", func(t *testing.T) {
		e, ctx := seeded(t)
		_, _, err := e.Repo.CreateDataVersion(ctx, version("v0.1.0", t0, sha('a')), []byte("x"), testObs(), event("v0.1.0"))
		require.NoError(t, err)
		newer := []domain.Observation{obs("ha_noi", "2010-01", 7, domain.SourceReal, pop(9_000_000)), obs("ha_noi", "2010-02", 8, domain.SourceReal, nil)}
		dv := version("v0.2.0", t0.Add(time.Hour), sha('c'))
		dv.NRows, dv.NProvinces = 2, 1
		_, _, err = e.Repo.CreateDataVersion(ctx, dv, []byte("z"), newer, event("v0.2.0"))
		require.NoError(t, err)

		vs, err := e.Repo.ListDataVersions(ctx)
		require.NoError(t, err)
		require.Len(t, vs, 2)
		assert.Equal(t, "v0.2.0", vs[0].Version)

		p, err := e.Repo.GetProvince(ctx, "ha_noi")
		require.NoError(t, err)
		require.NotNil(t, p.Population)
		assert.Equal(t, int64(9_000_000), *p.Population, "tháng 2010-02 của bản mới nhất không có dân số → dùng 2010-01")
		hcm, err := e.Repo.GetProvince(ctx, "ho_chi_minh")
		require.NoError(t, err)
		assert.Nil(t, hcm.Population)
	})

	t.Run("quan sát: lọc theo tỉnh/khoảng tháng, giữ nguồn dữ liệu, mặc định bản mới nhất", func(t *testing.T) {
		e, ctx := seeded(t)
		_, _, err := e.Repo.CreateDataVersion(ctx, version("v0.1.0", t0, sha('a')), []byte("x"), testObs(), event("v0.1.0"))
		require.NoError(t, err)

		v, out, err := e.Repo.ListObservations(ctx, "", "ha_noi", "", "")
		require.NoError(t, err)
		assert.Equal(t, "v0.1.0", v)
		require.Len(t, out, 3)
		assert.Equal(t, []string{"2010-01", "2010-02", "2010-03"}, []string{out[0].Month, out[1].Month, out[2].Month})
		assert.Equal(t, domain.SourceEstimated, out[2].Source, "dữ liệu ước lượng KHÔNG được đổi thành thật")
		assert.Nil(t, out[2].Population)
		require.NotNil(t, out[0].IncidencePer100k)

		_, out, err = e.Repo.ListObservations(ctx, "v0.1.0", "ha_noi", "2010-02", "2010-02")
		require.NoError(t, err)
		require.Len(t, out, 1)
		assert.Equal(t, "2010-02", out[0].Month)

		_, out, err = e.Repo.ListObservations(ctx, "", "ho_chi_minh", "", "")
		require.NoError(t, err)
		assert.Empty(t, out, "tỉnh có trong danh mục nhưng chưa có quan sát → rỗng, không lỗi")

		_, _, err = e.Repo.ListObservations(ctx, "", "khong_co", "", "")
		assert.ErrorIs(t, err, domain.ErrProvinceNotFound)
		_, _, err = e.Repo.ListObservations(ctx, "v9.9.9", "ha_noi", "", "")
		assert.ErrorIs(t, err, domain.ErrDataVersionNotFound)
	})

	t.Run("chưa có phiên bản nào: quan sát báo không tìm thấy phiên bản", func(t *testing.T) {
		e, ctx := seeded(t)
		_, _, err := e.Repo.ListObservations(ctx, "", "ha_noi", "", "")
		assert.ErrorIs(t, err, domain.ErrDataVersionNotFound)
	})

	t.Run("công bố SONG SONG cùng một phiên bản: đúng một lần thành công, còn lại idempotent", func(t *testing.T) {
		e, ctx := seeded(t)
		var wg sync.WaitGroup
		var mu sync.Mutex
		created, errs := 0, 0
		for i := 0; i < 8; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, c, err := e.Repo.CreateDataVersion(ctx, version("v0.3.0", t0, sha('d')), []byte("p"), testObs(), event("v0.3.0"))
				mu.Lock()
				defer mu.Unlock()
				if err != nil {
					errs++
				} else if c {
					created++
				}
			}()
		}
		wg.Wait()
		assert.Equal(t, 0, errs)
		assert.Equal(t, 1, created)
		n, err := e.OutboxCount(ctx)
		require.NoError(t, err)
		assert.Equal(t, 1, n)
	})
}
