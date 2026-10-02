package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/app"
)

// publicRoutes: route KHÔNG cần token dịch vụ. Phải trùng đúng tập operation `security: []` trong
// contracts/openapi/identity-internal.yaml — test đối chiếu hai bên (TestPublicRoutes_MatchContract) và test gọi
// TỪNG operation của hợp đồng không kèm token, kỳ vọng 401 (fail-closed).
var publicRoutes = map[string]struct{}{
	http.MethodGet + " /healthz":                           {},
	http.MethodGet + " /readyz":                            {},
	http.MethodGet + " /internal/v1/.well-known/jwks.json": {},
	http.MethodPost + " /internal/v1/service-tokens":       {},
}

// IsPublic báo route (method + mẫu đường dẫn đã khớp) thuộc danh sách công khai.
func IsPublic(method, fullPath string) bool {
	_, ok := publicRoutes[method+" "+fullPath]
	return ok
}

// Deps là phụ thuộc để dựng router.
type Deps struct {
	Log      *slog.Logger
	Service  *app.Service
	JWKS     authx.JWKS
	Verifier *authx.ServiceVerifier
	Ready    httpx.ReadyFunc
	MaxBody  int64
}

// NewRouter dựng router: mọi route (kể cả /healthz, /readyz) đăng ký từ hợp đồng; xác thực token dịch vụ
// fail-closed, chỉ route trong publicRoutes được miễn. Middleware gắn ở NHÓM route (chạy trước khi mã sinh kiểm
// tham số) — xem chú thích ở gateway/app/router.go.
func NewRouter(d Deps) *gin.Engine {
	r := httpx.NewEngine(d.Log, d.MaxBody)
	strict := api.NewStrictHandlerWithOptions(NewHandler(d.Service, d.JWKS, d.Ready), nil, api.StrictGinServerOptions{
		RequestErrorHandlerFunc:  httpx.RequestErrorHandler(),
		HandlerErrorFunc:         httpx.HandlerErrorHandler(d.Log),
		ResponseErrorHandlerFunc: httpx.ResponseErrorHandler(d.Log),
	})
	group := r.Group("", authx.ServiceMiddleware(d.Verifier, IsPublic))
	api.RegisterHandlersWithOptions(group, strict, api.GinServerOptions{ErrorHandler: httpx.ParamErrorHandler()})
	return r
}
