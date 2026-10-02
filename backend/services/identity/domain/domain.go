// Package domain: thực thể và quy tắc thuần của service `identity` — KHÔNG import HTTP/SQL (docs/09 §14.2).
package domain

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
)

// Lỗi nghiệp vụ. Adapter HTTP ánh xạ sang mã lỗi của contracts/errors.md ở MỘT chỗ.
var (
	ErrInvalidCredentials = errors.New("sai tên đăng nhập hoặc mật khẩu")
	ErrAccountLocked      = errors.New("tài khoản tạm khoá")
	ErrRefreshInvalid     = errors.New("refresh token không hợp lệ")
	// ErrRefreshReused: token đã xoay vòng bị dùng lại — coi là bị đánh cắp, thu hồi cả chuỗi phiên.
	ErrRefreshReused      = errors.New("refresh token bị dùng lại")
	ErrUserNotFound       = errors.New("không tìm thấy người dùng")
	ErrUsernameTaken      = errors.New("tên đăng nhập đã tồn tại")
	ErrServiceCredentials = errors.New("thông tin xác thực dịch vụ không hợp lệ")
)

// Giới hạn đầu vào (khớp schema trong identity-internal.yaml).
const (
	MinPasswordLength = 12 // docs/09 §11.1
	MaxPasswordLength = 256
	MaxUsernameLength = 128
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{2,63}$`)

// User là tài khoản cán bộ. `PasswordHash` là chuỗi PHC Argon2id — không bao giờ ra khỏi service.
type User struct {
	ID           uuid.UUID
	Username     string
	DisplayName  string
	OrgID        string
	Roles        []authx.Role
	PasswordHash string
	LoginState   LoginState
	CreatedAt    time.Time
}

// Actor chuyển User thành danh tính đưa vào access token.
func (u User) Actor() authx.Actor {
	return authx.Actor{ID: u.ID.String(), Roles: u.Roles, OrgID: u.OrgID}
}

// NormalizeUsername chuẩn hoá tên đăng nhập (không phân biệt hoa thường, cắt khoảng trắng).
func NormalizeUsername(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

// Validate kiểm tài khoản trước khi tạo.
func (u User) Validate() error {
	if !usernamePattern.MatchString(u.Username) {
		return fmt.Errorf("tên đăng nhập phải 3–64 ký tự [a-z0-9._-], bắt đầu bằng chữ/số")
	}
	if n := utf8.RuneCountInString(strings.TrimSpace(u.DisplayName)); n == 0 || n > 128 {
		return errors.New("tên hiển thị phải 1–128 ký tự")
	}
	if strings.TrimSpace(u.OrgID) == "" {
		return errors.New("đơn vị (org_id) là bắt buộc")
	}
	if len(u.Roles) == 0 {
		return errors.New("phải có ít nhất một vai trò")
	}
	seen := map[authx.Role]bool{}
	for _, r := range u.Roles {
		if !authx.ValidRole(r) {
			return fmt.Errorf("vai trò %q không hợp lệ", r)
		}
		if seen[r] {
			return fmt.Errorf("vai trò %q bị lặp", r)
		}
		seen[r] = true
	}
	return nil
}

// LoginState là trạng thái chống dò mật khẩu của một tài khoản.
type LoginState struct {
	FailedAttempts int
	LockedUntil    *time.Time
}

// Locked báo tài khoản đang bị khoá tại `now`.
func (s LoginState) Locked(now time.Time) bool {
	return s.LockedUntil != nil && now.Before(*s.LockedUntil)
}

// AfterFailure trả trạng thái sau MỘT lần đăng nhập sai: đủ `max` lần thì khoá `lock`. Khoá đã hết hạn thì
// đếm lại từ đầu (người dùng gõ nhầm 1 lần sau khi hết khoá không bị khoá lại ngay).
func (s LoginState) AfterFailure(now time.Time, maxAttempts int, lock time.Duration) LoginState {
	if s.LockedUntil != nil && !now.Before(*s.LockedUntil) {
		s = LoginState{}
	}
	s.FailedAttempts++
	if s.FailedAttempts >= maxAttempts {
		until := now.Add(lock)
		s.LockedUntil = &until
	}
	return s
}

// RefreshToken là bản ghi một refresh token (CHỈ lưu hash SHA-256 của chuỗi gửi cho client).
type RefreshToken struct {
	ID        uuid.UUID
	FamilyID  uuid.UUID // mọi token xoay vòng từ cùng một lần đăng nhập chung family — thu hồi cả chuỗi khi nghi bị đánh cắp
	UserID    uuid.UUID
	TokenHash []byte
	CreatedAt time.Time
	ExpiresAt time.Time
}
