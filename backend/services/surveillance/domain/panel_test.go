package domain_test

import (
	"bytes"
	"os"
	"testing"
	"time"

	"github.com/parquet-go/parquet-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/domain"
)

type rec struct {
	ProvinceID       string    `parquet:"province_id"`
	Month            time.Time `parquet:"month,timestamp(microsecond)"`
	Cases            float64   `parquet:"cases"`
	DataSource       string    `parquet:"data_source"`
	Population       *int64    `parquet:"population,optional"`
	IncidencePer100k *float64  `parquet:"incidence_per_100k,optional"`
	// Cột khí hậu có trong panel thật nhưng surveillance không đọc: phải bị bỏ qua, không gây lỗi.
	TempMean float64 `parquet:"temp_mean"`
}

func month(y int, m time.Month) time.Time { return time.Date(y, m, 1, 0, 0, 0, 0, time.UTC) }

func f(v float64) *float64 { return &v }
func i(v int64) *int64     { return &v }

func writeParquet(t *testing.T, rows []rec) []byte {
	t.Helper()
	var buf bytes.Buffer
	require.NoError(t, parquet.Write(&buf, rows))
	return buf.Bytes()
}

func goodRows() []rec {
	return []rec{
		{ProvinceID: "ha_noi", Month: month(2010, 1), Cases: 5, DataSource: "real", Population: i(8_000_000), IncidencePer100k: f(0.06), TempMean: 17},
		{ProvinceID: "ha_noi", Month: month(2010, 2), Cases: 9, DataSource: "real", Population: i(8_000_000), IncidencePer100k: f(0.11), TempMean: 18},
		{ProvinceID: "khanh_hoa", Month: month(2010, 1), Cases: 30, DataSource: "real", TempMean: 25},
		{ProvinceID: "khanh_hoa", Month: month(2011, 1), Cases: 40, DataSource: "estimated", TempMean: 25},
	}
}

func manifestFor(panel []byte) domain.Manifest {
	return domain.Manifest{
		Version: "v0.9.0", NRows: 4, NProvinces: 2, FirstMonth: "2010-01", LastMonth: "2011-01",
		RealShare: 0.75, SHA256: domain.SHA256Hex(panel), KnownIssues: []string{"dữ liệu thử"},
	}
}

func known(id string) bool { return id == "ha_noi" || id == "khanh_hoa" }

func TestParseAndValidate_HappyPath(t *testing.T) {
	panel := writeParquet(t, goodRows())
	obs, err := domain.ParsePanel(panel)
	require.NoError(t, err)
	require.Len(t, obs, 4)
	assert.Equal(t, "2010-01", obs[0].Month)
	assert.Equal(t, domain.SourceEstimated, obs[3].Source, "dữ liệu ước lượng giữ nguyên nhãn")
	require.NotNil(t, obs[0].Population)
	assert.Nil(t, obs[2].Population)

	dv, err := domain.ValidatePanel(panel, obs, manifestFor(panel), known)
	require.NoError(t, err)
	assert.Equal(t, "v0.9.0", dv.Version)
	assert.Equal(t, "2010-01", dv.FirstMonth)
	assert.Equal(t, "2011-01", dv.LastMonth)
	assert.InDelta(t, 0.75, dv.RealShare, 1e-12)
	assert.Equal(t, 2, dv.NProvinces)
	assert.Equal(t, []string{"dữ liệu thử"}, dv.KnownIssues)
}

func TestParsePanel_RejectsNonParquetAndMissingColumns(t *testing.T) {
	_, err := domain.ParsePanel([]byte("đây không phải parquet"))
	var bad *domain.InvalidPanelError
	require.ErrorAs(t, err, &bad)

	type onlyProvince struct {
		ProvinceID string `parquet:"province_id"`
	}
	var buf bytes.Buffer
	require.NoError(t, parquet.Write(&buf, []onlyProvince{{ProvinceID: "ha_noi"}}))
	_, err = domain.ParsePanel(buf.Bytes())
	require.ErrorAs(t, err, &bad, "thiếu cột month/cases/data_source")
}

func validate(t *testing.T, rows []rec, mutate func(*domain.Manifest)) error {
	t.Helper()
	panel := writeParquet(t, rows)
	obs, err := domain.ParsePanel(panel)
	require.NoError(t, err)
	m := manifestFor(panel)
	if mutate != nil {
		mutate(&m)
	}
	_, err = domain.ValidatePanel(panel, obs, m, known)
	return err
}

func problems(t *testing.T, err error) []string {
	t.Helper()
	var bad *domain.InvalidPanelError
	require.ErrorAs(t, err, &bad)
	return bad.Problems
}

func TestValidatePanel_RejectsEachKindOfBadInput(t *testing.T) {
	cases := map[string]struct {
		rows   func() []rec
		mutate func(*domain.Manifest)
		want   string
	}{
		"sha256 lệch":         {mutate: func(m *domain.Manifest) { m.SHA256 = domain.SHA256Hex([]byte("khác")) }, want: "sha256 của file không khớp"},
		"sha256 sai dạng":     {mutate: func(m *domain.Manifest) { m.SHA256 = "abc" }, want: "64 ký tự hex"},
		"tên phiên bản sai":   {mutate: func(m *domain.Manifest) { m.Version = "0.2.0" }, want: "vX.Y.Z"},
		"n_rows lệch":         {mutate: func(m *domain.Manifest) { m.NRows = 5 }, want: "n_rows"},
		"n_provinces lệch":    {mutate: func(m *domain.Manifest) { m.NProvinces = 3 }, want: "n_provinces"},
		"khoảng tháng lệch":   {mutate: func(m *domain.Manifest) { m.LastMonth = "2012-01" }, want: "khoảng tháng"},
		"real_share lệch":     {mutate: func(m *domain.Manifest) { m.RealShare = 1 }, want: "real_share"},
		"tỉnh lạ":             {rows: func() []rec { r := goodRows(); r[0].ProvinceID = "tinh_la"; return r }, want: "không thuộc danh mục"},
		"trùng (tỉnh, tháng)": {rows: func() []rec { r := goodRows(); r[1].Month = r[0].Month; return r }, want: "trùng"},
		"số ca âm":            {rows: func() []rec { r := goodRows(); r[0].Cases = -1; return r }, want: "số ca"},
		"nguồn dữ liệu lạ":    {rows: func() []rec { r := goodRows(); r[0].DataSource = "bịa"; return r }, want: "data_source"},
		"tỉ suất âm":          {rows: func() []rec { r := goodRows(); r[0].IncidencePer100k = f(-1); return r }, want: "tỉ suất"},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			rows := goodRows()
			if c.rows != nil {
				rows = c.rows()
			}
			err := validate(t, rows, c.mutate)
			require.Error(t, err)
			found := false
			for _, p := range problems(t, err) {
				if bytes.Contains([]byte(p), []byte(c.want)) {
					found = true
				}
			}
			assert.True(t, found, "cần một lỗi chứa %q, có %v", c.want, problems(t, err))
		})
	}
}

func TestValidatePanel_EmptyPanelAndProblemCap(t *testing.T) {
	assert.Error(t, validate(t, []rec{}, func(m *domain.Manifest) { m.NRows = 0; m.NProvinces = 0 }))

	many := make([]rec, 0, 100)
	for k := 0; k < 100; k++ {
		many = append(many, rec{ProvinceID: "tinh_la", Month: month(2010, 1).AddDate(0, k, 0), Cases: 1, DataSource: "real"})
	}
	err := validate(t, many, nil)
	assert.LessOrEqual(t, len(problems(t, err)), 20, "chặn danh sách lỗi để không phình phản hồi")
}

func TestRealPanelV020IsValid(t *testing.T) {
	const path = "../../../../ai-service/data/processed/v0.2.0/panel_monthly.parquet"
	panel, err := os.ReadFile(path)
	if err != nil {
		t.Skip("bỏ qua: panel thật không có trong môi trường này (dữ liệu nằm ngoài git)")
	}
	obs, err := domain.ParsePanel(panel)
	require.NoError(t, err)
	assert.Len(t, obs, 9326)
	provs := map[string]struct{}{}
	real := 0
	for _, o := range obs {
		provs[o.ProvinceID] = struct{}{}
		if o.Source == domain.SourceReal {
			real++
		}
	}
	assert.Len(t, provs, 34)
	assert.InDelta(t, 0.727, float64(real)/float64(len(obs)), 0.001, "72,7% dữ liệu đo thật (manifest)")
}
