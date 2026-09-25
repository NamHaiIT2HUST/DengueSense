package app

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/gateway/api"
)

// BasePath là tiền tố đường dẫn công khai (khớp `servers.url` trong hợp đồng).
const BasePath = "/api/v1"

// publicRoutes là các route KHÔNG cần token. Phải trùng đúng tập operation `security: []` trong
// contracts/openapi/public-v1.yaml — test TestPublicRoutes_MatchContract đối chiếu hai bên, và test
// TestEveryContractOperation_FailClosed kiểm mọi route còn lại trả 401 khi thiếu token.
var publicRoutes = map[string]struct{}{
	"POST " + BasePath + "/auth/login":   {},
	"POST " + BasePath + "/auth/refresh": {},
}

// IsPublic báo route (method + mẫu đường dẫn đã khớp) có thuộc danh sách công khai không.
func IsPublic(method, fullPath string) bool {
	_, ok := publicRoutes[method+" "+fullPath]
	return ok
}

// Deps là các phụ thuộc để dựng router (tiêm từ main hoặc test).
type Deps struct {
	Log      *slog.Logger
	Verifier authx.Verifier
	Server   api.StrictServerInterface
	Ready    httpx.ReadyFunc
	MaxBody  int64
}

// NewRouter dựng gin.Engine của gateway:
//   - /healthz, /readyz ở gốc, không xác thực;
//   - /api/v1/... sinh từ hợp đồng, xác thực fail-closed (chỉ route trong publicRoutes được miễn).
//
// LƯU Ý THỨ TỰ (đã bị test bắt được): xác thực phải chạy TRƯỚC khi mã sinh gắn/kiểm tham số. Nếu đặt
// vào GinServerOptions.Middlewares thì mã sinh kiểm tham số bắt buộc trước, khiến request chưa đăng nhập
// nhận 400 (lộ thông tin validation) thay vì 401. Vì vậy middleware gắn ở NHÓM ROUTE, không ở options.
func NewRouter(d Deps) *gin.Engine {
	r := httpx.NewEngine(d.Log, d.MaxBody)
	httpx.RegisterHealth(r, d.Ready)

	handler := api.NewStrictHandlerWithOptions(d.Server, nil, api.StrictGinServerOptions{
		RequestErrorHandlerFunc:  httpx.RequestErrorHandler(),
		HandlerErrorFunc:         httpx.HandlerErrorHandler(d.Log),
		ResponseErrorHandlerFunc: httpx.ResponseErrorHandler(d.Log),
	})
	group := r.Group(BasePath, authx.Middleware(d.Verifier, IsPublic))
	api.RegisterHandlersWithOptions(group, handler, api.GinServerOptions{
		ErrorHandler: httpx.ParamErrorHandler(),
	})
	return r
}
