// Package authx: xác thực JWT (EdDSA) và phân quyền theo vai trò (docs/09 §11, ADR-0005).
//
// Hai loại token, KHÔNG dùng lẫn được:
//   - token NGƯỜI DÙNG (access token, 15 phút): có `roles`, `aud` = gateway; cấp bởi `identity` khi đăng nhập;
//   - token DỊCH VỤ (5 phút): `typ=service`, `sub` = tên service gọi, `aud` = service đích; dùng cho lời gọi nội bộ.
//
// `identity` dùng Signer để cấp token; mọi service khác dùng Verifier/ServiceVerifier + Middleware để xác minh.
// Luật cứng: chỉ chấp nhận thuật toán EdDSA (chặn tấn công đổi thuật toán / alg=none), bắt buộc có exp, iss, aud
// và sub. Token người dùng không có vai trò nào bị coi là không hợp lệ; token dịch vụ không được là token người dùng.
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

// AccessTokenTTL là hiệu lực access token người dùng (docs/09 §11.1).
const AccessTokenTTL = 15 * time.Minute

// ServiceTokenTTL là hiệu lực token dịch vụ (docs/09 §11.2).
const ServiceTokenTTL = 5 * time.Minute

const (
	clockLeeway      = 5 * time.Second
	tokenTypeService = "service"
)

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

// ValidRole báo vai trò có thuộc tập đã định nghĩa không.
func ValidRole(r Role) bool {
	_, ok := validRoles[r]
	return ok
}

// Actor là người dùng đã xác thực.
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

// ServiceIdentity là service đã xác thực bằng token dịch vụ.
type ServiceIdentity struct {
	Service string
}

type claims struct {
	Roles []string `json:"roles,omitempty"`
	OrgID string   `json:"org_id,omitempty"`
	Typ   string   `json:"typ,omitempty"`
	jwt.RegisteredClaims
}

// ErrInvalidToken là lỗi chung cho mọi token không hợp lệ — cố ý không phân biệt nguyên nhân
// với bên ngoài để không giúp kẻ tấn công dò (nguyên nhân chi tiết chỉ nằm trong lỗi bọc, dùng cho log).
var ErrInvalidToken = errors.New("token không hợp lệ")

// KeySet tra khoá công khai theo `kid` (hỗ trợ xoay khoá: nhiều khoá cùng hiệu lực).
type KeySet interface {
	Key(kid string) (ed25519.PublicKey, bool)
}

// StaticKeySet là KeySet cố định trong bộ nhớ.
type StaticKeySet map[string]ed25519.PublicKey

// Key trả khoá theo kid.
func (s StaticKeySet) Key(kid string) (ed25519.PublicKey, bool) {
	k, ok := s[kid]
	return k, ok
}

// verifierBase gom phần phân tích/kiểm chữ ký dùng chung cho token người dùng và token dịch vụ.
type verifierBase struct {
	keyFunc  jwt.Keyfunc
	issuer   string
	audience string
	now      func() time.Time
}

func newBase(keyFunc jwt.Keyfunc, issuer, audience string) (verifierBase, error) {
	if issuer == "" || audience == "" {
		return verifierBase{}, errors.New("issuer và audience là bắt buộc")
	}
	return verifierBase{keyFunc: keyFunc, issuer: issuer, audience: audience, now: time.Now}, nil
}

func singleKeyFunc(pub ed25519.PublicKey) (jwt.Keyfunc, error) {
	if len(pub) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("khoá công khai Ed25519 phải dài %d byte", ed25519.PublicKeySize)
	}
	return func(*jwt.Token) (any, error) { return pub, nil }, nil
}

// keySetFunc chọn khoá theo `kid` trong header; thiếu/lạ kid → từ chối (không thử mọi khoá).
func keySetFunc(ks KeySet) jwt.Keyfunc {
	return func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("thiếu kid")
		}
		key, ok := ks.Key(kid)
		if !ok {
			return nil, errors.New("kid không có trong tập khoá")
		}
		return key, nil
	}
}

func (b verifierBase) parse(token string) (*claims, error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{jwt.SigningMethodEdDSA.Alg()}),
		jwt.WithIssuer(b.issuer),
		jwt.WithAudience(b.audience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(clockLeeway),
		jwt.WithTimeFunc(b.now),
	)
	var c claims
	if _, err := parser.ParseWithClaims(token, &c, b.keyFunc); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}
	if c.Subject == "" {
		return nil, fmt.Errorf("%w: thiếu sub", ErrInvalidToken)
	}
	return &c, nil
}

// Verifier xác minh access token NGƯỜI DÙNG.
type Verifier interface {
	Verify(token string) (Actor, error)
}

// Ed25519Verifier xác minh token người dùng ký EdDSA.
type Ed25519Verifier struct {
	verifierBase
}

// NewEd25519Verifier tạo Verifier với MỘT khoá công khai (bỏ qua kid); issuer/audience bắt buộc khớp.
func NewEd25519Verifier(pub ed25519.PublicKey, issuer, audience string) (*Ed25519Verifier, error) {
	kf, err := singleKeyFunc(pub)
	if err != nil {
		return nil, err
	}
	base, err := newBase(kf, issuer, audience)
	if err != nil {
		return nil, err
	}
	return &Ed25519Verifier{base}, nil
}

// NewKeySetVerifier tạo Verifier chọn khoá theo `kid` (dùng với JWKS của identity).
func NewKeySetVerifier(ks KeySet, issuer, audience string) (*Ed25519Verifier, error) {
	base, err := newBase(keySetFunc(ks), issuer, audience)
	if err != nil {
		return nil, err
	}
	return &Ed25519Verifier{base}, nil
}

// WithClock thay đồng hồ (test).
func (v *Ed25519Verifier) WithClock(now func() time.Time) *Ed25519Verifier {
	cp := *v
	cp.now = now
	return &cp
}

// Verify kiểm chữ ký, thuật toán, exp/iss/aud/sub, vai trò hợp lệ; từ chối token dịch vụ.
func (v *Ed25519Verifier) Verify(token string) (Actor, error) {
	c, err := v.parse(token)
	if err != nil {
		return Actor{}, err
	}
	if c.Typ == tokenTypeService {
		return Actor{}, fmt.Errorf("%w: token dịch vụ không dùng như token người dùng", ErrInvalidToken)
	}
	if len(c.Roles) == 0 {
		return Actor{}, fmt.Errorf("%w: thiếu vai trò", ErrInvalidToken)
	}
	roles := make([]Role, 0, len(c.Roles))
	for _, r := range c.Roles {
		role := Role(r)
		if !ValidRole(role) {
			return Actor{}, fmt.Errorf("%w: vai trò lạ", ErrInvalidToken)
		}
		roles = append(roles, role)
	}
	return Actor{ID: c.Subject, Roles: roles, OrgID: c.OrgID}, nil
}

// ServiceVerifier xác minh token DỊCH VỤ; `audience` là tên service đang chạy (chỉ nhận token gửi cho mình).
type ServiceVerifier struct {
	verifierBase
}

// NewServiceVerifier tạo ServiceVerifier.
func NewServiceVerifier(ks KeySet, issuer, audience string) (*ServiceVerifier, error) {
	base, err := newBase(keySetFunc(ks), issuer, audience)
	if err != nil {
		return nil, err
	}
	return &ServiceVerifier{base}, nil
}

// WithClock thay đồng hồ (test).
func (v *ServiceVerifier) WithClock(now func() time.Time) *ServiceVerifier {
	cp := *v
	cp.now = now
	return &cp
}

// Verify kiểm token dịch vụ: đúng chữ ký/aud/iss/exp, `typ=service`, có `sub`; từ chối token người dùng.
func (v *ServiceVerifier) Verify(token string) (ServiceIdentity, error) {
	c, err := v.parse(token)
	if err != nil {
		return ServiceIdentity{}, err
	}
	if c.Typ != tokenTypeService {
		return ServiceIdentity{}, fmt.Errorf("%w: không phải token dịch vụ", ErrInvalidToken)
	}
	return ServiceIdentity{Service: c.Subject}, nil
}

// Ed25519Signer cấp token (dùng bởi `identity` và công cụ dev/test).
type Ed25519Signer struct {
	key      ed25519.PrivateKey
	kid      string
	issuer   string
	audience string
	ttl      time.Duration
	now      func() time.Time
}

// NewEd25519Signer tạo Signer với TTL mặc định AccessTokenTTL. `audience` là audience của token NGƯỜI DÙNG.
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

// WithTTL đổi hiệu lực token người dùng (test).
func (s *Ed25519Signer) WithTTL(ttl time.Duration) *Ed25519Signer {
	cp := *s
	cp.ttl = ttl
	return &cp
}

// WithKeyID đặt `kid` vào header mọi token cấp ra (để verifier chọn đúng khoá khi xoay khoá).
func (s *Ed25519Signer) WithKeyID(kid string) *Ed25519Signer {
	cp := *s
	cp.kid = kid
	return &cp
}

// PublicKey trả khoá công khai tương ứng (để công bố qua JWKS).
func (s *Ed25519Signer) PublicKey() ed25519.PublicKey {
	pub, _ := s.key.Public().(ed25519.PublicKey)
	return pub
}

// KeyID trả kid đang dùng.
func (s *Ed25519Signer) KeyID() string { return s.kid }

func (s *Ed25519Signer) sign(c claims) (string, error) {
	tok := jwt.NewWithClaims(jwt.SigningMethodEdDSA, c)
	if s.kid != "" {
		tok.Header["kid"] = s.kid
	}
	return tok.SignedString(s.key)
}

// Sign cấp token NGƯỜI DÙNG cho actor.
func (s *Ed25519Signer) Sign(a Actor) (string, error) {
	if a.ID == "" || len(a.Roles) == 0 {
		return "", errors.New("actor phải có ID và ít nhất một vai trò")
	}
	roles := make([]string, len(a.Roles))
	for i, r := range a.Roles {
		roles[i] = string(r)
	}
	now := s.now().UTC()
	return s.sign(claims{
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
}

// SignService cấp token DỊCH VỤ (5 phút): `sub` = service gọi, `aud` = service đích.
func (s *Ed25519Signer) SignService(service, audience string) (string, error) {
	if service == "" || audience == "" {
		return "", errors.New("service và audience là bắt buộc")
	}
	now := s.now().UTC()
	return s.sign(claims{
		Typ: tokenTypeService,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   service,
			Issuer:    s.issuer,
			Audience:  jwt.ClaimStrings{audience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ServiceTokenTTL)),
			ID:        uuid.Must(uuid.NewV7()).String(),
		},
	})
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
