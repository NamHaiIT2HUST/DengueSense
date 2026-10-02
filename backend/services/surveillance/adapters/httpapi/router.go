package httpapi

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/surveillance/app"
)

// publicRoutes: route KHÔNG cần token dịch vụ. Phải trùng đúng tập operation `security: []` trong
// contracts/openapi/surveillance-internal.yaml — test đối chiếu hai bên và gọi TỪNG operation không kèm token,
// kỳ vọng 401 (fail-closed).
var publicRoutes = map[string]struct{}{
	http.MethodGet + " /healthz": {},
	http.MethodGet + " /readyz":  {},
}

// ServiceAudience là audience của token dịch vụ gửi TỚI surveillance.
const ServiceAudience = "surveillance"

// IsPublic báo route (method + mẫu đường dẫn đã khớp) thuộc danh sách công khai.
func IsPublic(method, fullPath string) bool {
	_, ok := publicRoutes[method+" "+fullPath]
	return ok
}

// Deps là phụ thuộc để dựng router.
type Deps struct {
	Log      *slog.Logger
	Service  *app.Service
	Verifier *authx.ServiceVerifier
	Ready    httpx.ReadyFunc
	MaxBody  int64
}

// NewRouter dựng router: mọi route đăng ký từ hợp đồng; xác thực token dịch vụ fail-closed, chỉ route trong
// publicRoutes được miễn. Middleware gắn ở NHÓM route (chạy trước khi mã sinh kiểm tham số).
func NewRouter(d Deps) *gin.Engine {
	r := httpx.NewEngine(d.Log, d.MaxBody)
	strict := api.NewStrictHandlerWithOptions(NewHandler(d.Service, d.Ready), nil, api.StrictGinServerOptions{
		RequestErrorHandlerFunc:  httpx.RequestErrorHandler(),
		HandlerErrorFunc:         httpx.HandlerErrorHandler(d.Log),
		ResponseErrorHandlerFunc: httpx.ResponseErrorHandler(d.Log),
	})
	group := r.Group("", authx.ServiceMiddleware(d.Verifier, IsPublic))
	api.RegisterHandlersWithOptions(group, strict, api.GinServerOptions{ErrorHandler: httpx.ParamErrorHandler()})
	return r
}
