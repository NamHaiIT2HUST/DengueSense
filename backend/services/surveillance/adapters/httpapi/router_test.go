package httpapi_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"
	"time"

	"github.com/parquet-go/parquet-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/contracttest"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/adapters/httpapi"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/adapters/memory"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/domain"
)

const issuer = "denguesense-identity"

type env struct {
	router http.Handler
	repo   *memory.Repo
	signer *authx.Ed25519Signer
	tok    string // token dịch vụ của gateway gửi tới surveillance
}

func newEnv(t *testing.T) *env {
	t.Helper()
	pub, priv, err := authx.GenerateKeyPair()
	require.NoError(t, err)
	signer, err := authx.NewEd25519Signer(priv, issuer, "denguesense-gateway")
	require.NoError(t, err)
	signer = signer.WithKeyID("k1")
	verifier, err := authx.NewServiceVerifier(authx.StaticKeySet{"k1": pub}, issuer, httpapi.ServiceAudience)
	require.NoError(t, err)

	repo := memory.New()
	require.NoError(t, repo.UpsertProvinces(t.Context(), []domain.Province{
		{ID: "ha_noi", Name: "Hà Nội", Region: domain.RegionBac},
		{ID: "khanh_hoa", Name: "Khánh Hòa", Region: domain.RegionTrung},
	}))
	clock := time.Date(2026, 9, 25, 9, 0, 0, 0, time.UTC)
	log := obsx.NewLogger(&bytes.Buffer{}, "surveillance", "test", slog.LevelDebug)
	svc := app.New(repo, func() time.Time { return clock }, log)
	tok, err := signer.SignService("gateway", httpapi.ServiceAudience)
	require.NoError(t, err)
	return &env{
		repo: repo, signer: signer, tok: tok,
		router: httpapi.NewRouter(httpapi.Deps{Log: log, Service: svc, Verifier: verifier, MaxBody: 8 << 20}),
	}
}

func (e *env) do(t *testing.T, method, path, bearer string, hdr map[string]string, contentType string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	return w
}

func (e *env) get(t *testing.T, path string) *httptest.ResponseRecorder {
	return e.do(t, http.MethodGet, path, e.tok, nil, "", nil)
}

func decode[T any](t *testing.T, w *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &v), w.Body.String())
	return v
}

type problem struct {
	Code   string `json:"code"`
	Status int    `json:"status"`
	Errors []struct {
		Field   string `json:"field"`
		Message string `json:"message"`
	} `json:"errors"`
}

// ---------- Hợp đồng: fail-closed ----------

func TestPublicRoutes_MatchContract(t *testing.T) {
	var fromContract []string
	for _, op := range contracttest.Load(t, "surveillance-internal.yaml") {
		if op.Public {
			fromContract = append(fromContract, op.Method+" "+op.Path)
			assert.True(t, httpapi.IsPublic(op.Method, op.Path), "hợp đồng đánh dấu công khai nhưng code chưa miễn: %s %s", op.Method, op.Path)
		}
	}
	assert.ElementsMatch(t, []string{"GET /healthz", "GET /readyz"}, fromContract,
		"tập route công khai thay đổi: rà soát bảo mật rồi cập nhật cả hợp đồng lẫn publicRoutes")
}

func TestEveryContractOperation_FailClosed(t *testing.T) {
	e := newEnv(t)
	userTok, err := e.signer.Sign(authx.Actor{ID: "u1", Roles: []authx.Role{authx.RoleAdmin}})
	require.NoError(t, err)
	wrongAud, err := e.signer.SignService("gateway", "forecast")
	require.NoError(t, err)

	for _, op := range contracttest.Load(t, "surveillance-internal.yaml") {
		t.Run(op.Method+" "+op.Path, func(t *testing.T) {
			path := contracttest.ConcretePath(op.Path)
			noToken := e.do(t, op.Method, path, "", nil, "", nil)
			assert.NotEqual(t, http.StatusNotFound, noToken.Code, "route phải được đăng ký")
			if op.Public {
				assert.NotEqual(t, http.StatusUnauthorized, noToken.Code)
				return
			}
			assert.Equal(t, http.StatusUnauthorized, noToken.Code, "thiếu token dịch vụ phải 401")
			assert.Equal(t, http.StatusUnauthorized, e.do(t, op.Method, path, userTok, nil, "", nil).Code, "token NGƯỜI DÙNG không thay được token dịch vụ")
			assert.Equal(t, http.StatusUnauthorized, e.do(t, op.Method, path, wrongAud, nil, "", nil).Code, "token cấp cho service khác")
		})
	}
}

// ---------- Dữ liệu thử ----------

type prow struct {
	ProvinceID string    `parquet:"province_id"`
	Month      time.Time `parquet:"month,timestamp(microsecond)"`
	Cases      float64   `parquet:"cases"`
	DataSource string    `parquet:"data_source"`
	Population *int64    `parquet:"population,optional"`
	Incidence  *float64  `parquet:"incidence_per_100k,optional"`
}

func testPanel(t *testing.T) ([]byte, domain.Manifest) {
	t.Helper()
	pop, inc := int64(8_000_000), 0.06
	rows := []prow{
		{"ha_noi", time.Date(2010, 1, 1, 0, 0, 0, 0, time.UTC), 5, "real", &pop, &inc},
		{"ha_noi", time.Date(2010, 2, 1, 0, 0, 0, 0, time.UTC), 9, "real", &pop, nil},
		{"khanh_hoa", time.Date(2010, 1, 1, 0, 0, 0, 0, time.UTC), 30, "real", nil, nil},
		{"khanh_hoa", time.Date(2011, 1, 1, 0, 0, 0, 0, time.UTC), 40, "estimated", nil, nil},
	}
	var buf bytes.Buffer
	require.NoError(t, parquet.Write(&buf, rows))
	b := buf.Bytes()
	return b, domain.Manifest{
		Version: "v0.9.0", NRows: 4, NProvinces: 2, FirstMonth: "2010-01", LastMonth: "2011-01", RealShare: 0.75,
		SHA256: domain.SHA256Hex(b), KnownIssues: []string{"dữ liệu thử"},
	}
}

func multipartBody(t *testing.T, panel []byte, manifest any) (string, []byte) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	if panel != nil {
		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition", `form-data; name="panel"; filename="panel_monthly.parquet"`)
		h.Set("Content-Type", "application/vnd.apache.parquet")
		pw, err := mw.CreatePart(h)
		require.NoError(t, err)
		_, _ = pw.Write(panel)
	}
	if manifest != nil {
		mwp, err := mw.CreateFormField("manifest")
		require.NoError(t, err)
		switch m := manifest.(type) {
		case string:
			_, _ = mwp.Write([]byte(m))
		default:
			require.NoError(t, json.NewEncoder(mwp).Encode(m))
		}
	}
	require.NoError(t, mw.Close())
	return mw.FormDataContentType(), buf.Bytes()
}

func (e *env) publish(t *testing.T, roles string, panel []byte, manifest any) *httptest.ResponseRecorder {
	ct, body := multipartBody(t, panel, manifest)
	return e.do(t, http.MethodPost, "/internal/v1/data-versions", e.tok, map[string]string{
		"Idempotency-Key": "0192f3a1-0000-7000-8000-000000000001",
		"X-Actor-ID":      "0192f3a1-0000-7000-8000-0000000000aa",
		"X-Actor-Roles":   roles,
	}, ct, body)
}

// ---------- Luồng nghiệp vụ ----------

func TestPublishAndReadBack(t *testing.T) {
	e := newEnv(t)
	panel, manifest := testPanel(t)

	w := e.publish(t, "data_manager,viewer", panel, manifest)
	require.Equal(t, http.StatusCreated, w.Code, w.Body.String())
	detail := decode[map[string]any](t, w)
	assert.Equal(t, "v0.9.0", detail["version"])
	assert.EqualValues(t, 4, detail["n_rows"])
	assert.Equal(t, "2010-01", detail["first_month"])
	assert.Equal(t, []any{"dữ liệu thử"}, detail["known_issues"])

	// danh sách + chi tiết
	list := decode[struct {
		Items []map[string]any `json:"items"`
	}](t, e.get(t, "/internal/v1/data-versions"))
	require.Len(t, list.Items, 1)
	assert.InDelta(t, 0.75, list.Items[0]["real_share"], 1e-9)
	assert.Equal(t, http.StatusOK, e.get(t, "/internal/v1/data-versions/v0.9.0").Code)
	assert.Equal(t, http.StatusNotFound, e.get(t, "/internal/v1/data-versions/v9.9.9").Code)

	// tải panel: nguyên vẹn, kèm sha256 và cache bất biến
	dl := e.get(t, "/internal/v1/data-versions/v0.9.0/panel")
	require.Equal(t, http.StatusOK, dl.Code)
	assert.Equal(t, panel, dl.Body.Bytes())
	assert.Equal(t, manifest.SHA256, dl.Header().Get("X-Content-SHA256"))
	assert.Contains(t, dl.Header().Get("Content-Type"), "application/vnd.apache.parquet")
	assert.Contains(t, dl.Header().Get("Cache-Control"), "immutable")

	// quan sát: giữ nhãn nguồn (T2), lọc khoảng tháng
	obs := decode[struct {
		DataVersion string `json:"data_version"`
		Items       []struct {
			Month      string  `json:"month"`
			Cases      float64 `json:"cases"`
			DataSource string  `json:"data_source"`
		} `json:"items"`
	}](t, e.get(t, "/internal/v1/observations?province_id=khanh_hoa"))
	assert.Equal(t, "v0.9.0", obs.DataVersion)
	require.Len(t, obs.Items, 2)
	assert.Equal(t, "estimated", obs.Items[1].DataSource)
	filtered := decode[struct {
		Items []any `json:"items"`
	}](t, e.get(t, "/internal/v1/observations?province_id=ha_noi&from=2010-02&to=2010-02"))
	assert.Len(t, filtered.Items, 1)

	// dân số tham chiếu xuất hiện ở danh mục sau khi có dữ liệu
	ha := decode[map[string]any](t, e.get(t, "/internal/v1/provinces/ha_noi"))
	assert.EqualValues(t, 8_000_000, ha["population"])
	kh := decode[map[string]any](t, e.get(t, "/internal/v1/provinces/khanh_hoa"))
	assert.NotContains(t, kh, "population", "chưa có dân số thì bỏ trường, không bịa 0")
}

func TestPublishIsImmutableAndIdempotent(t *testing.T) {
	e := newEnv(t)
	panel, manifest := testPanel(t)
	require.Equal(t, http.StatusCreated, e.publish(t, "data_manager", panel, manifest).Code)

	again := e.publish(t, "data_manager", panel, manifest)
	assert.Equal(t, http.StatusCreated, again.Code, "cùng nội dung: gọi lại an toàn")
	assert.Len(t, e.repo.Outbox, 1, "không phát sự kiện thứ hai")

	// cùng tên phiên bản, nội dung khác (sha256 khác)
	other := []byte("noi dung khac hoan toan")
	m2 := manifest
	m2.SHA256 = domain.SHA256Hex(other)
	w := e.publish(t, "data_manager", other, m2)
	// panel rác bị chặn TRƯỚC khi tới bước xung đột — vẫn là lỗi đầu vào, không ghi đè
	assert.Equal(t, http.StatusBadRequest, w.Code)

	// panel hợp lệ khác nội dung cùng tên phiên bản → 409
	var buf bytes.Buffer
	pop := int64(1)
	require.NoError(t, parquet.Write(&buf, []prow{{"ha_noi", time.Date(2010, 1, 1, 0, 0, 0, 0, time.UTC), 1, "real", &pop, nil}}))
	m3 := domain.Manifest{Version: "v0.9.0", NRows: 1, NProvinces: 1, FirstMonth: "2010-01", LastMonth: "2010-01", RealShare: 1, SHA256: domain.SHA256Hex(buf.Bytes())}
	conflict := e.publish(t, "data_manager", buf.Bytes(), m3)
	require.Equal(t, http.StatusConflict, conflict.Code)
	assert.Equal(t, "surveillance.data_version_conflict", decode[problem](t, conflict).Code)

	dl := e.get(t, "/internal/v1/data-versions/v0.9.0/panel")
	assert.Equal(t, panel, dl.Body.Bytes(), "phiên bản gốc không bị đổi")
}

func TestPublishRequiresDataManagerRole(t *testing.T) {
	e := newEnv(t)
	panel, manifest := testPanel(t)
	for _, roles := range []string{"viewer", "analyst,officer", "approver"} {
		w := e.publish(t, roles, panel, manifest)
		assert.Equal(t, http.StatusForbidden, w.Code, roles)
		assert.Equal(t, "common.forbidden", decode[problem](t, w).Code)
	}
	assert.Equal(t, http.StatusCreated, e.publish(t, "admin", panel, manifest).Code)

	// không kèm danh tính người dùng gốc → cũng bị từ chối (dịch vụ không tự có quyền công bố dữ liệu)
	e2 := newEnv(t)
	ct, body := multipartBody(t, panel, manifest)
	w := e2.do(t, http.MethodPost, "/internal/v1/data-versions", e2.tok, map[string]string{"Idempotency-Key": "0192f3a1-0000-7000-8000-000000000001", "X-Actor-ID": "", "X-Actor-Roles": "data_manager"}, ct, body)
	assert.NotEqual(t, http.StatusCreated, w.Code)
}

func TestPublishRejectsBadInput(t *testing.T) {
	e := newEnv(t)
	panel, manifest := testPanel(t)

	cases := map[string]func() *httptest.ResponseRecorder{
		"thiếu panel":         func() *httptest.ResponseRecorder { return e.publish(t, "data_manager", nil, manifest) },
		"thiếu manifest":      func() *httptest.ResponseRecorder { return e.publish(t, "data_manager", panel, nil) },
		"manifest không JSON": func() *httptest.ResponseRecorder { return e.publish(t, "data_manager", panel, "không phải json") },
		"manifest trường lạ": func() *httptest.ResponseRecorder {
			return e.publish(t, "data_manager", panel, `{"version":"v0.9.0","bia":1}`)
		},
		"panel không phải parquet": func() *httptest.ResponseRecorder {
			m := manifest
			m.SHA256 = domain.SHA256Hex([]byte("rác"))
			return e.publish(t, "data_manager", []byte("rác"), m)
		},
		"sha256 lệch": func() *httptest.ResponseRecorder {
			m := manifest
			m.SHA256 = domain.SHA256Hex([]byte("khác"))
			return e.publish(t, "data_manager", panel, m)
		},
		"manifest khai sai số dòng": func() *httptest.ResponseRecorder {
			m := manifest
			m.NRows = 99
			return e.publish(t, "data_manager", panel, m)
		},
	}
	for name, call := range cases {
		t.Run(name, func(t *testing.T) {
			w := call()
			assert.Equal(t, http.StatusBadRequest, w.Code, w.Body.String())
			p := decode[problem](t, w)
			assert.Contains(t, []string{"common.validation_error", "surveillance.invalid_panel"}, p.Code)
		})
	}
	assert.Empty(t, e.repo.Outbox, "đầu vào sai không được để lại dấu vết")
	vs := decode[struct{ Items []any }](t, e.get(t, "/internal/v1/data-versions"))
	assert.Empty(t, vs.Items)
}

func TestInvalidPanelListsEachProblemAsAField(t *testing.T) {
	e := newEnv(t)
	panel, manifest := testPanel(t)
	manifest.NRows, manifest.NProvinces = 99, 9
	w := e.publish(t, "data_manager", panel, manifest)
	require.Equal(t, http.StatusBadRequest, w.Code)
	p := decode[problem](t, w)
	assert.Equal(t, "surveillance.invalid_panel", p.Code)
	assert.GreaterOrEqual(t, len(p.Errors), 2)
}

func TestObservationsValidation(t *testing.T) {
	e := newEnv(t)
	assert.Equal(t, http.StatusBadRequest, e.get(t, "/internal/v1/observations").Code, "thiếu province_id")
	assert.Equal(t, http.StatusBadRequest, e.get(t, "/internal/v1/observations?province_id=HA_NOI").Code, "sai định dạng mã tỉnh")
	assert.Equal(t, http.StatusBadRequest, e.get(t, "/internal/v1/observations?province_id=ha_noi&from=2010-13").Code)
	assert.Equal(t, http.StatusBadRequest, e.get(t, "/internal/v1/observations?province_id=ha_noi&from=2010-05&to=2010-01").Code, "from sau to")
	assert.Equal(t, http.StatusBadRequest, e.get(t, "/internal/v1/observations?province_id=ha_noi&data_version=0.2.0").Code)
	nf := e.get(t, "/internal/v1/observations?province_id=khong_co")
	require.Equal(t, http.StatusNotFound, nf.Code)
	assert.Equal(t, "surveillance.province_not_found", decode[problem](t, nf).Code)
	// tỉnh có nhưng chưa có phiên bản dữ liệu nào
	assert.Equal(t, http.StatusNotFound, e.get(t, "/internal/v1/observations?province_id=ha_noi").Code)
}

func TestProvincesAndGeometry(t *testing.T) {
	e := newEnv(t)
	list := decode[struct {
		Items []struct {
			ProvinceID string `json:"province_id"`
			Region     string `json:"region"`
		} `json:"items"`
	}](t, e.get(t, "/internal/v1/provinces"))
	require.Len(t, list.Items, 2)
	assert.Equal(t, "ha_noi", list.Items[0].ProvinceID)
	assert.Equal(t, http.StatusNotFound, e.get(t, "/internal/v1/provinces/khong_co").Code)

	// chưa có ranh giới
	nf := e.get(t, "/internal/v1/geo/provinces")
	require.Equal(t, http.StatusNotFound, nf.Code)
	assert.Equal(t, "surveillance.geometry_version_not_found", decode[problem](t, nf).Code)

	geo := `{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[1,2]},"properties":{"province_id":"ha_noi"}}]}`
	require.NoError(t, e.repo.PutGeometry(t.Context(), "2025-07", []byte(geo)))
	latest := e.get(t, "/internal/v1/geo/provinces")
	require.Equal(t, http.StatusOK, latest.Code)
	assert.Contains(t, latest.Header().Get("Content-Type"), "application/geo+json")
	assert.JSONEq(t, geo, latest.Body.String())
	assert.NotContains(t, latest.Header().Get("Cache-Control"), "immutable", "'mới nhất' thay đổi được → không cache dài")
	pinned := e.get(t, "/internal/v1/geo/provinces?version=2025-07")
	assert.Contains(t, pinned.Header().Get("Cache-Control"), "immutable", "chỉ định version → bất biến")
	assert.Equal(t, http.StatusNotFound, e.get(t, "/internal/v1/geo/provinces?version=1999-01").Code)
}

func TestHealthAndReadiness(t *testing.T) {
	e := newEnv(t)
	assert.Equal(t, http.StatusOK, e.do(t, http.MethodGet, "/healthz", "", nil, "", nil).Code)
	assert.Equal(t, http.StatusOK, e.do(t, http.MethodGet, "/readyz", "", nil, "", nil).Code)
}
