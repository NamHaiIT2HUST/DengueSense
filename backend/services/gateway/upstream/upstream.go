// Package upstream là phía gọi ra của gateway: token dịch vụ, JWKS của identity và HTTP client tới các service.
package upstream

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/obsx"
)

// Tên service đích (cũng là `aud` của token dịch vụ).
const (
	Identity     = "identity"
	Surveillance = "surveillance"
	Forecast     = "forecast"
)

const (
	maxResponseBytes = 16 << 20 // ranh giới bản đồ có thể vài MB
	tokenSkew        = 30 * time.Second
)

// TokenSource xin và cache token dịch vụ của gateway cho từng service đích (docs/09 §11.2).
type TokenSource struct {
	identityURL string
	secret      string
	client      *http.Client
	now         func() time.Time

	mu    sync.Mutex
	cache map[string]cachedToken
}

type cachedToken struct {
	token   string
	expires time.Time
}

// NewTokenSource dựng nguồn token. `secret` là client_secret RIÊNG của gateway (không log, không đưa vào lỗi).
func NewTokenSource(identityURL, secret string, client *http.Client) *TokenSource {
	return &TokenSource{
		identityURL: strings.TrimRight(identityURL, "/"),
		secret:      secret,
		client:      client,
		now:         time.Now,
		cache:       map[string]cachedToken{},
	}
}

// Token trả token còn hạn cho `audience`, xin mới khi sắp hết hạn.
func (t *TokenSource) Token(ctx context.Context, audience string) (string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if c, ok := t.cache[audience]; ok && t.now().Before(c.expires.Add(-tokenSkew)) {
		return c.token, nil
	}
	body, err := json.Marshal(map[string]string{"service": "gateway", "audience": audience, "client_secret": t.secret})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.identityURL+"/internal/v1/service-tokens", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := t.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("xin token dịch vụ: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("xin token dịch vụ: identity trả %d", resp.StatusCode)
	}
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&out); err != nil || out.AccessToken == "" {
		return "", errors.New("xin token dịch vụ: phản hồi không hợp lệ")
	}
	t.cache[audience] = cachedToken{token: out.AccessToken, expires: t.now().Add(time.Duration(out.ExpiresIn) * time.Second)}
	return out.AccessToken, nil
}

// Client gọi các service nội bộ bằng token dịch vụ + danh tính người dùng gốc.
type Client struct {
	bases  map[string]string
	tokens *TokenSource
	http   *http.Client
	log    *slog.Logger
}

// NewClient dựng client; `bases` ánh xạ tên service → URL gốc.
func NewClient(bases map[string]string, tokens *TokenSource, client *http.Client, log *slog.Logger) *Client {
	trimmed := make(map[string]string, len(bases))
	for k, v := range bases {
		trimmed[k] = strings.TrimRight(v, "/")
	}
	return &Client{bases: trimmed, tokens: tokens, http: client, log: log}
}

// Request là một lời gọi tới service nội bộ.
type Request struct {
	Service string
	Method  string
	Path    string // ví dụ /internal/v1/provinces
	Query   string // đã mã hoá, không có dấu ?
	Body    []byte
	Actor   *authx.Actor
	Headers map[string]string // header thêm (Idempotency-Key…)
}

// Response là phản hồi thô của service.
type Response struct {
	Status int
	Header http.Header
	Body   []byte
}

// ErrUnavailable: không gọi được service hoặc service trả lỗi không thuộc hợp đồng (5xx, token dịch vụ bị từ chối).
// Người gọi đổi thành 503 chuẩn — không lộ chi tiết nội bộ ra ngoài.
var ErrUnavailable = errors.New("service phụ thuộc không khả dụng")

// Do gửi request. Lỗi mạng, 5xx, và 401 từ service không phải identity (nghĩa là gateway cấu hình sai) → ErrUnavailable.
func (c *Client) Do(ctx context.Context, r Request) (*Response, error) {
	base, ok := c.bases[r.Service]
	if !ok {
		return nil, fmt.Errorf("service %q chưa cấu hình", r.Service)
	}
	token, err := c.tokens.Token(ctx, r.Service)
	if err != nil {
		c.log.ErrorContext(ctx, "không lấy được token dịch vụ", "service", r.Service, "error", err.Error())
		return nil, ErrUnavailable
	}
	url := base + r.Path
	if r.Query != "" {
		url += "?" + r.Query
	}
	var body io.Reader
	if r.Body != nil {
		body = bytes.NewReader(r.Body)
	}
	req, err := http.NewRequestWithContext(ctx, r.Method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	if r.Body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if a := r.Actor; a != nil {
		roles := make([]string, len(a.Roles))
		for i, role := range a.Roles {
			roles[i] = string(role)
		}
		req.Header.Set(authx.HeaderActorID, a.ID)
		req.Header.Set(authx.HeaderActorRoles, strings.Join(roles, ","))
		if a.OrgID != "" {
			req.Header.Set(authx.HeaderOrgID, a.OrgID)
		}
	}
	for k, v := range r.Headers {
		req.Header.Set(k, v)
	}
	if rid := obsx.RequestID(ctx); rid != "" {
		req.Header.Set("X-Request-ID", rid)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		c.log.WarnContext(ctx, "gọi service thất bại", "service", r.Service, "error", err.Error())
		return nil, ErrUnavailable
	}
	defer func() { _ = resp.Body.Close() }()
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil || len(data) > maxResponseBytes {
		c.log.WarnContext(ctx, "đọc phản hồi service thất bại", "service", r.Service)
		return nil, ErrUnavailable
	}
	if resp.StatusCode >= 500 || (resp.StatusCode == http.StatusUnauthorized && r.Service != Identity) {
		c.log.WarnContext(ctx, "service trả lỗi ngoài hợp đồng", "service", r.Service, "status", resp.StatusCode)
		return nil, ErrUnavailable
	}
	return &Response{Status: resp.StatusCode, Header: resp.Header, Body: data}, nil
}

// RemoteKeySet là KeySet lấy từ JWKS của identity, làm mới định kỳ và khi gặp kid lạ (xoay khoá).
type RemoteKeySet struct {
	url    string
	client *http.Client
	log    *slog.Logger
	now    func() time.Time

	mu        sync.RWMutex
	keys      authx.StaticKeySet
	lastFetch time.Time
}

const minRefreshGap = 10 * time.Second

// NewRemoteKeySet dựng KeySet; gọi Refresh (hoặc Run) để nạp khoá.
func NewRemoteKeySet(identityURL string, client *http.Client, log *slog.Logger) *RemoteKeySet {
	return &RemoteKeySet{
		url:    strings.TrimRight(identityURL, "/") + "/internal/v1/.well-known/jwks.json",
		client: client,
		log:    log,
		now:    time.Now,
	}
}

// WithClock thay đồng hồ (test giới hạn tần suất làm mới).
func (k *RemoteKeySet) WithClock(now func() time.Time) *RemoteKeySet {
	k.now = now
	return k
}

// Refresh tải JWKS. JWKS sai làm hỏng cả lần tải và GIỮ tập khoá cũ (không bao giờ nhận tập khoá hỏng).
func (k *RemoteKeySet) Refresh(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, k.url, nil)
	if err != nil {
		return err
	}
	resp, err := k.client.Do(req)
	if err != nil {
		return fmt.Errorf("tải JWKS: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("tải JWKS: identity trả %d", resp.StatusCode)
	}
	var set authx.JWKS
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&set); err != nil {
		return errors.New("tải JWKS: phản hồi không hợp lệ")
	}
	keys, err := set.KeySet()
	if err != nil {
		return fmt.Errorf("tải JWKS: %w", err)
	}
	k.mu.Lock()
	k.keys = keys
	k.lastFetch = k.now()
	k.mu.Unlock()
	return nil
}

// Key trả khoá theo kid; kid lạ kích hoạt một lần làm mới (giới hạn tần suất để kẻ gửi kid bậy không làm ngập identity).
func (k *RemoteKeySet) Key(kid string) (ed25519.PublicKey, bool) {
	k.mu.RLock()
	key, ok := k.keys.Key(kid)
	last := k.lastFetch
	k.mu.RUnlock()
	if ok {
		return key, true
	}
	if k.now().Sub(last) < minRefreshGap {
		return nil, false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := k.Refresh(ctx); err != nil {
		k.mu.Lock()
		k.lastFetch = k.now() // cũng tính là một lần thử: không dồn dập khi identity đang lỗi
		k.mu.Unlock()
		k.log.WarnContext(ctx, "làm mới JWKS thất bại", "error", err.Error())
		return nil, false
	}
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.keys.Key(kid)
}

// Ready báo đã có tập khoá (dùng cho /readyz).
func (k *RemoteKeySet) Ready(context.Context) error {
	k.mu.RLock()
	defer k.mu.RUnlock()
	if len(k.keys) == 0 {
		return errors.New("chưa có JWKS")
	}
	return nil
}

// Run làm mới định kỳ cho tới khi ctx bị huỷ; thử lại nhanh cho tới khi có tập khoá đầu tiên.
func (k *RemoteKeySet) Run(ctx context.Context, every time.Duration) {
	wait := time.Second
	for {
		if err := k.Refresh(ctx); err != nil {
			k.log.WarnContext(ctx, "nạp JWKS thất bại", "error", err.Error())
		} else {
			wait = every
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
	}
}
