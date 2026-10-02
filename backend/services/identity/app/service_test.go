package app_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"log/slog"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/adapters/memory"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

const (
	issuer   = "denguesense-identity"
	audience = "denguesense-gateway"
	password = "mat-khau-thu-nghiem-1"
)

var (
	fastParams = domain.PasswordParams{MemoryKiB: 8, Time: 1, Threads: 1, KeyLen: 32, SaltLen: 16}
	t0         = time.Date(2026, 9, 25, 9, 0, 0, 0, time.UTC)
)

type fixture struct {
	svc    *app.Service
	store  *memory.Store
	now    *time.Time
	hasher *domain.Hasher
	pub    authx.StaticKeySet
	logs   *bytes.Buffer
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	pub, priv, err := authx.GenerateKeyPair()
	require.NoError(t, err)
	signer, err := authx.NewEd25519Signer(priv, issuer, audience)
	require.NoError(t, err)
	now := t0
	signer = signer.WithKeyID("k1").WithClock(func() time.Time { return now })

	store := memory.NewStore()
	hasher := domain.NewHasher(fastParams)
	logs := &bytes.Buffer{}
	f := &fixture{store: store, now: &now, hasher: hasher, pub: authx.StaticKeySet{"k1": pub}, logs: logs}
	cfg := app.Config{
		MaxFailedAttempts: 5,
		LockDuration:      15 * time.Minute,
		RefreshTTL:        7 * 24 * time.Hour,
		ServiceSecretHashes: map[string][sha256.Size]byte{
			"gateway":  sha256.Sum256([]byte("bi-mat-gateway-rat-dai-va-ngau-nhien")),
			"forecast": sha256.Sum256([]byte("bi-mat-forecast-rat-dai-va-ngau-nhien")),
		},
		AudiencePolicy: app.DefaultAudiencePolicy(),
	}
	f.svc = app.New(store, memory.Tokens{S: store}, hasher, signer, cfg, func() time.Time { return *f.now }, slog.New(slog.NewJSONHandler(logs, nil)))
	return f
}

func (f *fixture) createUser(t *testing.T, name string, roles ...authx.Role) domain.User {
	t.Helper()
	u, err := f.svc.CreateUser(context.Background(), domain.User{
		Username: name, DisplayName: "Cán bộ " + name, OrgID: "cdc-hcm", Roles: roles,
	}, password, f.hasher)
	require.NoError(t, err)
	return u
}

func (f *fixture) userVerifier(t *testing.T) *authx.Ed25519Verifier {
	t.Helper()
	v, err := authx.NewKeySetVerifier(f.pub, issuer, audience)
	require.NoError(t, err)
	return v.WithClock(func() time.Time { return *f.now })
}

func TestLogin_SuccessIssuesVerifiableTokenAndRefresh(t *testing.T) {
	f := newFixture(t)
	u := f.createUser(t, "can.bo.a", authx.RoleOfficer, authx.RoleViewer)

	s, err := f.svc.Login(context.Background(), "  Can.Bo.A ", password) // tên không phân biệt hoa thường
	require.NoError(t, err)

	actor, err := f.userVerifier(t).Verify(s.AccessToken)
	require.NoError(t, err, "access token phải xác minh được bằng khoá công khai")
	assert.Equal(t, u.ID.String(), actor.ID)
	assert.Equal(t, []authx.Role{authx.RoleOfficer, authx.RoleViewer}, actor.Roles)
	assert.Equal(t, "cdc-hcm", actor.OrgID)

	assert.Equal(t, 900, s.ExpiresIn)
	assert.Equal(t, 7*24*3600, s.RefreshExpiresIn)
	assert.Len(t, s.RefreshToken, 43)
	assert.Equal(t, u.ID, s.User.ID)
}

func TestLogin_UnknownUserAndWrongPasswordGiveTheSameError(t *testing.T) {
	f := newFixture(t)
	f.createUser(t, "can.bo.a", authx.RoleViewer)

	_, errWrong := f.svc.Login(context.Background(), "can.bo.a", "sai-mat-khau-xxxxx")
	_, errUnknown := f.svc.Login(context.Background(), "khong.ton.tai", password)
	assert.ErrorIs(t, errWrong, domain.ErrInvalidCredentials)
	assert.ErrorIs(t, errUnknown, domain.ErrInvalidCredentials)
	assert.Equal(t, errWrong.Error(), errUnknown.Error(), "không được phân biệt hai trường hợp")
}

type countingHasher struct {
	inner  *domain.Hasher
	dummys int
}

func (c *countingHasher) Verify(p, e string) (bool, error) { return c.inner.Verify(p, e) }
func (c *countingHasher) DummyVerify(p string)             { c.dummys++; c.inner.DummyVerify(p) }

func TestLogin_UnknownUserStillSpendsAHashingRound(t *testing.T) {
	f := newFixture(t)
	ch := &countingHasher{inner: f.hasher}
	pub, priv, _ := authx.GenerateKeyPair()
	_ = pub
	signer, _ := authx.NewEd25519Signer(priv, issuer, audience)
	svc := app.New(f.store, memory.Tokens{S: f.store}, ch, signer, app.Config{}, nil, slog.New(slog.NewJSONHandler(&bytes.Buffer{}, nil)))

	_, err := svc.Login(context.Background(), "khong.ton.tai", password)
	assert.ErrorIs(t, err, domain.ErrInvalidCredentials)
	assert.Equal(t, 1, ch.dummys, "chống dò tài khoản qua thời gian phản hồi")
}

func TestLogin_LocksAfterFiveFailuresEvenWithCorrectPasswordThenUnlocks(t *testing.T) {
	f := newFixture(t)
	f.createUser(t, "can.bo.a", authx.RoleViewer)
	ctx := context.Background()

	for i := 1; i <= 5; i++ {
		_, err := f.svc.Login(ctx, "can.bo.a", "sai-mat-khau-xxxxx")
		assert.ErrorIs(t, err, domain.ErrInvalidCredentials, "lần sai thứ %d", i)
	}
	_, err := f.svc.Login(ctx, "can.bo.a", password)
	assert.ErrorIs(t, err, domain.ErrAccountLocked, "đã khoá: đúng mật khẩu cũng không vào được")

	*f.now = t0.Add(14 * time.Minute)
	_, err = f.svc.Login(ctx, "can.bo.a", password)
	assert.ErrorIs(t, err, domain.ErrAccountLocked)

	*f.now = t0.Add(15 * time.Minute)
	_, err = f.svc.Login(ctx, "can.bo.a", password)
	assert.NoError(t, err, "hết khoá thì đăng nhập được")

	// Đăng nhập thành công đặt lại bộ đếm: sai 4 lần nữa vẫn chưa khoá.
	for i := 0; i < 4; i++ {
		_, _ = f.svc.Login(ctx, "can.bo.a", "sai-mat-khau-xxxxx")
	}
	_, err = f.svc.Login(ctx, "can.bo.a", password)
	assert.NoError(t, err)
}

func TestRefresh_RotatesAndOldTokenBecomesUseless(t *testing.T) {
	f := newFixture(t)
	f.createUser(t, "can.bo.a", authx.RoleViewer)
	ctx := context.Background()
	s1, err := f.svc.Login(ctx, "can.bo.a", password)
	require.NoError(t, err)

	*f.now = t0.Add(10 * time.Minute)
	s2, err := f.svc.Refresh(ctx, s1.RefreshToken)
	require.NoError(t, err)
	assert.NotEqual(t, s1.RefreshToken, s2.RefreshToken)
	_, err = f.userVerifier(t).Verify(s2.AccessToken)
	assert.NoError(t, err)

	// Dùng lại token cũ: từ chối VÀ thu hồi cả chuỗi (token mới cũng chết).
	_, err = f.svc.Refresh(ctx, s1.RefreshToken)
	assert.ErrorIs(t, err, domain.ErrRefreshInvalid, "lỗi công khai luôn là refresh_invalid, không lộ 'bị đánh cắp'")
	_, err = f.svc.Refresh(ctx, s2.RefreshToken)
	assert.ErrorIs(t, err, domain.ErrRefreshInvalid, "phát hiện dùng lại phải thu hồi cả chuỗi")
	assert.Contains(t, f.logs.String(), "refresh_token_reuse_detected", "sự kiện đáng ngờ phải để lại dấu vết trong log")
	assert.NotContains(t, f.logs.String(), s1.RefreshToken, "không log refresh token")
}

func TestRefresh_RejectsUnknownAndExpired(t *testing.T) {
	f := newFixture(t)
	f.createUser(t, "can.bo.a", authx.RoleViewer)
	ctx := context.Background()
	s, err := f.svc.Login(ctx, "can.bo.a", password)
	require.NoError(t, err)

	_, err = f.svc.Refresh(ctx, "chuoi-ngau-nhien-khong-phai-token-cua-he-thong")
	assert.ErrorIs(t, err, domain.ErrRefreshInvalid)

	*f.now = t0.Add(7*24*time.Hour + time.Second)
	_, err = f.svc.Refresh(ctx, s.RefreshToken)
	assert.ErrorIs(t, err, domain.ErrRefreshInvalid, "refresh token hết hạn sau 7 ngày")
}

func TestLogout_RevokesTheWholeSessionAndIsIdempotent(t *testing.T) {
	f := newFixture(t)
	f.createUser(t, "can.bo.a", authx.RoleViewer)
	ctx := context.Background()
	s1, _ := f.svc.Login(ctx, "can.bo.a", password)
	s2, err := f.svc.Refresh(ctx, s1.RefreshToken)
	require.NoError(t, err)

	require.NoError(t, f.svc.Logout(ctx, s2.RefreshToken))
	_, err = f.svc.Refresh(ctx, s2.RefreshToken)
	assert.ErrorIs(t, err, domain.ErrRefreshInvalid, "sau đăng xuất không làm mới được nữa")
	assert.NoError(t, f.svc.Logout(ctx, s2.RefreshToken), "đăng xuất lần hai vẫn ổn")
	assert.NoError(t, f.svc.Logout(ctx, "token-khong-ton-tai"))
}

func TestTwoDevicesHaveIndependentSessions(t *testing.T) {
	f := newFixture(t)
	f.createUser(t, "can.bo.a", authx.RoleViewer)
	ctx := context.Background()
	laptop, _ := f.svc.Login(ctx, "can.bo.a", password)
	phone, _ := f.svc.Login(ctx, "can.bo.a", password)

	require.NoError(t, f.svc.Logout(ctx, laptop.RefreshToken))
	_, err := f.svc.Refresh(ctx, phone.RefreshToken)
	assert.NoError(t, err, "đăng xuất ở máy này không đá văng máy kia")
}

func TestIssueServiceToken_ChecksSecretAndAudiencePolicy(t *testing.T) {
	f := newFixture(t)
	sv, err := authx.NewServiceVerifier(f.pub, issuer, "surveillance")
	require.NoError(t, err)
	sv = sv.WithClock(func() time.Time { return *f.now })

	tok, err := f.svc.IssueServiceToken("gateway", "surveillance", "bi-mat-gateway-rat-dai-va-ngau-nhien")
	require.NoError(t, err)
	id, err := sv.Verify(tok)
	require.NoError(t, err)
	assert.Equal(t, "gateway", id.Service)

	for name, args := range map[string][3]string{
		"sai bí mật":                  {"gateway", "surveillance", "bi-mat-sai-xxxxxxxxxxxxxxxxxxxxxx"},
		"bí mật của service khác":     {"gateway", "surveillance", "bi-mat-forecast-rat-dai-va-ngau-nhien"},
		"service lạ":                  {"hacker", "surveillance", "bi-mat-gateway-rat-dai-va-ngau-nhien"},
		"audience ngoài chính sách":   {"forecast", "identity", "bi-mat-forecast-rat-dai-va-ngau-nhien"},
		"service không có chính sách": {"surveillance", "forecast", "gi-cung-duoc-xxxxxxxxxxxxxxxx"},
		"audience lạ":                 {"gateway", "khong-co", "bi-mat-gateway-rat-dai-va-ngau-nhien"},
		"bí mật rỗng":                 {"gateway", "surveillance", ""},
	} {
		_, err := f.svc.IssueServiceToken(args[0], args[1], args[2])
		assert.True(t, errors.Is(err, domain.ErrServiceCredentials), name)
	}

	// forecast được xin token cho surveillance nhưng token đó không dùng được ở forecast.
	fcTok, err := f.svc.IssueServiceToken("forecast", "surveillance", "bi-mat-forecast-rat-dai-va-ngau-nhien")
	require.NoError(t, err)
	other, _ := authx.NewServiceVerifier(f.pub, issuer, "forecast")
	_, err = other.WithClock(func() time.Time { return *f.now }).Verify(fcTok)
	assert.Error(t, err)
}

func TestCreateUser_ValidatesAndRejectsDuplicates(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	f.createUser(t, "can.bo.a", authx.RoleViewer)

	_, err := f.svc.CreateUser(ctx, domain.User{Username: "can.bo.a", DisplayName: "x", OrgID: "o", Roles: []authx.Role{authx.RoleViewer}}, password, f.hasher)
	assert.ErrorIs(t, err, domain.ErrUsernameTaken)
	_, err = f.svc.CreateUser(ctx, domain.User{Username: "Can.Bo.A", DisplayName: "x", OrgID: "o", Roles: []authx.Role{authx.RoleViewer}}, password, f.hasher)
	assert.ErrorIs(t, err, domain.ErrUsernameTaken, "trùng tên không phân biệt hoa thường")
	_, err = f.svc.CreateUser(ctx, domain.User{Username: "khac.ten", DisplayName: "x", OrgID: "o", Roles: []authx.Role{authx.RoleViewer}}, "ngan", f.hasher)
	assert.Error(t, err, "mật khẩu yếu bị từ chối")
	_, err = f.svc.CreateUser(ctx, domain.User{Username: "khac.ten", DisplayName: "x", OrgID: "o", Roles: []authx.Role{"superuser"}}, password, f.hasher)
	assert.Error(t, err, "vai trò lạ bị từ chối")
}

func TestGetUser(t *testing.T) {
	f := newFixture(t)
	u := f.createUser(t, "can.bo.a", authx.RoleViewer)
	got, err := f.svc.GetUser(context.Background(), u.ID)
	require.NoError(t, err)
	assert.Equal(t, "can.bo.a", got.Username)
}
