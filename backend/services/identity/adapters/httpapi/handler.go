// Package httpapi: adapter HTTP của `identity` — hiện thực StrictServerInterface sinh từ
// contracts/openapi/identity-internal.yaml. Chỉ dịch giữa HTTP và use case; không chứa nghiệp vụ.
package httpapi

import (
	"context"
	"errors"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/api"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

const minRefreshTokenLen = 20 // khớp `RefreshRequest.refresh_token.minLength` của hợp đồng

// Handler hiện thực api.StrictServerInterface.
type Handler struct {
	svc   *app.Service
	jwks  authx.JWKS
	ready httpx.ReadyFunc
}

var _ api.StrictServerInterface = (*Handler)(nil)

// NewHandler tạo Handler. `ready` nil nghĩa là luôn sẵn sàng (test).
func NewHandler(svc *app.Service, jwks authx.JWKS, ready httpx.ReadyFunc) *Handler {
	return &Handler{svc: svc, jwks: jwks, ready: ready}
}

// mapError chuyển lỗi nghiệp vụ sang mã lỗi của contracts/errors.md. Lỗi lạ đi tiếp và trở thành 500 chung
// (chi tiết chỉ ở log — xem httpx.HandlerErrorHandler).
func mapError(err error) error {
	switch {
	case errors.Is(err, domain.ErrInvalidCredentials):
		return httpx.New(401, "auth.invalid_credentials", "Sai tên đăng nhập hoặc mật khẩu", "")
	case errors.Is(err, domain.ErrAccountLocked):
		return httpx.New(401, "auth.account_locked", "Tài khoản tạm khoá", "")
	case errors.Is(err, domain.ErrRefreshInvalid), errors.Is(err, domain.ErrRefreshReused):
		return httpx.New(401, "auth.refresh_invalid", "Phiên không hợp lệ", "")
	case errors.Is(err, domain.ErrServiceCredentials):
		return httpx.New(401, "auth.invalid_service_credentials", "Thông tin xác thực dịch vụ không hợp lệ", "")
	case errors.Is(err, domain.ErrUserNotFound):
		return httpx.NotFound("không tìm thấy người dùng")
	default:
		return err
	}
}

// refreshTokenFrom lấy refresh token từ thân request (trường `writeOnly` nên mã sinh khai là con trỏ).
func refreshTokenFrom(body *api.RefreshRequest) (string, error) {
	if body == nil || body.RefreshToken == nil {
		return "", fieldErr("refresh_token", "bắt buộc")
	}
	t := *body.RefreshToken
	if len(t) < minRefreshTokenLen || len(t) > 512 {
		return "", fieldErr("refresh_token", "phải dài 20–512 ký tự")
	}
	return t, nil
}

func fieldErr(field, msg string) error {
	return httpx.ValidationError("đầu vào không hợp lệ", httpx.FieldError{Field: field, Message: msg})
}

func toAPIUser(u domain.User) api.User {
	roles := make([]api.Role, len(u.Roles))
	for i, r := range u.Roles {
		roles[i] = api.Role(r)
	}
	return api.User{Id: u.ID, Username: u.Username, DisplayName: u.DisplayName, OrgId: u.OrgID, Roles: roles}
}

func toTokenResponse(s app.Session) api.InternalTokenResponse {
	return api.InternalTokenResponse{
		AccessToken:      s.AccessToken,
		TokenType:        "Bearer",
		ExpiresIn:        s.ExpiresIn,
		RefreshToken:     s.RefreshToken,
		RefreshExpiresIn: s.RefreshExpiresIn,
		User:             toAPIUser(s.User),
	}
}

// Login xử lý POST /internal/v1/auth/login.
func (h *Handler) Login(ctx context.Context, req api.LoginRequestObject) (api.LoginResponseObject, error) {
	b := req.Body
	if b == nil || b.Username == "" || len(b.Username) > domain.MaxUsernameLength {
		return nil, fieldErr("username", "bắt buộc, tối đa 128 ký tự")
	}
	if b.Password == nil || *b.Password == "" || len(*b.Password) > domain.MaxPasswordLength {
		return nil, fieldErr("password", "bắt buộc, tối đa 256 ký tự")
	}
	sess, err := h.svc.Login(ctx, b.Username, *b.Password)
	if err != nil {
		return nil, mapError(err)
	}
	return api.Login200JSONResponse(toTokenResponse(sess)), nil
}

// RefreshToken xử lý POST /internal/v1/auth/refresh.
func (h *Handler) RefreshToken(ctx context.Context, req api.RefreshTokenRequestObject) (api.RefreshTokenResponseObject, error) {
	token, err := refreshTokenFrom(req.Body)
	if err != nil {
		return nil, err
	}
	sess, err := h.svc.Refresh(ctx, token)
	if err != nil {
		return nil, mapError(err)
	}
	return api.RefreshToken200JSONResponse(toTokenResponse(sess)), nil
}

// Logout xử lý POST /internal/v1/auth/logout (idempotent).
func (h *Handler) Logout(ctx context.Context, req api.LogoutRequestObject) (api.LogoutResponseObject, error) {
	token, err := refreshTokenFrom(req.Body)
	if err != nil {
		return nil, err
	}
	if err := h.svc.Logout(ctx, token); err != nil {
		return nil, mapError(err)
	}
	return api.Logout204Response{}, nil
}

// GetUser xử lý GET /internal/v1/users/{user_id}.
func (h *Handler) GetUser(ctx context.Context, req api.GetUserRequestObject) (api.GetUserResponseObject, error) {
	u, err := h.svc.GetUser(ctx, req.UserId)
	if err != nil {
		return nil, mapError(err)
	}
	return api.GetUser200JSONResponse(toAPIUser(u)), nil
}

// GetJwks xử lý GET /internal/v1/.well-known/jwks.json (công khai — chỉ khoá công khai).
func (h *Handler) GetJwks(context.Context, api.GetJwksRequestObject) (api.GetJwksResponseObject, error) {
	keys := make([]api.Jwk, len(h.jwks.Keys))
	for i, k := range h.jwks.Keys {
		keys[i] = api.Jwk{
			Kty: api.JwkKty(k.Kty), Crv: api.JwkCrv(k.Crv), X: k.X, Kid: k.Kid, Use: api.JwkUse(k.Use), Alg: api.JwkAlg(k.Alg),
		}
	}
	return api.GetJwks200JSONResponse(api.Jwks{Keys: keys}), nil
}

// IssueServiceToken xử lý POST /internal/v1/service-tokens.
func (h *Handler) IssueServiceToken(_ context.Context, req api.IssueServiceTokenRequestObject) (api.IssueServiceTokenResponseObject, error) {
	b := req.Body
	if b == nil || b.ClientSecret == nil || len(*b.ClientSecret) < 16 || len(*b.ClientSecret) > 512 {
		return nil, fieldErr("client_secret", "phải dài 16–512 ký tự")
	}
	tok, err := h.svc.IssueServiceToken(string(b.Service), string(b.Audience), *b.ClientSecret)
	if err != nil {
		return nil, mapError(err)
	}
	return api.IssueServiceToken200JSONResponse(api.ServiceTokenResponse{
		AccessToken: tok, TokenType: "Bearer", ExpiresIn: int(authx.ServiceTokenTTL.Seconds()),
	}), nil
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
