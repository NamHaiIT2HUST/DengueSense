// Package repotest: bộ kiểm thử HỢP ĐỒNG cho các repository của identity. Chạy cho MỌI hiện thực (memory, postgres) để
// hai bên không lệch hành vi — đặc biệt các ngữ nghĩa dễ sai: xoay vòng refresh, phát hiện dùng lại, khoá đăng nhập.
package repotest

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/app"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

// Repos là cặp repository cần kiểm.
type Repos struct {
	Users  app.UserRepository
	Tokens app.RefreshTokenRepository
}

var t0 = time.Date(2026, 9, 25, 9, 0, 0, 0, time.UTC)

// NewUser dựng một User hợp lệ (băm mật khẩu giả để không tốn thời gian Argon2).
func NewUser(name string) domain.User {
	return domain.User{ //nolint:gosec // G101: hash Argon2id GIẢ dùng cho test, không phải bí mật
		ID:           uuid.Must(uuid.NewV7()),
		Username:     name,
		DisplayName:  "Cán bộ " + name,
		OrgID:        "cdc-test",
		Roles:        []authx.Role{authx.RoleOfficer, authx.RoleViewer},
		PasswordHash: "$argon2id$v=19$m=8,t=1,p=1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaA",
		CreatedAt:    t0,
	}
}

func token(user, family uuid.UUID, hash byte, expires time.Time) domain.RefreshToken {
	h := make([]byte, 32)
	for i := range h {
		h[i] = hash
	}
	return domain.RefreshToken{
		ID: uuid.Must(uuid.NewV7()), FamilyID: family, UserID: user, TokenHash: h, CreatedAt: t0, ExpiresAt: expires,
	}
}

func hashOf(b byte) []byte { return token(uuid.Nil, uuid.Nil, b, t0).TokenHash }

// Run chạy toàn bộ bộ kiểm; `newRepos` trả kho SẠCH cho mỗi test con.
func Run(t *testing.T, newRepos func(t *testing.T) Repos) {
	t.Run("người dùng: tạo, tìm, trùng tên", func(t *testing.T) {
		r := newRepos(t)
		ctx := context.Background()
		u := NewUser("can.bo.a")
		require.NoError(t, r.Users.Create(ctx, u))

		got, err := r.Users.FindByUsername(ctx, "can.bo.a")
		require.NoError(t, err)
		assert.Equal(t, u.ID, got.ID)
		assert.Equal(t, u.Roles, got.Roles, "thứ tự vai trò được giữ")
		assert.Equal(t, u.OrgID, got.OrgID)
		assert.Equal(t, u.PasswordHash, got.PasswordHash)

		byID, err := r.Users.FindByID(ctx, u.ID)
		require.NoError(t, err)
		assert.Equal(t, "can.bo.a", byID.Username)

		dup := NewUser("can.bo.a")
		assert.ErrorIs(t, r.Users.Create(ctx, dup), domain.ErrUsernameTaken)

		_, err = r.Users.FindByUsername(ctx, "khong.co")
		assert.ErrorIs(t, err, domain.ErrUserNotFound)
		_, err = r.Users.FindByID(ctx, uuid.New())
		assert.ErrorIs(t, err, domain.ErrUserNotFound)
	})

	t.Run("người dùng: cập nhật trạng thái đăng nhập nguyên tử (không mất lượt đếm khi song song)", func(t *testing.T) {
		r := newRepos(t)
		ctx := context.Background()
		u := NewUser("can.bo.b")
		require.NoError(t, r.Users.Create(ctx, u))

		const n = 8
		var wg sync.WaitGroup
		errs := make(chan error, n)
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				errs <- r.Users.UpdateLoginState(ctx, u.ID, func(s domain.LoginState) domain.LoginState {
					return s.AfterFailure(t0, 100, time.Minute)
				})
			}()
		}
		wg.Wait()
		close(errs)
		for err := range errs {
			require.NoError(t, err)
		}
		got, err := r.Users.FindByID(ctx, u.ID)
		require.NoError(t, err)
		assert.Equal(t, n, got.LoginState.FailedAttempts, "mọi lượt sai song song đều được đếm")

		lockUntil := t0.Add(15 * time.Minute)
		require.NoError(t, r.Users.UpdateLoginState(ctx, u.ID, func(domain.LoginState) domain.LoginState {
			return domain.LoginState{FailedAttempts: 5, LockedUntil: &lockUntil}
		}))
		got, _ = r.Users.FindByID(ctx, u.ID)
		require.NotNil(t, got.LoginState.LockedUntil)
		assert.True(t, lockUntil.Equal(*got.LoginState.LockedUntil))
		assert.True(t, got.LoginState.Locked(t0))

		require.NoError(t, r.Users.UpdateLoginState(ctx, u.ID, func(domain.LoginState) domain.LoginState { return domain.LoginState{} }))
		got, _ = r.Users.FindByID(ctx, u.ID)
		assert.Equal(t, domain.LoginState{}, got.LoginState)

		assert.ErrorIs(t, r.Users.UpdateLoginState(ctx, uuid.New(), func(s domain.LoginState) domain.LoginState { return s }), domain.ErrUserNotFound)
	})

	t.Run("refresh: xoay vòng thành công giữ family và user", func(t *testing.T) {
		r := newRepos(t)
		ctx := context.Background()
		u := NewUser("can.bo.c")
		require.NoError(t, r.Users.Create(ctx, u))
		family := uuid.Must(uuid.NewV7())
		require.NoError(t, r.Tokens.Create(ctx, token(u.ID, family, 1, t0.Add(time.Hour))))

		next := token(uuid.Nil, uuid.Nil, 2, t0.Add(time.Hour))
		uid, err := r.Tokens.Rotate(ctx, hashOf(1), t0.Add(time.Minute), next)
		require.NoError(t, err)
		assert.Equal(t, u.ID, uid)

		// Token kế tiếp dùng được (cùng family, cùng user).
		uid, err = r.Tokens.Rotate(ctx, hashOf(2), t0.Add(2*time.Minute), token(uuid.Nil, uuid.Nil, 3, t0.Add(time.Hour)))
		require.NoError(t, err)
		assert.Equal(t, u.ID, uid)
	})

	t.Run("refresh: token lạ, hết hạn → invalid", func(t *testing.T) {
		r := newRepos(t)
		ctx := context.Background()
		u := NewUser("can.bo.d")
		require.NoError(t, r.Users.Create(ctx, u))
		require.NoError(t, r.Tokens.Create(ctx, token(u.ID, uuid.Must(uuid.NewV7()), 1, t0.Add(time.Hour))))

		_, err := r.Tokens.Rotate(ctx, hashOf(9), t0, token(uuid.Nil, uuid.Nil, 8, t0.Add(time.Hour)))
		assert.ErrorIs(t, err, domain.ErrRefreshInvalid, "token không tồn tại")

		_, err = r.Tokens.Rotate(ctx, hashOf(1), t0.Add(time.Hour), token(uuid.Nil, uuid.Nil, 8, t0.Add(2*time.Hour)))
		assert.ErrorIs(t, err, domain.ErrRefreshInvalid, "đúng thời điểm hết hạn là hết hạn")

		// Token hết hạn không bị coi là "đã dùng": vẫn chỉ là invalid, lần sau vẫn invalid (không kích hoạt thu hồi).
		_, err = r.Tokens.Rotate(ctx, hashOf(1), t0.Add(2*time.Hour), token(uuid.Nil, uuid.Nil, 7, t0.Add(3*time.Hour)))
		assert.ErrorIs(t, err, domain.ErrRefreshInvalid)
	})

	t.Run("refresh: dùng LẠI token đã xoay vòng → reused và thu hồi cả family", func(t *testing.T) {
		r := newRepos(t)
		ctx := context.Background()
		u := NewUser("can.bo.e")
		require.NoError(t, r.Users.Create(ctx, u))
		family := uuid.Must(uuid.NewV7())
		require.NoError(t, r.Tokens.Create(ctx, token(u.ID, family, 1, t0.Add(time.Hour))))

		_, err := r.Tokens.Rotate(ctx, hashOf(1), t0.Add(time.Minute), token(uuid.Nil, uuid.Nil, 2, t0.Add(time.Hour)))
		require.NoError(t, err)

		// Kẻ trộm (hoặc client lỗi) dùng lại token số 1.
		_, err = r.Tokens.Rotate(ctx, hashOf(1), t0.Add(2*time.Minute), token(uuid.Nil, uuid.Nil, 3, t0.Add(time.Hour)))
		assert.ErrorIs(t, err, domain.ErrRefreshReused)

		// Token số 2 (của người dùng thật) cũng bị thu hồi → buộc đăng nhập lại.
		_, err = r.Tokens.Rotate(ctx, hashOf(2), t0.Add(3*time.Minute), token(uuid.Nil, uuid.Nil, 4, t0.Add(time.Hour)))
		assert.ErrorIs(t, err, domain.ErrRefreshInvalid, "cả chuỗi đã bị thu hồi")
		// Token số 3 (do lần dùng lại) không được tạo ra.
		_, err = r.Tokens.Rotate(ctx, hashOf(3), t0.Add(3*time.Minute), token(uuid.Nil, uuid.Nil, 5, t0.Add(time.Hour)))
		assert.ErrorIs(t, err, domain.ErrRefreshInvalid)
	})

	t.Run("refresh: family khác không bị ảnh hưởng khi thu hồi", func(t *testing.T) {
		r := newRepos(t)
		ctx := context.Background()
		u := NewUser("can.bo.f")
		require.NoError(t, r.Users.Create(ctx, u))
		require.NoError(t, r.Tokens.Create(ctx, token(u.ID, uuid.Must(uuid.NewV7()), 1, t0.Add(time.Hour))))
		require.NoError(t, r.Tokens.Create(ctx, token(u.ID, uuid.Must(uuid.NewV7()), 2, t0.Add(time.Hour)))) // thiết bị thứ hai

		require.NoError(t, r.Tokens.RevokeFamilyByHash(ctx, hashOf(1), t0))
		_, err := r.Tokens.Rotate(ctx, hashOf(1), t0.Add(time.Minute), token(uuid.Nil, uuid.Nil, 8, t0.Add(time.Hour)))
		assert.ErrorIs(t, err, domain.ErrRefreshInvalid)
		_, err = r.Tokens.Rotate(ctx, hashOf(2), t0.Add(time.Minute), token(uuid.Nil, uuid.Nil, 9, t0.Add(time.Hour)))
		assert.NoError(t, err, "phiên ở thiết bị khác vẫn dùng được")
	})

	t.Run("refresh: đăng xuất idempotent", func(t *testing.T) {
		r := newRepos(t)
		ctx := context.Background()
		assert.NoError(t, r.Tokens.RevokeFamilyByHash(ctx, hashOf(42), t0), "token không tồn tại cũng không lỗi")
		u := NewUser("can.bo.g")
		require.NoError(t, r.Users.Create(ctx, u))
		require.NoError(t, r.Tokens.Create(ctx, token(u.ID, uuid.Must(uuid.NewV7()), 1, t0.Add(time.Hour))))
		require.NoError(t, r.Tokens.RevokeFamilyByHash(ctx, hashOf(1), t0))
		assert.NoError(t, r.Tokens.RevokeFamilyByHash(ctx, hashOf(1), t0.Add(time.Minute)), "thu hồi lần hai vẫn ổn")
	})

	t.Run("refresh: hai lần xoay vòng SONG SONG cùng một token → đúng một lần thành công", func(t *testing.T) {
		r := newRepos(t)
		ctx := context.Background()
		u := NewUser("can.bo.h")
		require.NoError(t, r.Users.Create(ctx, u))
		require.NoError(t, r.Tokens.Create(ctx, token(u.ID, uuid.Must(uuid.NewV7()), 1, t0.Add(time.Hour))))

		var wg sync.WaitGroup
		results := make(chan error, 2)
		for i := byte(0); i < 2; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				_, err := r.Tokens.Rotate(ctx, hashOf(1), t0.Add(time.Minute), token(uuid.Nil, uuid.Nil, 10+i, t0.Add(time.Hour)))
				results <- err
			}()
		}
		wg.Wait()
		close(results)
		var ok, reused int
		for err := range results {
			switch {
			case err == nil:
				ok++
			case assert.ErrorIs(t, err, domain.ErrRefreshReused):
				reused++
			}
		}
		assert.Equal(t, 1, ok, "chỉ MỘT lần xoay vòng thành công")
		assert.Equal(t, 1, reused, "lần còn lại bị coi là dùng lại")
	})
}
