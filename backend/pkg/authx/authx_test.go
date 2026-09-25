package authx_test

import (
	"crypto/ed25519"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/httpx"
)

const (
	iss = "denguesense-identity"
	aud = "denguesense-gateway"
)

var t0 = time.Date(2026, 9, 25, 2, 0, 0, 0, time.UTC)

func setup(t *testing.T) (*authx.Ed25519Signer, *authx.Ed25519Verifier, ed25519.PrivateKey, ed25519.PublicKey) {
	t.Helper()
	pub, priv, err := authx.GenerateKeyPair()
	require.NoError(t, err)
	s, err := authx.NewEd25519Signer(priv, iss, aud)
	require.NoError(t, err)
	v, err := authx.NewEd25519Verifier(pub, iss, aud)
	require.NoError(t, err)
	return s.WithClock(func() time.Time { return t0 }), v.WithClock(func() time.Time { return t0 }), priv, pub
}

func officer() authx.Actor {
	return authx.Actor{ID: "0192f3a1-0000-7000-8000-000000000001", Roles: []authx.Role{authx.RoleOfficer, authx.RoleViewer}, OrgID: "cdc-hcm"}
}

func TestSignVerify_RoundTrip(t *testing.T) {
	s, v, _, _ := setup(t)
	tok, err := s.Sign(officer())
	require.NoError(t, err)

	got, err := v.Verify(tok)
	require.NoError(t, err)
	assert.Equal(t, officer(), got)
	assert.True(t, got.Has(authx.RoleOfficer))
	assert.False(t, got.Has(authx.RoleApprover, authx.RoleAdmin))
}

func TestVerify_RejectsExpiredButAllowsSmallClockSkew(t *testing.T) {
	s, v, _, _ := setup(t)
	tok, err := s.Sign(officer())
	require.NoError(t, err)

	within := v.WithClock(func() time.Time { return t0.Add(authx.AccessTokenTTL + 3*time.Second) })
	_, err = within.Verify(tok)
	assert.NoError(t, err, "lệch đồng hồ nhỏ (≤ 5 giây) được chấp nhận")

	expired := v.WithClock(func() time.Time { return t0.Add(authx.AccessTokenTTL + time.Minute) })
	_, err = expired.Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken)
}

func TestVerify_RejectsWrongKeyIssuerAudience(t *testing.T) {
	s, _, _, pub := setup(t)
	tok, err := s.Sign(officer())
	require.NoError(t, err)
	clock := func() time.Time { return t0 }

	// Đối chứng: đúng khoá/issuer/audience thì hợp lệ — để các ca sai bên dưới có ý nghĩa.
	good, _ := authx.NewEd25519Verifier(pub, iss, aud)
	_, err = good.WithClock(clock).Verify(tok)
	require.NoError(t, err)

	otherPub, _, _ := authx.GenerateKeyPair()
	wrongKey, _ := authx.NewEd25519Verifier(otherPub, iss, aud)
	_, err = wrongKey.WithClock(clock).Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "khoá khác")

	wrongIss, _ := authx.NewEd25519Verifier(pub, "ke-gia-mao", aud)
	_, err = wrongIss.WithClock(clock).Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "issuer khác")

	wrongAud, _ := authx.NewEd25519Verifier(pub, iss, "service-khac")
	_, err = wrongAud.WithClock(clock).Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "audience khác (token của service khác)")
}

func TestVerify_RejectsAlgNoneAndHS256(t *testing.T) {
	_, v, priv, _ := setup(t)
	claimsMap := jwt.MapClaims{
		"sub": "u1", "roles": []string{"viewer"}, "iss": iss, "aud": aud,
		"iat": t0.Unix(), "exp": t0.Add(time.Hour).Unix(),
	}

	none, err := jwt.NewWithClaims(jwt.SigningMethodNone, claimsMap).SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)
	_, err = v.Verify(none)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "alg=none phải bị từ chối")

	// Tấn công đổi thuật toán: ký HS256 bằng chính khoá công khai làm bí mật.
	hs, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claimsMap).SignedString([]byte(priv.Public().(ed25519.PublicKey)))
	require.NoError(t, err)
	_, err = v.Verify(hs)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "HS256 phải bị từ chối")
}

func TestVerify_RequiresExpirySubjectAndKnownRoles(t *testing.T) {
	_, v, priv, _ := setup(t)
	sign := func(m jwt.MapClaims) string {
		tok, err := jwt.NewWithClaims(jwt.SigningMethodEdDSA, m).SignedString(priv)
		require.NoError(t, err)
		return tok
	}
	base := func() jwt.MapClaims {
		return jwt.MapClaims{"sub": "u1", "roles": []string{"viewer"}, "iss": iss, "aud": aud, "iat": t0.Unix(), "exp": t0.Add(time.Hour).Unix()}
	}

	_, err := v.Verify(sign(base()))
	require.NoError(t, err, "token nền phải hợp lệ để các ca dưới có ý nghĩa")

	noExp := base()
	delete(noExp, "exp")
	_, err = v.Verify(sign(noExp))
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "thiếu exp")

	noSub := base()
	delete(noSub, "sub")
	_, err = v.Verify(sign(noSub))
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "thiếu sub")

	noRoles := base()
	noRoles["roles"] = []string{}
	_, err = v.Verify(sign(noRoles))
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "không có vai trò")

	badRole := base()
	badRole["roles"] = []string{"viewer", "superuser"}
	_, err = v.Verify(sign(badRole))
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "vai trò lạ")
}

func TestVerify_GarbageAndTamperedTokens(t *testing.T) {
	s, v, _, _ := setup(t)
	for _, bad := range []string{"", "abc", "a.b.c", "....", strings.Repeat("x", 500)} {
		_, err := v.Verify(bad)
		assert.ErrorIs(t, err, authx.ErrInvalidToken, bad)
	}
	tok, _ := s.Sign(officer())
	parts := strings.Split(tok, ".")
	tampered := parts[0] + "." + base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"attacker","roles":["admin"],"iss":"`+iss+`","aud":["`+aud+`"],"exp":9999999999}`)) + "." + parts[2]
	_, err := v.Verify(tampered)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "sửa payload phải làm hỏng chữ ký")
}

func TestSignerRejectsInvalidActor(t *testing.T) {
	s, _, _, _ := setup(t)
	_, err := s.Sign(authx.Actor{ID: "", Roles: []authx.Role{authx.RoleViewer}})
	assert.Error(t, err)
	_, err = s.Sign(authx.Actor{ID: "u"})
	assert.Error(t, err)
}

func TestKeyParsing(t *testing.T) {
	pub, priv, err := authx.GenerateKeyPair()
	require.NoError(t, err)

	gotPub, err := authx.ParsePublicKey(authx.EncodeKey(pub))
	require.NoError(t, err)
	assert.True(t, pub.Equal(gotPub))
	gotPriv, err := authx.ParsePrivateKey(authx.EncodeKey(priv))
	require.NoError(t, err)
	assert.True(t, priv.Equal(gotPriv))

	for _, bad := range []string{"", "khong-phai-base64!!", authx.EncodeKey([]byte("ngan"))} {
		_, err = authx.ParsePublicKey(bad)
		assert.Error(t, err, bad)
		_, err = authx.ParsePrivateKey(bad)
		assert.Error(t, err, bad)
	}
	// Lỗi không được chứa nội dung khoá.
	_, err = authx.ParsePublicKey("MAT-KHAU-BI-MAT-NHUNG-KHONG-PHAI-KHOA")
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "MAT-KHAU")
}

// ---- Middleware ----

func isPublic(method, fullPath string) bool { return method == "POST" && fullPath == "/login" }

func routerWith(v authx.Verifier) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.ContextWithFallback = true
	guard := authx.Middleware(v, isPublic)
	r.POST("/login", guard, func(c *gin.Context) { c.String(200, "public") })
	r.GET("/login", guard, func(c *gin.Context) { c.String(200, "lọt") }) // cùng đường dẫn, khác method
	r.GET("/me", guard, func(c *gin.Context) {
		a, ok := authx.ActorFrom(c) // *gin.Context dùng như context.Context
		if !ok {
			c.String(500, "không có actor")
			return
		}
		c.String(200, a.ID)
	})
	r.POST("/approve", guard, func(c *gin.Context) {
		if err := authx.RequireRoles(c, authx.RoleApprover); err != nil {
			httpx.WriteProblem(c, httpx.AsError(err))
			return
		}
		c.String(200, "đã duyệt")
	})
	// Route mới quên khai báo: KHÔNG có trong danh sách công khai ⇒ phải bị bảo vệ mặc định.
	r.GET("/route-moi-quen-khai-bao", guard, func(c *gin.Context) { c.String(200, "lọt") })
	return r
}

func call(r http.Handler, method, path, authz string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if authz != "" {
		req.Header.Set("Authorization", authz)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestMiddleware_FailClosedExceptPublicRoutes(t *testing.T) {
	s, v, _, _ := setup(t)
	r := routerWith(v)
	tok, err := s.Sign(officer())
	require.NoError(t, err)

	assert.Equal(t, 200, call(r, "POST", "/login", "").Code, "route công khai không cần token")

	w0 := call(r, "GET", "/route-moi-quen-khai-bao", "")
	assert.Equal(t, 401, w0.Code, "route không khai báo công khai phải bị bảo vệ mặc định")
	assert.NotContains(t, w0.Body.String(), "lọt")
	assert.Equal(t, 401, call(r, "GET", "/login", "").Code, "đúng đường dẫn nhưng sai method không được hưởng ngoại lệ")

	w := call(r, "GET", "/me", "")
	assert.Equal(t, 401, w.Code)
	assert.Contains(t, w.Header().Get("WWW-Authenticate"), "Bearer")
	assert.Contains(t, w.Body.String(), "common.unauthenticated")

	assert.Equal(t, 401, call(r, "GET", "/me", "Bearer rac").Code)
	assert.Equal(t, 401, call(r, "GET", "/me", "Basic "+tok).Code)

	w = call(r, "GET", "/me", "Bearer "+tok)
	require.Equal(t, 200, w.Code)
	assert.Equal(t, officer().ID, w.Body.String())
}

func TestRequireRoles_ForbidsWithoutRole(t *testing.T) {
	s, v, _, _ := setup(t)
	r := routerWith(v)

	officerTok, _ := s.Sign(officer())
	w := call(r, "POST", "/approve", "Bearer "+officerTok)
	assert.Equal(t, 403, w.Code)
	assert.Contains(t, w.Body.String(), "common.forbidden")

	approverTok, _ := s.Sign(authx.Actor{ID: "u2", Roles: []authx.Role{authx.RoleApprover}})
	assert.Equal(t, 200, call(r, "POST", "/approve", "Bearer "+approverTok).Code)
}

func TestRequireRoles_WithoutActorIs401NotPass(t *testing.T) {
	// Handler chạy mà không có Actor (vd bị đăng ký ngoài nhóm có middleware): RequireRoles phải
	// từ chối (401), không được cho qua.
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.ContextWithFallback = true
	r.POST("/ngoai-nhom-bao-ve", func(c *gin.Context) {
		if err := authx.RequireRoles(c, authx.RoleAdmin); err != nil {
			httpx.WriteProblem(c, httpx.AsError(err))
			return
		}
		c.String(200, "lọt")
	})
	w := call(r, "POST", "/ngoai-nhom-bao-ve", "")
	assert.Equal(t, 401, w.Code)
	assert.NotContains(t, w.Body.String(), "lọt")
}
