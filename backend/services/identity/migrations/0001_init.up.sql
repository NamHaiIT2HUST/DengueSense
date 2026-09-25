-- Schema `identity` do role svc_identity sở hữu (infra/postgres/init); search_path của role trỏ vào schema này,
-- nên không cần tiền tố. Mỗi migration chỉ THÊM (expand → migrate → contract, docs/09 §9.3).

CREATE TABLE users (
    id              uuid        PRIMARY KEY,
    username        text        NOT NULL,
    display_name    text        NOT NULL,
    org_id          text        NOT NULL,
    roles           text[]      NOT NULL,
    password_hash   text        NOT NULL,
    failed_attempts integer     NOT NULL DEFAULT 0,
    locked_until    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
    CONSTRAINT users_roles_not_empty CHECK (cardinality(roles) > 0),
    -- Khớp enum Role của hợp đồng; thêm vai trò mới = migration mới.
    CONSTRAINT users_roles_known CHECK (roles <@ ARRAY['viewer','analyst','officer','approver','data_manager','admin']::text[]),
    CONSTRAINT users_failed_attempts_nonneg CHECK (failed_attempts >= 0)
);
CREATE UNIQUE INDEX users_username_key ON users (username);

-- Refresh token: CHỈ lưu hash SHA-256. `family_id` nhóm các token xoay vòng từ một lần đăng nhập
-- để thu hồi cả chuỗi khi phát hiện dùng lại.
CREATE TABLE refresh_tokens (
    id          uuid        PRIMARY KEY,
    family_id   uuid        NOT NULL,
    user_id     uuid        NOT NULL REFERENCES users (id),
    token_hash  bytea       NOT NULL,
    created_at  timestamptz NOT NULL,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    revoked_at  timestamptz,
    CONSTRAINT refresh_tokens_hash_len CHECK (octet_length(token_hash) = 32)
);
CREATE UNIQUE INDEX refresh_tokens_hash_key ON refresh_tokens (token_hash);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);
