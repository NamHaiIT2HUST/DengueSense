// Package postgres: hiện thực Postgres của các repository `identity` (pgx/v5, SQL viết tay).
//
// Ghi chú lệch so với docs/09 §14.2: chưa dùng `sqlc` — số truy vấn còn ít nên SQL viết tay cho rõ; chuyển sang
// sqlc khi số truy vấn đủ lớn (ghi vào ADR khi làm).
package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgerrcode"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/authx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/pkg/dbx"
	"github.com/NamHaiIT2HUST/DengueSense/backend/services/identity/domain"
)

const userColumns = `id, username, display_name, org_id, roles, password_hash, failed_attempts, locked_until, created_at`

// Users là UserRepository trên Postgres.
type Users struct{ pool *pgxpool.Pool }

// NewUsers tạo UserRepository.
func NewUsers(pool *pgxpool.Pool) *Users { return &Users{pool: pool} }

func scanUser(row pgx.Row) (domain.User, error) {
	var (
		u      domain.User
		roles  []string
		locked *time.Time
	)
	err := row.Scan(&u.ID, &u.Username, &u.DisplayName, &u.OrgID, &roles, &u.PasswordHash, &u.LoginState.FailedAttempts, &locked, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.User{}, domain.ErrUserNotFound
	}
	if err != nil {
		return domain.User{}, err
	}
	u.LoginState.LockedUntil = locked
	u.Roles = make([]authx.Role, len(roles))
	for i, r := range roles {
		u.Roles[i] = authx.Role(r)
	}
	return u, nil
}

// FindByUsername tìm theo tên đăng nhập đã chuẩn hoá.
func (r *Users) FindByUsername(ctx context.Context, username string) (domain.User, error) {
	return scanUser(r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE username = $1`, username))
}

// FindByID tìm theo ID.
func (r *Users) FindByID(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return scanUser(r.pool.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

// UpdateLoginState đọc trạng thái dưới khoá dòng, áp fn, ghi lại — trong một transaction.
func (r *Users) UpdateLoginState(ctx context.Context, id uuid.UUID, fn func(domain.LoginState) domain.LoginState) error {
	return dbx.InTx(ctx, r.pool, func(tx pgx.Tx) error {
		var st domain.LoginState
		var locked *time.Time
		err := tx.QueryRow(ctx, `SELECT failed_attempts, locked_until FROM users WHERE id = $1 FOR UPDATE`, id).
			Scan(&st.FailedAttempts, &locked)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrUserNotFound
		}
		if err != nil {
			return err
		}
		st.LockedUntil = locked
		st = fn(st)
		_, err = tx.Exec(ctx,
			`UPDATE users SET failed_attempts = $2, locked_until = $3, updated_at = now(), version = version + 1 WHERE id = $1`,
			id, st.FailedAttempts, st.LockedUntil)
		return err
	})
}

// Create thêm tài khoản; trùng tên → ErrUsernameTaken.
func (r *Users) Create(ctx context.Context, u domain.User) error {
	roles := make([]string, len(u.Roles))
	for i, role := range u.Roles {
		roles[i] = string(role)
	}
	_, err := r.pool.Exec(ctx,
		`INSERT INTO users (id, username, display_name, org_id, roles, password_hash, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		u.ID, u.Username, u.DisplayName, u.OrgID, roles, u.PasswordHash, u.CreatedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == pgerrcode.UniqueViolation {
		return domain.ErrUsernameTaken
	}
	return err
}

// Tokens là RefreshTokenRepository trên Postgres.
type Tokens struct{ pool *pgxpool.Pool }

// NewTokens tạo RefreshTokenRepository.
func NewTokens(pool *pgxpool.Pool) *Tokens { return &Tokens{pool: pool} }

// Create ghi một refresh token (hash).
func (r *Tokens) Create(ctx context.Context, t domain.RefreshToken) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO refresh_tokens (id, family_id, user_id, token_hash, created_at, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		t.ID, t.FamilyID, t.UserID, t.TokenHash, t.CreatedAt, t.ExpiresAt)
	return err
}

// Rotate xoay vòng nguyên tử dưới khoá dòng của token cũ. Dùng lại token đã dùng → thu hồi cả family và COMMIT việc
// thu hồi TRƯỚC khi trả ErrRefreshReused (nếu rollback theo lỗi thì việc thu hồi mất tác dụng).
func (r *Tokens) Rotate(ctx context.Context, oldHash []byte, now time.Time, next domain.RefreshToken) (uuid.UUID, error) {
	var (
		userID uuid.UUID
		reused bool
	)
	err := dbx.InTx(ctx, r.pool, func(tx pgx.Tx) error {
		var (
			id, family uuid.UUID
			expiresAt  time.Time
			usedAt     *time.Time
			revokedAt  *time.Time
		)
		err := tx.QueryRow(ctx,
			`SELECT id, family_id, user_id, expires_at, used_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
			oldHash).Scan(&id, &family, &userID, &expiresAt, &usedAt, &revokedAt)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrRefreshInvalid
		}
		if err != nil {
			return err
		}
		if revokedAt != nil {
			return domain.ErrRefreshInvalid
		}
		if usedAt != nil {
			if _, err := tx.Exec(ctx,
				`UPDATE refresh_tokens SET revoked_at = $2 WHERE family_id = $1 AND revoked_at IS NULL`, family, now); err != nil {
				return err
			}
			reused = true
			return nil // commit việc thu hồi
		}
		if !now.Before(expiresAt) {
			return domain.ErrRefreshInvalid
		}
		if _, err := tx.Exec(ctx, `UPDATE refresh_tokens SET used_at = $2 WHERE id = $1`, id, now); err != nil {
			return err
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO refresh_tokens (id, family_id, user_id, token_hash, created_at, expires_at)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			next.ID, family, userID, next.TokenHash, next.CreatedAt, next.ExpiresAt)
		return err
	})
	if err != nil {
		return uuid.Nil, err
	}
	if reused {
		return uuid.Nil, domain.ErrRefreshReused
	}
	return userID, nil
}

// RevokeFamilyByHash thu hồi cả chuỗi phiên chứa token; idempotent.
func (r *Tokens) RevokeFamilyByHash(ctx context.Context, hash []byte, now time.Time) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = $2
		 WHERE revoked_at IS NULL
		   AND family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
		hash, now)
	if err != nil {
		return fmt.Errorf("thu hồi phiên: %w", err)
	}
	return nil
}
