package authx

import (
	"context"

	"github.com/gin-gonic/gin"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
)

type actorCtxKey struct{}

// WithActor gắn Actor vào context.
func WithActor(ctx context.Context, a Actor) context.Context {
	return context.WithValue(ctx, actorCtxKey{}, a)
}

// ActorFrom lấy Actor đã xác thực từ context (ok=false nếu request chưa qua xác thực).
func ActorFrom(ctx context.Context) (Actor, bool) {
	a, ok := ctx.Value(actorCtxKey{}).(Actor)
	return a, ok
}

// PublicFunc cho biết request có thuộc route công khai (không cần token) hay không.
type PublicFunc func(method, fullPath string) bool

// Middleware xác thực Bearer token cho MỌI route, trừ route công khai — thiết kế FAIL-CLOSED:
// route mới thêm mà quên khai báo thì mặc định BỊ BẢO VỆ (401), không bao giờ vô tình mở.
//
// `isPublic` nhận method và mẫu đường dẫn đã khớp (c.FullPath(), vd "/api/v1/auth/login"). Danh sách
// công khai của gateway được kiểm bằng test đối chiếu với các operation `security: []` trong
// contracts/openapi/public-v1.yaml, nên hợp đồng và code không thể lệch nhau âm thầm.
func Middleware(v Verifier, isPublic PublicFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		if isPublic != nil && isPublic(c.Request.Method, c.FullPath()) {
			c.Next()
			return
		}
		token, ok := httpx.TrimBearer(c.GetHeader("Authorization"))
		if !ok {
			unauthorized(c)
			return
		}
		actor, err := v.Verify(token)
		if err != nil {
			unauthorized(c)
			return
		}
		c.Request = c.Request.WithContext(WithActor(c.Request.Context(), actor))
		c.Next()
	}
}

func unauthorized(c *gin.Context) {
	c.Header("WWW-Authenticate", `Bearer realm="denguesense"`)
	httpx.WriteProblem(c, httpx.Unauthenticated("cần đăng nhập"))
}

// RequireRoles trả lỗi 403 nếu Actor trong ctx không có ít nhất một trong các vai trò.
// Dùng trong handler / use case: `if err := authx.RequireRoles(ctx, authx.RoleAnalyst); err != nil { return nil, err }`.
// Không có Actor (route chưa được bảo vệ) → 401, không phải 403: thà từ chối còn hơn cho qua.
func RequireRoles(ctx context.Context, roles ...Role) error {
	a, ok := ActorFrom(ctx)
	if !ok {
		return httpx.Unauthenticated("cần đăng nhập")
	}
	if !a.Has(roles...) {
		return httpx.Forbidden("không đủ quyền cho thao tác này")
	}
	return nil
}
