package domain

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// PasswordParams là tham số Argon2id. Mặc định theo OWASP (bộ nhớ lớn hơn mức tối thiểu 19 MiB).
type PasswordParams struct {
	MemoryKiB uint32
	Time      uint32
	Threads   uint8
	KeyLen    uint32
	SaltLen   uint32
}

// DefaultPasswordParams: 64 MiB, 3 lượt, 2 luồng. Đăng nhập bị giới hạn tần suất ở gateway (docs/09 §11.6).
var DefaultPasswordParams = PasswordParams{MemoryKiB: 64 * 1024, Time: 3, Threads: 2, KeyLen: 32, SaltLen: 16}

// Chặn tham số từ hash trong DB quá lớn (DB bị sửa độc hại có thể làm cạn RAM khi xác minh).
const (
	maxMemoryKiB = 512 * 1024
	maxTime      = 10
	maxThreads   = 16
	maxKeyLen    = 64
)

// Hasher băm và xác minh mật khẩu bằng Argon2id, định dạng PHC.
type Hasher struct {
	params PasswordParams
}

// NewHasher tạo Hasher.
func NewHasher(p PasswordParams) *Hasher { return &Hasher{params: p} }

// Hash băm mật khẩu (kiểm chính sách độ dài tối thiểu). Định dạng: $argon2id$v=19$m=…,t=…,p=…$salt$hash.
func (h *Hasher) Hash(password string) (string, error) {
	if len(password) < MinPasswordLength {
		return "", fmt.Errorf("mật khẩu phải có ít nhất %d ký tự", MinPasswordLength)
	}
	if len(password) > MaxPasswordLength {
		return "", fmt.Errorf("mật khẩu tối đa %d ký tự", MaxPasswordLength)
	}
	salt := make([]byte, h.params.SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("sinh salt: %w", err)
	}
	key := argon2.IDKey([]byte(password), salt, h.params.Time, h.params.MemoryKiB, h.params.Threads, h.params.KeyLen)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, h.params.MemoryKiB, h.params.Time, h.params.Threads,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), nil
}

// Verify so mật khẩu với hash PHC bằng so sánh thời gian hằng. Hash hỏng/tham số lạ → lỗi (KHÔNG coi là đúng).
func (h *Hasher) Verify(password, encoded string) (bool, error) {
	if len(password) > MaxPasswordLength {
		return false, nil
	}
	parts := strings.Split(encoded, "$")
	// ["", "argon2id", "v=19", "m=..,t=..,p=..", salt, hash]
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, errors.New("hash mật khẩu không đúng định dạng argon2id")
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return false, errors.New("phiên bản argon2 không được hỗ trợ")
	}
	var mem, t uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &mem, &t, &threads); err != nil {
		return false, errors.New("tham số argon2 không đọc được")
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) == 0 {
		return false, errors.New("salt không hợp lệ")
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(want) == 0 || len(want) > maxKeyLen {
		return false, errors.New("hash không hợp lệ")
	}
	if mem == 0 || mem > maxMemoryKiB || t == 0 || t > maxTime || threads == 0 || threads > maxThreads {
		return false, errors.New("tham số argon2 ngoài giới hạn cho phép")
	}
	// len(want) đã bị chặn ≤ maxKeyLen ở trên nên chuyển sang uint32 không tràn.
	got := argon2.IDKey([]byte(password), salt, t, mem, threads, uint32(len(want))) //nolint:gosec // G115: đã giới hạn ≤ maxKeyLen
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}

// DummyVerify chạy MỘT lần băm Argon2id cùng tham số khi tên đăng nhập KHÔNG tồn tại, để thời gian phản hồi tương
// đương Verify thật — tránh lộ "tài khoản có tồn tại không" qua thời gian.
func (h *Hasher) DummyVerify(password string) {
	salt := make([]byte, h.params.SaltLen)
	_ = argon2.IDKey([]byte(password), salt, h.params.Time, h.params.MemoryKiB, h.params.Threads, h.params.KeyLen)
}

// NewRefreshToken sinh refresh token: chuỗi ngẫu nhiên 256-bit gửi cho client và hash SHA-256 để LƯU.
func NewRefreshToken() (plain string, hash []byte, err error) {
	raw := make([]byte, 32)
	if _, err = rand.Read(raw); err != nil {
		return "", nil, fmt.Errorf("sinh refresh token: %w", err)
	}
	plain = base64.RawURLEncoding.EncodeToString(raw)
	return plain, HashRefreshToken(plain), nil
}

// HashRefreshToken là SHA-256 của chuỗi refresh token (đủ an toàn vì chuỗi có entropy 256-bit, không cần KDF chậm).
func HashRefreshToken(plain string) []byte {
	sum := sha256.Sum256([]byte(plain))
	return sum[:]
}
