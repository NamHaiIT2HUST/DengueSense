// Package authx: xác thực JWT (EdDSA) và phân quyền theo vai trò (docs/09 §11, ADR-0005).
//
// `identity` dùng Signer để cấp token; mọi service khác dùng Verifier + Middleware để xác minh.
// Luật cứng: chỉ chấp nhận thuật toán EdDSA (chặn tấn công đổi thuật toán / alg=none), bắt buộc có
// exp, iss, aud và sub. Token không có vai trò nào bị coi là không hợp lệ.
package authx

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// AccessTokenTTL là hiệu lực access token (docs/09 §11.1).
const AccessTokenTTL = 15 * time.Minute

const clockLeeway = 5 * time.Second

// Role khớp enum `Role` trong contracts/openapi/public-v1.yaml.
type Role string

const (
	RoleViewer      Role = "viewer"
	RoleAnalyst     Role = "analyst"
	RoleOfficer     Role = "officer"
	RoleApprover    Role = "approver"
	RoleDataManager Role = "data_manager"
	RoleAdmin       Role = "admin"
)

var validRoles = map[Role]struct{}{
	RoleViewer: {}, RoleAnalyst: {}, RoleOfficer: {}, RoleApprover: {}, RoleDataManager: {}, RoleAdmin: {},
}

// Actor là người dùng (hoặc dịch vụ) đã xác thực.
type Actor struct {
	ID    string
	Roles []Role
	OrgID string
}

// Has báo Actor có ÍT NHẤT MỘT trong các vai trò.
func (a Actor) Has(roles ...Role) bool {
	for _, want := range roles {
		for _, have := range a.Roles {
			if have == want {
				return true
			}
		}
	}
	return false
}

type claims struct {
	Roles []string `json:"roles"`
	OrgID string   `json:"org_id"`
	jwt.RegisteredClaims
}

// ErrInvalidToken là lỗi chung cho mọi token không hợp lệ — cố ý không phân biệt nguyên nhân
// với bên ngoài để không giúp kẻ tấn công dò (nguyên nhân chi tiết chỉ nằm trong lỗi bọc, dùng cho log).
var ErrInvalidToken = errors.New("token không hợp lệ")

// Verifier xác minh access token.
type Verifier interface {
	Verify(token string) (Actor, error)
}

// Ed25519Verifier xác minh token ký EdDSA.
type Ed25519Verifier struct {
	key      ed25519.PublicKey
	issuer   string
	audience string
	now      func() time.Time
}

// NewEd25519Verifier tạo Verifier; issuer/audience bắt buộc khớp.
func NewEd25519Verifier(pub ed25519.PublicKey, issuer, audience string) (*Ed25519Verifier, error) {
	if len(pub) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("khoá công khai Ed25519 phải dài %d byte", ed25519.PublicKeySize)
	}
	if issuer == "" || audience == "" {
		return nil, errors.New("issuer và audience là bắt buộc")
	}
	return &Ed25519Verifier{key: pub, issuer: issuer, audience: audience, now: time.Now}, nil
}

// WithClock thay đồng hồ (test).
func (v *Ed25519Verifier) WithClock(now func() time.Time) *Ed25519Verifier {
	cp := *v
	cp.now = now
	return &cp
}

// Verify kiểm chữ ký, thuật toán, exp/iss/aud/sub, vai trò hợp lệ.
func (v *Ed25519Verifier) Verify(token string) (Actor, error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodEdDSA.Alg()}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.audience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(clockLeeway),
		jwt.WithTimeFunc(v.now),
	)
	var c claims
	if _, err := parser.ParseWithClaims(token, &c, func(*jwt.Token) (any, error) { return v.key, nil }); err != nil {
		return Actor{}, fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}
	if c.Subject == "" {
		return Actor{}, fmt.Errorf("%w: thiếu sub", ErrInvalidToken)
	}
	if len(c.Roles) == 0 {
		return Actor{}, fmt.Errorf("%w: thiếu vai trò", ErrInvalidToken)
	}
	roles := make([]Role, 0, len(c.Roles))
	for _, r := range c.Roles {
		role := Role(r)
		if _, ok := validRoles[role]; !ok {
			return Actor{}, fmt.Errorf("%w: vai trò lạ", ErrInvalidToken)
		}
		roles = append(roles, role)
	}
	return Actor{ID: c.Subject, Roles: roles, OrgID: c.OrgID}, nil
}

// Ed25519Signer cấp token (dùng bởi `identity` và công cụ dev/test).
type Ed25519Signer struct {
	key      ed25519.PrivateKey
	issuer   string
	audience string
	ttl      time.Duration
	now      func() time.Time
}

// NewEd25519Signer tạo Signer với TTL mặc định AccessTokenTTL.
func NewEd25519Signer(priv ed25519.PrivateKey, issuer, audience string) (*Ed25519Signer, error) {
	if len(priv) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("khoá riêng Ed25519 phải dài %d byte", ed25519.PrivateKeySize)
	}
	if issuer == "" || audience == "" {
		return nil, errors.New("issuer và audience là bắt buộc")
	}
	return &Ed25519Signer{key: priv, issuer: issuer, audience: audience, ttl: AccessTokenTTL, now: time.Now}, nil
}

// WithClock thay đồng hồ (test).
func (s *Ed25519Signer) WithClock(now func() time.Time) *Ed25519Signer {
	cp := *s
	cp.now = now
	return &cp
}

// WithTTL đổi hiệu lực token (test / token dịch vụ 5 phút).
func (s *Ed25519Signer) WithTTL(ttl time.Duration) *Ed25519Signer {
	cp := *s
	cp.ttl = ttl
	return &cp
}

// Sign cấp token cho actor.
func (s *Ed25519Signer) Sign(a Actor) (string, error) {
	if a.ID == "" || len(a.Roles) == 0 {
		return "", errors.New("actor phải có ID và ít nhất một vai trò")
	}
	roles := make([]string, len(a.Roles))
	for i, r := range a.Roles {
		roles[i] = string(r)
	}
	now := s.now().UTC()
	tok := jwt.NewWithClaims(jwt.SigningMethodEdDSA, claims{
		Roles: roles,
		OrgID: a.OrgID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   a.ID,
			Issuer:    s.issuer,
			Audience:  jwt.ClaimStrings{s.audience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
			ID:        uuid.Must(uuid.NewV7()).String(),
		},
	})
	return tok.SignedString(s.key)
}

// GenerateKeyPair sinh cặp khoá Ed25519.
func GenerateKeyPair() (ed25519.PublicKey, ed25519.PrivateKey, error) {
	return ed25519.GenerateKey(rand.Reader)
}

// EncodeKey mã hoá khoá thô sang base64 chuẩn (dùng làm giá trị biến môi trường).
func EncodeKey(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

// ParsePublicKey đọc khoá công khai Ed25519 từ base64 (32 byte thô).
func ParsePublicKey(b64 string) (ed25519.PublicKey, error) {
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil || len(raw) != ed25519.PublicKeySize {
		return nil, errors.New("khoá công khai Ed25519 không hợp lệ (cần base64 của 32 byte)")
	}
	return ed25519.PublicKey(raw), nil
}

// ParsePrivateKey đọc khoá riêng Ed25519 từ base64 (64 byte thô).
func ParsePrivateKey(b64 string) (ed25519.PrivateKey, error) {
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil || len(raw) != ed25519.PrivateKeySize {
		return nil, errors.New("khoá riêng Ed25519 không hợp lệ (cần base64 của 64 byte)")
	}
	return ed25519.PrivateKey(raw), nil
}
