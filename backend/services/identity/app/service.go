package app

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

// Config của use case (giá trị đã được adapter đọc/kiểm từ môi trường).
type Config struct {
	MaxFailedAttempts int           // sai bao nhiêu lần thì khoá (docs/09 §11.1: 5)
	LockDuration      time.Duration // khoá bao lâu
	RefreshTTL        time.Duration // hiệu lực refresh token (7 ngày)
	// ServiceSecretHashes: SHA-256 của client_secret riêng từng service (không lưu bí mật gốc).
	ServiceSecretHashes map[string][sha256.Size]byte
	// AudiencePolicy: service nào được xin token cho audience nào (đặc quyền tối thiểu, docs/09 §11.2).
	AudiencePolicy map[string][]string
}

// DefaultAudiencePolicy là chính sách mặc định của Đợt 1. Service không có trong bảng không xin được token nào.
func DefaultAudiencePolicy() map[string][]string {
	return map[string][]string{
		"gateway":       {"identity", "surveillance", "forecast"},
		"forecast":      {"surveillance"},
		"ingest-worker": {"surveillance"},
	}
}

// Session là kết quả đăng nhập / làm mới.
type Session struct {
	AccessToken      string
	ExpiresIn        int
	RefreshToken     string
	RefreshExpiresIn int
	User             domain.User
}

// Service gom các use case của identity.
type Service struct {
	users  UserRepository
	tokens RefreshTokenRepository
	hasher PasswordHasher
	signer *authx.Ed25519Signer
	cfg    Config
	now    func() time.Time
	log    *slog.Logger
}

// New tạo Service. `now` cho phép test điều khiển thời gian.
func New(users UserRepository, tokens RefreshTokenRepository, hasher PasswordHasher, signer *authx.Ed25519Signer, cfg Config, now func() time.Time, log *slog.Logger) *Service {
	if now == nil {
		now = time.Now
	}
	if cfg.MaxFailedAttempts <= 0 {
		cfg.MaxFailedAttempts = 5
	}
	return &Service{users: users, tokens: tokens, hasher: hasher, signer: signer, cfg: cfg, now: now, log: log}
}

// Login xác thực tên đăng nhập + mật khẩu và mở một phiên mới (family refresh token mới).
//
// Chống dò tài khoản: tên không tồn tại và mật khẩu sai cho CÙNG lỗi, và tên không tồn tại vẫn tốn một lần băm.
// Chống dò mật khẩu: đủ MaxFailedAttempts lần sai thì khoá LockDuration (kể cả khi lần sau đúng mật khẩu).
func (s *Service) Login(ctx context.Context, username, password string) (Session, error) {
	u, err := s.users.FindByUsername(ctx, domain.NormalizeUsername(username))
	if errors.Is(err, domain.ErrUserNotFound) {
		s.hasher.DummyVerify(password)
		return Session{}, domain.ErrInvalidCredentials
	}
	if err != nil {
		return Session{}, fmt.Errorf("tìm người dùng: %w", err)
	}

	now := s.now()
	if u.LoginState.Locked(now) {
		return Session{}, domain.ErrAccountLocked
	}

	ok, err := s.hasher.Verify(password, u.PasswordHash)
	if err != nil {
		return Session{}, fmt.Errorf("xác minh mật khẩu: %w", err)
	}
	if !ok {
		if uerr := s.users.UpdateLoginState(ctx, u.ID, func(st domain.LoginState) domain.LoginState {
			return st.AfterFailure(now, s.cfg.MaxFailedAttempts, s.cfg.LockDuration)
		}); uerr != nil {
			return Session{}, fmt.Errorf("ghi lần đăng nhập sai: %w", uerr)
		}
		return Session{}, domain.ErrInvalidCredentials
	}

	if u.LoginState.FailedAttempts > 0 || u.LoginState.LockedUntil != nil {
		if uerr := s.users.UpdateLoginState(ctx, u.ID, func(domain.LoginState) domain.LoginState { return domain.LoginState{} }); uerr != nil {
			return Session{}, fmt.Errorf("đặt lại đếm đăng nhập sai: %w", uerr)
		}
	}
	return s.openSession(ctx, u, uuid.Must(uuid.NewV7()), now)
}

// Refresh đổi refresh token lấy cặp mới (xoay vòng). Token đã dùng bị dùng LẠI → thu hồi cả chuỗi phiên.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (Session, error) {
	now := s.now()
	plain, hash, err := domain.NewRefreshToken()
	if err != nil {
		return Session{}, err
	}
	next := domain.RefreshToken{
		ID:        uuid.Must(uuid.NewV7()),
		TokenHash: hash,
		CreatedAt: now,
		ExpiresAt: now.Add(s.cfg.RefreshTTL),
	}
	userID, err := s.tokens.Rotate(ctx, domain.HashRefreshToken(refreshToken), now, next)
	if errors.Is(err, domain.ErrRefreshReused) {
		s.log.WarnContext(ctx, "refresh_token_reuse_detected", slog.String("hint", "đã thu hồi cả chuỗi phiên"))
		return Session{}, domain.ErrRefreshInvalid
	}
	if err != nil {
		return Session{}, err
	}
	u, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return Session{}, fmt.Errorf("tìm người dùng của phiên: %w", err)
	}
	access, err := s.signer.Sign(u.Actor())
	if err != nil {
		return Session{}, fmt.Errorf("ký access token: %w", err)
	}
	return s.session(u, access, plain), nil
}

// Logout thu hồi cả chuỗi phiên của refresh token; idempotent.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	return s.tokens.RevokeFamilyByHash(ctx, domain.HashRefreshToken(refreshToken), s.now())
}

// GetUser trả thông tin người dùng.
func (s *Service) GetUser(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return s.users.FindByID(ctx, id)
}

// IssueServiceToken cấp token dịch vụ 5 phút. Sai bí mật, service lạ, hoặc audience ngoài chính sách đều cho
// CÙNG một lỗi (không cho biết cái nào sai) và luôn tốn một lần so sánh.
func (s *Service) IssueServiceToken(service, audience, clientSecret string) (string, error) {
	got := sha256.Sum256([]byte(clientSecret))
	want, known := s.cfg.ServiceSecretHashes[service]
	secretOK := subtle.ConstantTimeCompare(got[:], want[:]) == 1 && known
	allowed := slices.Contains(s.cfg.AudiencePolicy[service], audience)
	if !secretOK || !allowed {
		return "", domain.ErrServiceCredentials
	}
	return s.signer.SignService(service, audience)
}

// CreateUser băm mật khẩu và tạo tài khoản (dùng bởi lệnh `identity create-user` và test).
func (s *Service) CreateUser(ctx context.Context, u domain.User, password string, hasher interface {
	Hash(string) (string, error)
}) (domain.User, error) {
	u.Username = domain.NormalizeUsername(u.Username)
	if err := u.Validate(); err != nil {
		return domain.User{}, err
	}
	hash, err := hasher.Hash(password)
	if err != nil {
		return domain.User{}, err
	}
	u.ID = uuid.Must(uuid.NewV7())
	u.PasswordHash = hash
	u.CreatedAt = s.now()
	if err := s.users.Create(ctx, u); err != nil {
		return domain.User{}, err
	}
	return u, nil
}

func (s *Service) openSession(ctx context.Context, u domain.User, family uuid.UUID, now time.Time) (Session, error) {
	plain, hash, err := domain.NewRefreshToken()
	if err != nil {
		return Session{}, err
	}
	if err := s.tokens.Create(ctx, domain.RefreshToken{
		ID:        uuid.Must(uuid.NewV7()),
		FamilyID:  family,
		UserID:    u.ID,
		TokenHash: hash,
		CreatedAt: now,
		ExpiresAt: now.Add(s.cfg.RefreshTTL),
	}); err != nil {
		return Session{}, fmt.Errorf("lưu refresh token: %w", err)
	}
	access, err := s.signer.Sign(u.Actor())
	if err != nil {
		return Session{}, fmt.Errorf("ký access token: %w", err)
	}
	return s.session(u, access, plain), nil
}

func (s *Service) session(u domain.User, access, refresh string) Session {
	return Session{
		AccessToken:      access,
		ExpiresIn:        int(authx.AccessTokenTTL / time.Second),
		RefreshToken:     refresh,
		RefreshExpiresIn: int(s.cfg.RefreshTTL / time.Second),
		User:             u,
	}
}
