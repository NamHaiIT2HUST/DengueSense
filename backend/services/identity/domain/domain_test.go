package domain_test

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

var fast = domain.PasswordParams{MemoryKiB: 8, Time: 1, Threads: 1, KeyLen: 32, SaltLen: 16}

func TestPassword_HashVerifyRoundTripAndSalting(t *testing.T) {
	h := domain.NewHasher(fast)
	a, err := h.Hash("mat-khau-du-dai-12")
	require.NoError(t, err)
	b, err := h.Hash("mat-khau-du-dai-12")
	require.NoError(t, err)
	assert.NotEqual(t, a, b, "mỗi lần băm một salt riêng")
	assert.True(t, strings.HasPrefix(a, "$argon2id$v=19$m=8,t=1,p=1$"))

	ok, err := h.Verify("mat-khau-du-dai-12", a)
	require.NoError(t, err)
	assert.True(t, ok)
	ok, err = h.Verify("mat-khau-sai-xxxxx", a)
	require.NoError(t, err)
	assert.False(t, ok)
	ok, err = h.Verify("", a)
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestPassword_PolicyAndDefaultsAreStrong(t *testing.T) {
	h := domain.NewHasher(fast)
	_, err := h.Hash("ngan")
	assert.Error(t, err, "mật khẩu < 12 ký tự bị từ chối (docs/09 §11.1)")
	_, err = h.Hash(strings.Repeat("a", domain.MaxPasswordLength+1))
	assert.Error(t, err)

	// Tham số mặc định không được yếu hơn khuyến nghị tối thiểu của OWASP (m ≥ 19 MiB, t ≥ 2).
	p := domain.DefaultPasswordParams
	assert.GreaterOrEqual(t, p.MemoryKiB, uint32(19*1024))
	assert.GreaterOrEqual(t, p.Time, uint32(2))
}

func TestPassword_VerifyRejectsMalformedOrHostileHashes(t *testing.T) {
	h := domain.NewHasher(fast)
	good, err := h.Hash("mat-khau-du-dai-12")
	require.NoError(t, err)

	for name, enc := range map[string]string{
		"rỗng":             "",
		"không phải argon": "$bcrypt$v=19$m=8,t=1,p=1$c2FsdA$aGFzaA",
		"thiếu phần":       "$argon2id$v=19$m=8,t=1,p=1$c2FsdA",
		"phiên bản lạ":     strings.Replace(good, "v=19", "v=16", 1),
		"tham số hỏng":     strings.Replace(good, "m=8,t=1,p=1", "m=abc", 1),
		"salt hỏng":        "$argon2id$v=19$m=8,t=1,p=1$@@@$aGFzaA",
		"hash hỏng":        "$argon2id$v=19$m=8,t=1,p=1$c2FsdA$@@@",
		"bộ nhớ khổng lồ":  "$argon2id$v=19$m=4194304,t=1,p=1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaA",
		"quá nhiều lượt":   "$argon2id$v=19$m=8,t=99,p=1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaA",
		"m=0":              "$argon2id$v=19$m=0,t=1,p=1$c2FsdA$aGFzaA",
	} {
		ok, err := h.Verify("mat-khau-du-dai-12", enc)
		assert.False(t, ok, name)
		assert.Error(t, err, name+": hash hỏng phải là LỖI, không phải 'sai mật khẩu' lặng lẽ")
	}
	ok, err := h.Verify(strings.Repeat("a", domain.MaxPasswordLength+1), good)
	assert.NoError(t, err)
	assert.False(t, ok, "mật khẩu quá dài bị từ chối nhanh")
}

func TestPassword_DummyVerifyDoesNotPanicAndCostsSimilarTime(t *testing.T) {
	h := domain.NewHasher(domain.PasswordParams{MemoryKiB: 4096, Time: 2, Threads: 1, KeyLen: 32, SaltLen: 16})
	enc, err := h.Hash("mat-khau-du-dai-12")
	require.NoError(t, err)

	timeit := func(f func()) time.Duration {
		best := time.Hour
		for i := 0; i < 3; i++ {
			s := time.Now()
			f()
			if d := time.Since(s); d < best {
				best = d
			}
		}
		return best
	}
	real := timeit(func() { _, _ = h.Verify("khong-dung-mat-khau", enc) })
	dummy := timeit(func() { h.DummyVerify("khong-dung-mat-khau") })
	// Cùng bậc độ lớn (không lộ "tài khoản không tồn tại" qua thời gian): sai khác không quá 3 lần.
	ratio := float64(dummy) / float64(real)
	assert.Greater(t, ratio, 0.33, "dummy=%v real=%v", dummy, real)
	assert.Less(t, ratio, 3.0, "dummy=%v real=%v", dummy, real)
}

func TestRefreshToken_GenerationAndHash(t *testing.T) {
	a, ha, err := domain.NewRefreshToken()
	require.NoError(t, err)
	b, hb, err := domain.NewRefreshToken()
	require.NoError(t, err)
	assert.NotEqual(t, a, b)
	assert.Len(t, a, 43, "256 bit base64url không padding")
	assert.Len(t, ha, 32)
	assert.Equal(t, ha, domain.HashRefreshToken(a), "hash tất định")
	assert.NotEqual(t, ha, hb)
	assert.NotContains(t, string(ha), a, "không lưu chuỗi gốc")
}

func TestLoginState_LocksAfterMaxFailuresAndResetsAfterExpiry(t *testing.T) {
	now := time.Date(2026, 9, 25, 9, 0, 0, 0, time.UTC)
	lock := 15 * time.Minute
	var s domain.LoginState
	for i := 1; i <= 4; i++ {
		s = s.AfterFailure(now, 5, lock)
		assert.Equal(t, i, s.FailedAttempts)
		assert.False(t, s.Locked(now), "chưa đủ 5 lần thì chưa khoá (lần %d)", i)
	}
	s = s.AfterFailure(now, 5, lock)
	assert.True(t, s.Locked(now), "sai lần thứ 5 → khoá")
	assert.True(t, s.Locked(now.Add(14*time.Minute)))
	assert.False(t, s.Locked(now.Add(15*time.Minute)), "hết khoá đúng lúc")

	// Sau khi hết khoá, gõ nhầm MỘT lần chỉ tính lần 1, không bị khoá lại ngay.
	later := now.Add(16 * time.Minute)
	s = s.AfterFailure(later, 5, lock)
	assert.Equal(t, 1, s.FailedAttempts)
	assert.False(t, s.Locked(later))
}

func TestUser_Validate(t *testing.T) {
	ok := domain.User{
		ID: uuid.New(), Username: "can.bo.hcm", DisplayName: "Cán bộ CDC", OrgID: "cdc-hcm",
		Roles: []authx.Role{authx.RoleOfficer, authx.RoleViewer},
	}
	require.NoError(t, ok.Validate())
	assert.Equal(t, authx.Actor{ID: ok.ID.String(), Roles: ok.Roles, OrgID: "cdc-hcm"}, ok.Actor())

	mutate := map[string]func(*domain.User){
		"username ngắn":        func(u *domain.User) { u.Username = "ab" },
		"username in hoa":      func(u *domain.User) { u.Username = "CanBo" },
		"username ký tự lạ":    func(u *domain.User) { u.Username = "can bo" },
		"username bắt đầu '.'": func(u *domain.User) { u.Username = ".canbo" },
		"tên hiển thị rỗng":    func(u *domain.User) { u.DisplayName = "  " },
		"thiếu org":            func(u *domain.User) { u.OrgID = "" },
		"không vai trò":        func(u *domain.User) { u.Roles = nil },
		"vai trò lạ":           func(u *domain.User) { u.Roles = []authx.Role{"superuser"} },
		"vai trò lặp":          func(u *domain.User) { u.Roles = []authx.Role{authx.RoleViewer, authx.RoleViewer} },
	}
	for name, m := range mutate {
		u := ok
		m(&u)
		assert.Error(t, u.Validate(), name)
	}
}

func TestNormalizeUsername(t *testing.T) {
	assert.Equal(t, "can.bo", domain.NormalizeUsername("  Can.Bo "))
}
