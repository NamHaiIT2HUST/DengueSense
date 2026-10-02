// Package httpapi: adapter HTTP của `surveillance` — hiện thực StrictServerInterface sinh từ
// contracts/openapi/surveillance-internal.yaml. Chỉ dịch giữa HTTP và use case; không chứa nghiệp vụ.
package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/domain"
)

const (
	maxPanelBytes    = 32 << 20
	maxManifestBytes = 1 << 20
	// Nội dung theo `version` là bất biến → cache dài (docs/09: Cache-Control dài khi chỉ định version).
	immutableCache = "private, max-age=31536000, immutable"
)

// Handler hiện thực api.StrictServerInterface.
type Handler struct {
	svc   *app.Service
	ready httpx.ReadyFunc
}

var _ api.StrictServerInterface = (*Handler)(nil)

// NewHandler tạo Handler. `ready` nil nghĩa là luôn sẵn sàng (test).
func NewHandler(svc *app.Service, ready httpx.ReadyFunc) *Handler {
	return &Handler{svc: svc, ready: ready}
}

// mapError chuyển lỗi nghiệp vụ sang mã lỗi của contracts/errors.md. Lỗi lạ đi tiếp và trở thành 500 chung.
func mapError(err error) error {
	var bad *domain.InvalidPanelError
	switch {
	case errors.As(err, &bad):
		e := httpx.New(http.StatusBadRequest, "surveillance.invalid_panel", "Dữ liệu nhập không hợp lệ", bad.Error())
		for _, p := range bad.Problems {
			e.Fields = append(e.Fields, httpx.FieldError{Field: "panel", Message: p})
		}
		return e
	case errors.Is(err, domain.ErrProvinceNotFound):
		return httpx.New(http.StatusNotFound, "surveillance.province_not_found", "Không tìm thấy tỉnh", "")
	case errors.Is(err, domain.ErrGeometryNotFound):
		return httpx.New(http.StatusNotFound, "surveillance.geometry_version_not_found", "Không tìm thấy phiên bản bản đồ", "")
	case errors.Is(err, domain.ErrDataVersionNotFound):
		return httpx.NotFound("không tìm thấy phiên bản dữ liệu")
	case errors.Is(err, domain.ErrDataVersionConflict):
		return httpx.New(http.StatusConflict, "surveillance.data_version_conflict", "Phiên bản dữ liệu đã tồn tại với nội dung khác", "")
	default:
		return err
	}
}

func toProvince(p domain.Province) api.Province {
	out := api.Province{ProvinceId: p.ID, Name: p.Name, Region: api.Region(p.Region)}
	if p.Population != nil {
		v := int(*p.Population)
		out.Population = &v
	}
	return out
}

func ptr[T any](v T) *T { return &v }

func toDataVersion(v domain.DataVersion) api.DataVersion {
	return api.DataVersion{
		Version: v.Version, PublishedAt: v.PublishedAt, FirstMonth: ptr(v.FirstMonth), LastMonth: ptr(v.LastMonth), RealShare: v.RealShare,
	}
}

func toDetail(v domain.DataVersion) api.DataVersionDetail {
	issues := v.KnownIssues
	if issues == nil {
		issues = []string{}
	}
	return api.DataVersionDetail{
		Version: v.Version, PublishedAt: v.PublishedAt, FirstMonth: ptr(v.FirstMonth), LastMonth: ptr(v.LastMonth),
		RealShare: v.RealShare, NRows: v.NRows, NProvinces: v.NProvinces, Sha256: v.SHA256, KnownIssues: &issues,
	}
}

// ListProvinces xử lý GET /internal/v1/provinces.
func (h *Handler) ListProvinces(ctx context.Context, _ api.ListProvincesRequestObject) (api.ListProvincesResponseObject, error) {
	ps, err := h.svc.Provinces(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	items := make([]api.Province, len(ps))
	for i, p := range ps {
		items[i] = toProvince(p)
	}
	return api.ListProvinces200JSONResponse{Items: items}, nil
}

// GetProvince xử lý GET /internal/v1/provinces/{province_id}.
func (h *Handler) GetProvince(ctx context.Context, req api.GetProvinceRequestObject) (api.GetProvinceResponseObject, error) {
	p, err := h.svc.Province(ctx, req.ProvinceId)
	if err != nil {
		return nil, mapError(err)
	}
	return api.GetProvince200JSONResponse(toProvince(p)), nil
}

// rawResponse ghi nguyên các byte đã lưu (ranh giới ~600 KB, panel Parquet) — không giải mã rồi mã hoá lại.
type rawResponse struct {
	contentType string
	headers     map[string]string
	body        []byte
}

func (r rawResponse) write(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", r.contentType)
	for k, v := range r.headers {
		w.Header().Set(k, v)
	}
	w.Header().Set("Content-Length", fmt.Sprint(len(r.body)))
	w.WriteHeader(http.StatusOK)
	_, err := w.Write(r.body)
	return err
}

type geometryResponse struct{ rawResponse }

func (r geometryResponse) VisitGetProvinceGeometryResponse(w http.ResponseWriter) error {
	return r.write(w)
}

type panelResponse struct{ rawResponse }

func (r panelResponse) VisitDownloadPanelResponse(w http.ResponseWriter) error { return r.write(w) }

// GetProvinceGeometry xử lý GET /internal/v1/geo/provinces.
func (h *Handler) GetProvinceGeometry(ctx context.Context, req api.GetProvinceGeometryRequestObject) (api.GetProvinceGeometryResponseObject, error) {
	version := ""
	if req.Params.Version != nil {
		version = *req.Params.Version
	}
	v, body, err := h.svc.Geometry(ctx, version)
	if err != nil {
		return nil, mapError(err)
	}
	headers := map[string]string{"X-Geometry-Version": v}
	if version != "" {
		headers["Cache-Control"] = immutableCache // chỉ định version cụ thể → bất biến
	}
	return geometryResponse{rawResponse{contentType: "application/geo+json", headers: headers, body: body}}, nil
}

// ListDataVersions xử lý GET /internal/v1/data-versions.
func (h *Handler) ListDataVersions(ctx context.Context, _ api.ListDataVersionsRequestObject) (api.ListDataVersionsResponseObject, error) {
	vs, err := h.svc.DataVersions(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	items := make([]api.DataVersion, len(vs))
	for i, v := range vs {
		items[i] = toDataVersion(v)
	}
	return api.ListDataVersions200JSONResponse{Items: items}, nil
}

// GetDataVersion xử lý GET /internal/v1/data-versions/{version}.
func (h *Handler) GetDataVersion(ctx context.Context, req api.GetDataVersionRequestObject) (api.GetDataVersionResponseObject, error) {
	v, err := h.svc.DataVersion(ctx, req.Version)
	if err != nil {
		return nil, mapError(err)
	}
	return api.GetDataVersion200JSONResponse(toDetail(v)), nil
}

// DownloadPanel xử lý GET /internal/v1/data-versions/{version}/panel.
func (h *Handler) DownloadPanel(ctx context.Context, req api.DownloadPanelRequestObject) (api.DownloadPanelResponseObject, error) {
	panel, sum, err := h.svc.Panel(ctx, req.Version)
	if err != nil {
		return nil, mapError(err)
	}
	return panelResponse{rawResponse{
		contentType: "application/vnd.apache.parquet",
		headers:     map[string]string{"X-Content-SHA256": sum, "Cache-Control": immutableCache},
		body:        panel,
	}}, nil
}

// ListObservations xử lý GET /internal/v1/observations.
func (h *Handler) ListObservations(ctx context.Context, req api.ListObservationsRequestObject) (api.ListObservationsResponseObject, error) {
	p := req.Params
	if !domain.ValidProvinceID(p.ProvinceId) {
		return nil, httpx.ValidationError("đầu vào không hợp lệ", httpx.FieldError{Field: "province_id", Message: "mã tỉnh sai định dạng"})
	}
	version, from, to := deref(p.DataVersion), deref(p.From), deref(p.To)
	if version != "" && !domain.ValidVersion(version) {
		return nil, httpx.ValidationError("đầu vào không hợp lệ", httpx.FieldError{Field: "data_version", Message: "phải có dạng vX.Y.Z"})
	}
	used, obs, err := h.svc.Observations(ctx, version, p.ProvinceId, from, to)
	var bad *domain.InvalidPanelError
	if errors.As(err, &bad) {
		return nil, httpx.ValidationError("đầu vào không hợp lệ", httpx.FieldError{Field: "from", Message: bad.Problems[0]})
	}
	if err != nil {
		return nil, mapError(err)
	}
	items := make([]api.Observation, len(obs))
	for i, o := range obs {
		items[i] = api.Observation{Month: o.Month, Cases: o.Cases, IncidencePer100k: o.IncidencePer100k, DataSource: api.DataSource(o.Source)}
	}
	return api.ListObservations200JSONResponse{DataVersion: used, Items: items}, nil
}

func deref[T ~string](p *T) string {
	if p == nil {
		return ""
	}
	return string(*p)
}

// CreateDataVersion xử lý POST /internal/v1/data-versions (multipart: panel + manifest). Cần vai trò data_manager.
func (h *Handler) CreateDataVersion(ctx context.Context, req api.CreateDataVersionRequestObject) (api.CreateDataVersionResponseObject, error) {
	// Quyền: chỉ tin danh tính gốc do gateway gắn khi kèm token dịch vụ (đã kiểm ở middleware).
	actor, ok := authx.ActorFrom(ctx)
	if !ok || !actor.Has(authx.RoleDataManager, authx.RoleAdmin) {
		return nil, httpx.Forbidden("cần vai trò data_manager")
	}
	if req.Body == nil {
		return nil, httpx.ValidationError("thiếu thân multipart")
	}
	var (
		panel    []byte
		manifest []byte
	)
	for {
		part, err := req.Body.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, httpx.ValidationError("thân multipart không hợp lệ")
		}
		switch part.FormName() {
		case "panel":
			panel, err = readLimited(part, maxPanelBytes)
		case "manifest":
			manifest, err = readLimited(part, maxManifestBytes)
		default:
			_, err = io.Copy(io.Discard, io.LimitReader(part, maxManifestBytes))
		}
		if err != nil {
			return nil, httpx.ValidationError("phần multipart quá lớn hoặc không đọc được", httpx.FieldError{Field: part.FormName(), Message: "quá lớn hoặc không đọc được"})
		}
	}
	if len(panel) == 0 {
		return nil, httpx.ValidationError("thiếu phần panel", httpx.FieldError{Field: "panel", Message: "bắt buộc"})
	}
	var m domain.Manifest
	dec := json.NewDecoder(bytes.NewReader(manifest))
	dec.DisallowUnknownFields()
	if len(manifest) == 0 || dec.Decode(&m) != nil {
		return nil, httpx.ValidationError("manifest thiếu hoặc không phải JSON hợp lệ", httpx.FieldError{Field: "manifest", Message: "phải là JSON của PanelManifest"})
	}

	res, err := h.svc.PublishDataVersion(ctx, panel, m)
	if err != nil {
		return nil, mapError(err)
	}
	return api.CreateDataVersion201JSONResponse(toDetail(res.DataVersion)), nil
}

func readLimited(r io.Reader, limit int64) ([]byte, error) {
	b, err := io.ReadAll(io.LimitReader(r, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > limit {
		return nil, errors.New("quá lớn")
	}
	return b, nil
}

// Healthz xử lý GET /healthz.
func (h *Handler) Healthz(context.Context, api.HealthzRequestObject) (api.HealthzResponseObject, error) {
	return api.Healthz200JSONResponse{Status: "ok"}, nil
}

// Readyz xử lý GET /readyz: kiểm phụ thuộc; lỗi → 503 chung, không lộ chi tiết.
func (h *Handler) Readyz(ctx context.Context, _ api.ReadyzRequestObject) (api.ReadyzResponseObject, error) {
	if h.ready != nil {
		if err := h.ready(ctx); err != nil {
			return nil, httpx.DependencyUnavailable()
		}
	}
	return api.Readyz200JSONResponse{Status: "ready"}, nil
}
