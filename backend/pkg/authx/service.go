package authx

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
)

// Header danh tính người dùng gốc do gateway gắn (contracts/openapi/*-internal.yaml, docs/09 §6.8).
const (
	HeaderActorID    = "X-Actor-ID"
	HeaderActorRoles = "X-Actor-Roles"
	HeaderOrgID      = "X-Org-ID"
)

type serviceCtxKey struct{}

// WithService gắn ServiceIdentity vào context.
func WithService(ctx context.Context, s ServiceIdentity) context.Context {
	return context.WithValue(ctx, serviceCtxKey{}, s)
}

// ServiceFrom lấy service đã xác thực từ context.
func ServiceFrom(ctx context.Context) (ServiceIdentity, bool) {
	s, ok := ctx.Value(serviceCtxKey{}).(ServiceIdentity)
	return s, ok
}

// ServiceMiddleware xác thực token DỊCH VỤ cho mọi route trừ route công khai (FAIL-CLOSED, giống Middleware).
//
// Sau khi service được xác thực, các header `X-Actor-*` (danh tính người dùng gốc) MỚI được tin và đưa vào
// context (đọc bằng ActorFrom). Header `X-Actor-*` trên route công khai hoặc không kèm token dịch vụ hợp lệ
// bị bỏ qua hoàn toàn — không ai giả danh người dùng bằng cách tự gắn header.
func ServiceMiddleware(v *ServiceVerifier, isPublic PublicFunc) gin.HandlerFunc {
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
		svc, err := v.Verify(token)
		if err != nil {
			unauthorized(c)
			return
		}
		ctx := WithService(c.Request.Context(), svc)

		if id := strings.TrimSpace(c.GetHeader(HeaderActorID)); id != "" {
			actor, aerr := parseActorHeaders(id, c.GetHeader(HeaderActorRoles), c.GetHeader(HeaderOrgID))
			if aerr != nil {
				httpx.WriteProblem(c, aerr)
				return
			}
			ctx = WithActor(ctx, actor)
		}
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func parseActorHeaders(id, rolesHeader, org string) (Actor, *httpx.Error) {
	var roles []Role
	for _, r := range strings.Split(rolesHeader, ",") {
		if r = strings.TrimSpace(r); r == "" {
			continue
		}
		role := Role(r)
		if !ValidRole(role) {
			return Actor{}, httpx.ValidationError("header X-Actor-Roles chứa vai trò không hợp lệ")
		}
		roles = append(roles, role)
	}
	if len(roles) == 0 {
		return Actor{}, httpx.ValidationError("header X-Actor-ID đi kèm phải có X-Actor-Roles")
	}
	return Actor{ID: id, Roles: roles, OrgID: strings.TrimSpace(org)}, nil
}
