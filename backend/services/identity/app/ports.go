// Package app: use case của service `identity`. Chỉ biết domain và các PORT (interface) — không biết HTTP hay SQL.
package app

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

// UserRepository là kho tài khoản.
type UserRepository interface {
	// FindByUsername trả domain.ErrUserNotFound nếu không có. `username` đã được chuẩn hoá.
	FindByUsername(ctx context.Context, username string) (domain.User, error)
	FindByID(ctx context.Context, id uuid.UUID) (domain.User, error)
	// UpdateLoginState đọc trạng thái chống dò mật khẩu dưới KHOÁ dòng, áp `fn`, ghi lại — nguyên tử,
	// để hai lần đăng nhập sai song song không làm mất lượt đếm.
	UpdateLoginState(ctx context.Context, id uuid.UUID, fn func(domain.LoginState) domain.LoginState) error
	// Create thêm tài khoản; trả domain.ErrUsernameTaken nếu trùng.
	Create(ctx context.Context, u domain.User) error
}

// RefreshTokenRepository là kho refresh token (chỉ lưu HASH).
type RefreshTokenRepository interface {
	Create(ctx context.Context, t domain.RefreshToken) error
	// Rotate nguyên tử: đánh dấu token cũ (theo hash) đã dùng và ghi token kế tiếp cùng family/user.
	// Trả (userID, nil) khi thành công. Lỗi: domain.ErrRefreshInvalid (không có / hết hạn / đã thu hồi);
	// domain.ErrRefreshReused (đã dùng rồi — kho PHẢI thu hồi cả family trước khi trả lỗi này).
	Rotate(ctx context.Context, oldHash []byte, now time.Time, next domain.RefreshToken) (uuid.UUID, error)
	// RevokeFamilyByHash thu hồi cả chuỗi phiên chứa token này; idempotent (không có token cũng không lỗi).
	RevokeFamilyByHash(ctx context.Context, hash []byte, now time.Time) error
}

// PasswordHasher xác minh mật khẩu. DummyVerify tốn thời gian tương đương Verify (chống dò tài khoản qua thời gian).
type PasswordHasher interface {
	Verify(password, encoded string) (bool, error)
	DummyVerify(password string)
}
