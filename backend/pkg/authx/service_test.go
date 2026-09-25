package authx_test

import (
	"crypto/ed25519"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
)

const svcAud = "forecast"

type keys struct {
	signer *authx.Ed25519Signer
	pub    ed25519.PublicKey
	set    authx.StaticKeySet
}

func newKeys(t *testing.T, kid string) keys {
	t.Helper()
	pub, priv, err := authx.GenerateKeyPair()
	require.NoError(t, err)
	s, err := authx.NewEd25519Signer(priv, iss, aud)
	require.NoError(t, err)
	return keys{
		signer: s.WithKeyID(kid).WithClock(func() time.Time { return t0 }),
		pub:    pub,
		set:    authx.StaticKeySet{kid: pub},
	}
}

func svcVerifier(t *testing.T, ks authx.KeySet, audience string) *authx.ServiceVerifier {
	t.Helper()
	v, err := authx.NewServiceVerifier(ks, iss, audience)
	require.NoError(t, err)
	return v.WithClock(func() time.Time { return t0 })
}

func TestServiceToken_RoundTripAndTTL(t *testing.T) {
	k := newKeys(t, "k1")
	tok, err := k.signer.SignService("gateway", svcAud)
	require.NoError(t, err)

	id, err := svcVerifier(t, k.set, svcAud).Verify(tok)
	require.NoError(t, err)
	assert.Equal(t, "gateway", id.Service)

	late := svcVerifier(t, k.set, svcAud).WithClock(func() time.Time { return t0.Add(authx.ServiceTokenTTL + time.Minute) })
	_, err = late.Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "token dịch vụ hết hạn sau 5 phút")
	assert.Equal(t, 5*time.Minute, authx.ServiceTokenTTL)
}

func TestServiceToken_OnlyAcceptedByTheAudienceItWasIssuedFor(t *testing.T) {
	k := newKeys(t, "k1")
	tok, err := k.signer.SignService("gateway", "surveillance")
	require.NoError(t, err)
	_, err = svcVerifier(t, k.set, "forecast").Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "token cấp cho surveillance không dùng được ở forecast")
	_, err = svcVerifier(t, k.set, "surveillance").Verify(tok)
	assert.NoError(t, err)
}

func TestUserAndServiceTokensCannotBeConfused(t *testing.T) {
	k := newKeys(t, "k1")
	userTok, err := k.signer.Sign(officer())
	require.NoError(t, err)
	svcTok, err := k.signer.SignService("gateway", aud) // cùng audience với token người dùng để thử làm lẫn

	require.NoError(t, err)

	// Token người dùng KHÔNG được chấp nhận làm token dịch vụ.
	_, err = svcVerifier(t, k.set, aud).Verify(userTok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken)

	// Token dịch vụ KHÔNG được chấp nhận làm token người dùng (dù cùng audience và chữ ký hợp lệ).
	uv, err := authx.NewKeySetVerifier(k.set, iss, aud)
	require.NoError(t, err)
	_, err = uv.WithClock(func() time.Time { return t0 }).Verify(svcTok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken)
}

func TestKeySetVerifier_SelectsByKidAndRejectsUnknownOrMissing(t *testing.T) {
	old := newKeys(t, "k-old")
	cur := newKeys(t, "k-new")
	both := authx.StaticKeySet{"k-old": old.pub, "k-new": cur.pub}
	v, err := authx.NewKeySetVerifier(both, iss, aud)
	require.NoError(t, err)
	v = v.WithClock(func() time.Time { return t0 })

	for name, k := range map[string]keys{"khoá cũ": old, "khoá mới": cur} {
		tok, err := k.signer.Sign(officer())
		require.NoError(t, err)
		_, err = v.Verify(tok)
		assert.NoError(t, err, "xoay khoá: %s vẫn hợp lệ khi còn trong tập", name)
	}

	// kid lạ
	stranger := newKeys(t, "k-lạ")
	tok, _ := stranger.signer.Sign(officer())
	_, err = v.Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken)

	// Thiếu kid: không được thử từng khoá.
	noKid := old.signer.WithKeyID("")
	tok, _ = noKid.Sign(officer())
	_, err = v.Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken)

	// kid của khoá này nhưng chữ ký của khoá khác.
	forged := cur.signer.WithKeyID("k-old")
	tok, _ = forged.Sign(officer())
	_, err = v.Verify(tok)
	assert.ErrorIs(t, err, authx.ErrInvalidToken, "kid trỏ khoá khác thì chữ ký không khớp")
}

func TestJWKS_RoundTripAndStrictValidation(t *testing.T) {
	a := newKeys(t, "k1")
	b := newKeys(t, "k2")
	jwks := authx.NewJWKS(map[string]ed25519.PublicKey{"k2": b.pub, "k1": a.pub})
	require.Len(t, jwks.Keys, 2)
	assert.Equal(t, "k1", jwks.Keys[0].Kid, "sắp theo kid để đầu ra ổn định")
	assert.Equal(t, "OKP", jwks.Keys[0].Kty)
	assert.Equal(t, "EdDSA", jwks.Keys[0].Alg)

	set, err := jwks.KeySet()
	require.NoError(t, err)
	assert.True(t, a.pub.Equal(set["k1"]))
	assert.True(t, b.pub.Equal(set["k2"]))

	// Token ký bằng signer verify được qua KeySet dựng từ JWKS.
	tok, _ := a.signer.Sign(officer())
	v, _ := authx.NewKeySetVerifier(set, iss, aud)
	_, err = v.WithClock(func() time.Time { return t0 }).Verify(tok)
	assert.NoError(t, err)

	for name, mutate := range map[string]func(*authx.JWKS){
		"kty sai":   func(j *authx.JWKS) { j.Keys[0].Kty = "RSA" },
		"crv sai":   func(j *authx.JWKS) { j.Keys[0].Crv = "P-256" },
		"alg sai":   func(j *authx.JWKS) { j.Keys[0].Alg = "RS256" },
		"use sai":   func(j *authx.JWKS) { j.Keys[0].Use = "enc" },
		"x hỏng":    func(j *authx.JWKS) { j.Keys[0].X = "@@@" },
		"x ngắn":    func(j *authx.JWKS) { j.Keys[0].X = "YWJj" },
		"thiếu kid": func(j *authx.JWKS) { j.Keys[0].Kid = "" },
		"kid trùng": func(j *authx.JWKS) { j.Keys[1].Kid = j.Keys[0].Kid },
	} {
		cp := authx.NewJWKS(map[string]ed25519.PublicKey{"k1": a.pub, "k2": b.pub})
		mutate(&cp)
		_, err := cp.KeySet()
		assert.Error(t, err, name)
	}
	_, err = authx.JWKS{}.KeySet()
	assert.Error(t, err, "JWKS rỗng")
}

// ---- ServiceMiddleware ----

func serviceRouter(v *authx.ServiceVerifier) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.ContextWithFallback = true
	isPublic := func(method, path string) bool { return method == "GET" && path == "/jwks" }
	guard := authx.ServiceMiddleware(v, isPublic)
	r.GET("/jwks", guard, func(c *gin.Context) {
		_, hasActor := authx.ActorFrom(c)
		_, hasSvc := authx.ServiceFrom(c)
		c.JSON(200, gin.H{"actor": hasActor, "service": hasSvc})
	})
	r.GET("/data", guard, func(c *gin.Context) {
		svc, _ := authx.ServiceFrom(c)
		actor, ok := authx.ActorFrom(c)
		c.JSON(200, gin.H{"service": svc.Service, "has_actor": ok, "actor": actor.ID, "roles": actor.Roles, "org": actor.OrgID})
	})
	return r
}

func callWith(r http.Handler, path string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", path, nil)
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestServiceMiddleware_AuthAndActorTrust(t *testing.T) {
	k := newKeys(t, "k1")
	r := serviceRouter(svcVerifier(t, k.set, svcAud))
	svcTok, _ := k.signer.SignService("gateway", svcAud)
	userTok, _ := k.signer.Sign(officer())

	// Thiếu token / token người dùng / token sai audience → 401, không lộ dữ liệu.
	assert.Equal(t, 401, callWith(r, "/data", nil).Code)
	assert.Equal(t, 401, callWith(r, "/data", map[string]string{"Authorization": "Bearer " + userTok}).Code)
	other, _ := k.signer.SignService("gateway", "surveillance")
	assert.Equal(t, 401, callWith(r, "/data", map[string]string{"Authorization": "Bearer " + other}).Code)

	// Header X-Actor-* KHÔNG có token dịch vụ → vẫn 401 (không ai tự nhận danh tính).
	w := callWith(r, "/data", map[string]string{authx.HeaderActorID: "admin-1", authx.HeaderActorRoles: "admin"})
	assert.Equal(t, 401, w.Code)

	// Token dịch vụ hợp lệ, không actor.
	w = callWith(r, "/data", map[string]string{"Authorization": "Bearer " + svcTok})
	require.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), `"service":"gateway"`)
	assert.Contains(t, w.Body.String(), `"has_actor":false`)

	// Token dịch vụ + actor: actor được đưa vào context.
	w = callWith(r, "/data", map[string]string{
		"Authorization":        "Bearer " + svcTok,
		authx.HeaderActorID:    "user-7",
		authx.HeaderActorRoles: "viewer, analyst",
		authx.HeaderOrgID:      "cdc-hcm",
	})
	require.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), `"actor":"user-7"`)
	assert.Contains(t, w.Body.String(), `"roles":["viewer","analyst"]`)
	assert.Contains(t, w.Body.String(), `"org":"cdc-hcm"`)
}

func TestServiceMiddleware_RejectsMalformedActorHeaders(t *testing.T) {
	k := newKeys(t, "k1")
	r := serviceRouter(svcVerifier(t, k.set, svcAud))
	svcTok, _ := k.signer.SignService("gateway", svcAud)
	auth := "Bearer " + svcTok

	for name, hdr := range map[string]map[string]string{
		"vai trò lạ":    {authx.HeaderActorID: "u", authx.HeaderActorRoles: "viewer,superuser"},
		"thiếu vai trò": {authx.HeaderActorID: "u"},
		"vai trò rỗng":  {authx.HeaderActorID: "u", authx.HeaderActorRoles: " , "},
	} {
		hdr["Authorization"] = auth
		w := callWith(r, "/data", hdr)
		assert.Equal(t, 400, w.Code, name)
		assert.Contains(t, w.Body.String(), "common.validation_error", name)
	}
}

func TestServiceMiddleware_PublicRouteIgnoresActorHeaders(t *testing.T) {
	k := newKeys(t, "k1")
	r := serviceRouter(svcVerifier(t, k.set, svcAud))
	w := callWith(r, "/jwks", map[string]string{authx.HeaderActorID: "attacker", authx.HeaderActorRoles: "admin"})
	require.Equal(t, 200, w.Code)
	assert.Contains(t, w.Body.String(), `"actor":false`, "route công khai không được tin header X-Actor-*")
	assert.Contains(t, w.Body.String(), `"service":false`)
}
