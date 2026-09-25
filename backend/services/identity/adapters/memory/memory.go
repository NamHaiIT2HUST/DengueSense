// Package memory: hiện thực trong bộ nhớ của các repository — CHỈ dùng cho test/dev, không dùng ở pilot.
// Hành vi phải khớp adapter Postgres; cả hai cùng chạy bộ kiểm thử hợp đồng ở package `repotest`.
package memory

import (
	"bytes"
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

type tokenRow struct {
	domain.RefreshToken
	usedAt    *time.Time
	revokedAt *time.Time
}

// Store là kho dùng chung cho cả UserRepository và RefreshTokenRepository.
type Store struct {
	mu     sync.Mutex
	users  map[uuid.UUID]domain.User
	tokens []*tokenRow
}

// NewStore tạo kho rỗng.
func NewStore() *Store {
	return &Store{users: map[uuid.UUID]domain.User{}}
}

// ---- UserRepository ----

func (s *Store) FindByUsername(_ context.Context, username string) (domain.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, u := range s.users {
		if u.Username == username {
			return u, nil
		}
	}
	return domain.User{}, domain.ErrUserNotFound
}

func (s *Store) FindByID(_ context.Context, id uuid.UUID) (domain.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u, ok := s.users[id]; ok {
		return u, nil
	}
	return domain.User{}, domain.ErrUserNotFound
}

func (s *Store) UpdateLoginState(_ context.Context, id uuid.UUID, fn func(domain.LoginState) domain.LoginState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return domain.ErrUserNotFound
	}
	u.LoginState = fn(u.LoginState)
	s.users[id] = u
	return nil
}

func (s *Store) Create(_ context.Context, u domain.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, x := range s.users {
		if x.Username == u.Username {
			return domain.ErrUsernameTaken
		}
	}
	s.users[u.ID] = u
	return nil
}

// ---- RefreshTokenRepository ----

func (s *Store) find(hash []byte) *tokenRow {
	for _, t := range s.tokens {
		if bytes.Equal(t.TokenHash, hash) {
			return t
		}
	}
	return nil
}

func (s *Store) revokeFamily(family uuid.UUID, now time.Time) {
	for _, t := range s.tokens {
		if t.FamilyID == family && t.revokedAt == nil {
			n := now
			t.revokedAt = &n
		}
	}
}

func (s *Store) CreateToken(_ context.Context, t domain.RefreshToken) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tokens = append(s.tokens, &tokenRow{RefreshToken: t})
	return nil
}

func (s *Store) Rotate(_ context.Context, oldHash []byte, now time.Time, next domain.RefreshToken) (uuid.UUID, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	old := s.find(oldHash)
	if old == nil || old.revokedAt != nil {
		return uuid.Nil, domain.ErrRefreshInvalid
	}
	if old.usedAt != nil {
		s.revokeFamily(old.FamilyID, now)
		return uuid.Nil, domain.ErrRefreshReused
	}
	if !now.Before(old.ExpiresAt) {
		return uuid.Nil, domain.ErrRefreshInvalid
	}
	n := now
	old.usedAt = &n
	next.FamilyID = old.FamilyID
	next.UserID = old.UserID
	s.tokens = append(s.tokens, &tokenRow{RefreshToken: next})
	return old.UserID, nil
}

func (s *Store) RevokeFamilyByHash(_ context.Context, hash []byte, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if t := s.find(hash); t != nil {
		s.revokeFamily(t.FamilyID, now)
	}
	return nil
}

// Tokens là bộ điều hợp thoả RefreshTokenRepository (vì `Create` của hai repo trùng tên với nhau).
type Tokens struct{ S *Store }

func (t Tokens) Create(ctx context.Context, tok domain.RefreshToken) error {
	return t.S.CreateToken(ctx, tok)
}

func (t Tokens) Rotate(ctx context.Context, h []byte, now time.Time, n domain.RefreshToken) (uuid.UUID, error) {
	return t.S.Rotate(ctx, h, now, n)
}

func (t Tokens) RevokeFamilyByHash(ctx context.Context, h []byte, now time.Time) error {
	return t.S.RevokeFamilyByHash(ctx, h, now)
}
