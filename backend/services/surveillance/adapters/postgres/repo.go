// Package postgres: hiện thực Postgres của app.Repository `surveillance` (pgx/v5, SQL viết tay; CopyFrom cho nạp lô).
package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/dbx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/eventx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/domain"
)

// Repo là app.Repository trên Postgres.
type Repo struct{ pool *pgxpool.Pool }

// New tạo Repo.
func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

const latestVersionSQL = `(SELECT version FROM data_versions ORDER BY published_at DESC, version DESC LIMIT 1)`

// UpsertProvinces nạp danh mục tỉnh (idempotent).
func (r *Repo) UpsertProvinces(ctx context.Context, ps []domain.Province) error {
	return dbx.InTx(ctx, r.pool, func(tx pgx.Tx) error {
		for _, p := range ps {
			if _, err := tx.Exec(ctx, `INSERT INTO provinces (province_id, name, region) VALUES ($1, $2, $3)
				ON CONFLICT (province_id) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region`,
				p.ID, p.Name, string(p.Region)); err != nil {
				return err
			}
		}
		return nil
	})
}

func scanProvince(row pgx.Row) (domain.Province, error) {
	var p domain.Province
	var region string
	if err := row.Scan(&p.ID, &p.Name, &region, &p.Population); err != nil {
		return domain.Province{}, err
	}
	p.Region = domain.Region(region)
	return p, nil
}

// Dân số tham chiếu: giá trị không-null của THÁNG MỚI NHẤT trong phiên bản dữ liệu mới nhất.
const provinceSQL = `SELECT p.province_id, p.name, p.region,
	(SELECT o.population FROM observations o
	  WHERE o.data_version = ` + latestVersionSQL + ` AND o.province_id = p.province_id AND o.population IS NOT NULL
	  ORDER BY o.month DESC LIMIT 1)
	FROM provinces p`

// ListProvinces trả danh mục sắp theo mã.
func (r *Repo) ListProvinces(ctx context.Context) ([]domain.Province, error) {
	rows, err := r.pool.Query(ctx, provinceSQL+` ORDER BY p.province_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.Province
	for rows.Next() {
		p, err := scanProvince(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// GetProvince tìm một tỉnh.
func (r *Repo) GetProvince(ctx context.Context, id string) (domain.Province, error) {
	p, err := scanProvince(r.pool.QueryRow(ctx, provinceSQL+` WHERE p.province_id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Province{}, domain.ErrProvinceNotFound
	}
	return p, err
}

// PutGeometry lưu ranh giới theo phiên bản (bất biến): cùng nội dung là no-op, khác nội dung → ErrGeometryConflict.
func (r *Repo) PutGeometry(ctx context.Context, version string, geojson []byte) error {
	if !json.Valid(geojson) {
		return errors.New("GeoJSON không hợp lệ")
	}
	return dbx.InTx(ctx, r.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `INSERT INTO geometry_versions (version, geojson) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING`, version, geojson)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 1 {
			return nil
		}
		// jsonb chuẩn hoá (thứ tự khoá/khoảng trắng) nên so sánh bằng phép so jsonb của Postgres.
		var same bool
		if err := tx.QueryRow(ctx, `SELECT geojson = $2::jsonb FROM geometry_versions WHERE version = $1`, version, geojson).Scan(&same); err != nil {
			return err
		}
		if !same {
			return domain.ErrGeometryConflict
		}
		return nil
	})
}

// GetGeometry trả (phiên bản, GeoJSON); version rỗng = bản nạp sau cùng.
func (r *Repo) GetGeometry(ctx context.Context, version string) (string, []byte, error) {
	var (
		v string
		g []byte
	)
	var err error
	if version == "" {
		err = r.pool.QueryRow(ctx, `SELECT version, geojson FROM geometry_versions ORDER BY seq DESC LIMIT 1`).Scan(&v, &g)
	} else {
		err = r.pool.QueryRow(ctx, `SELECT version, geojson FROM geometry_versions WHERE version = $1`, version).Scan(&v, &g)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, domain.ErrGeometryNotFound
	}
	return v, g, err
}

const versionColumns = `version, published_at, first_month, last_month, real_share, n_rows, n_provinces, sha256, known_issues`

func scanVersion(row pgx.Row) (domain.DataVersion, error) {
	var dv domain.DataVersion
	err := row.Scan(&dv.Version, &dv.PublishedAt, &dv.FirstMonth, &dv.LastMonth, &dv.RealShare, &dv.NRows, &dv.NProvinces, &dv.SHA256, &dv.KnownIssues)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.DataVersion{}, domain.ErrDataVersionNotFound
	}
	if dv.KnownIssues == nil {
		dv.KnownIssues = []string{}
	}
	return dv, err
}

// CreateDataVersion công bố phiên bản + panel + quan sát + sự kiện outbox trong MỘT giao dịch.
// Song song cùng `version`: khoá tư vấn theo tên phiên bản để đúng một bên ghi, bên còn lại thấy bản đã có (idempotent).
func (r *Repo) CreateDataVersion(ctx context.Context, dv domain.DataVersion, panel []byte, obs []domain.Observation, ev eventx.Envelope) (domain.DataVersion, bool, error) {
	var (
		stored  domain.DataVersion
		created bool
	)
	err := dbx.InTx(ctx, r.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, "data_version:"+dv.Version); err != nil {
			return err
		}
		existing, err := scanVersion(tx.QueryRow(ctx, `SELECT `+versionColumns+` FROM data_versions WHERE version = $1`, dv.Version))
		switch {
		case err == nil:
			if existing.SHA256 != dv.SHA256 {
				return domain.ErrDataVersionConflict
			}
			stored, created = existing, false
			return nil
		case !errors.Is(err, domain.ErrDataVersionNotFound):
			return err
		}

		if _, err := tx.Exec(ctx, `INSERT INTO data_versions (`+versionColumns+`, panel) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			dv.Version, dv.PublishedAt, dv.FirstMonth, dv.LastMonth, dv.RealShare, dv.NRows, dv.NProvinces, dv.SHA256, dv.KnownIssues, panel); err != nil {
			return err
		}
		rows := make([][]any, len(obs))
		for i, o := range obs {
			rows[i] = []any{dv.Version, o.ProvinceID, o.Month, o.Cases, o.IncidencePer100k, string(o.Source), o.Population}
		}
		if _, err := tx.CopyFrom(ctx, pgx.Identifier{"observations"},
			[]string{"data_version", "province_id", "month", "cases", "incidence_per_100k", "data_source", "population"},
			pgx.CopyFromRows(rows)); err != nil {
			return fmt.Errorf("nạp quan sát: %w", err)
		}
		payload, err := json.Marshal(ev)
		if err != nil {
			return err
		}
		id, err := uuid.Parse(ev.ID)
		if err != nil {
			return fmt.Errorf("id sự kiện: %w", err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO outbox (id, event_type, payload) VALUES ($1, $2, $3::jsonb)`, id, ev.Type, payload); err != nil {
			return err
		}
		stored, created = dv, true
		return nil
	})
	if err != nil {
		return domain.DataVersion{}, false, err
	}
	stored.PublishedAt = stored.PublishedAt.UTC()
	return stored, created, nil
}

// ListDataVersions trả mọi phiên bản, mới nhất trước.
func (r *Repo) ListDataVersions(ctx context.Context) ([]domain.DataVersion, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+versionColumns+` FROM data_versions ORDER BY published_at DESC, version DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.DataVersion
	for rows.Next() {
		dv, err := scanVersion(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, dv)
	}
	return out, rows.Err()
}

// GetDataVersion đọc một phiên bản.
func (r *Repo) GetDataVersion(ctx context.Context, version string) (domain.DataVersion, error) {
	return scanVersion(r.pool.QueryRow(ctx, `SELECT `+versionColumns+` FROM data_versions WHERE version = $1`, version))
}

// GetPanel trả file Parquet gốc và sha256 của nó.
func (r *Repo) GetPanel(ctx context.Context, version string) ([]byte, string, error) {
	var (
		b   []byte
		sum string
	)
	err := r.pool.QueryRow(ctx, `SELECT panel, sha256 FROM data_versions WHERE version = $1`, version).Scan(&b, &sum)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", domain.ErrDataVersionNotFound
	}
	return b, sum, err
}

// ListObservations trả chuỗi quan sát của một tỉnh, sắp theo tháng.
func (r *Repo) ListObservations(ctx context.Context, version, provinceID, from, to string) (string, []domain.Observation, error) {
	var exists bool
	if err := r.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM provinces WHERE province_id = $1)`, provinceID).Scan(&exists); err != nil {
		return "", nil, err
	}
	if !exists {
		return "", nil, domain.ErrProvinceNotFound
	}
	if version == "" {
		err := r.pool.QueryRow(ctx, `SELECT `+latestVersionSQL).Scan(&version)
		if errors.Is(err, pgx.ErrNoRows) || version == "" {
			return "", nil, domain.ErrDataVersionNotFound
		}
		if err != nil {
			return "", nil, err
		}
	} else {
		if err := r.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM data_versions WHERE version = $1)`, version).Scan(&exists); err != nil {
			return "", nil, err
		}
		if !exists {
			return "", nil, domain.ErrDataVersionNotFound
		}
	}
	rows, err := r.pool.Query(ctx, `SELECT province_id, month, cases, incidence_per_100k, data_source, population FROM observations
		WHERE data_version = $1 AND province_id = $2 AND ($3 = '' OR month >= $3) AND ($4 = '' OR month <= $4) ORDER BY month`,
		version, provinceID, from, to)
	if err != nil {
		return "", nil, err
	}
	defer rows.Close()
	var out []domain.Observation
	for rows.Next() {
		var (
			o   domain.Observation
			src string
		)
		if err := rows.Scan(&o.ProvinceID, &o.Month, &o.Cases, &o.IncidencePer100k, &src, &o.Population); err != nil {
			return "", nil, err
		}
		o.Source = domain.DataSource(src)
		out = append(out, o)
	}
	return version, out, rows.Err()
}

// OutboxCount đếm sự kiện outbox (test/vận hành).
func (r *Repo) OutboxCount(ctx context.Context) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT count(*) FROM outbox`).Scan(&n)
	return n, err
}
