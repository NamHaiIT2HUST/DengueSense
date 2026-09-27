-- Schema `forecast` do role svc_forecast sở hữu (infra/postgres/init); search_path của role trỏ vào schema này.
-- Mỗi migration chỉ THÊM (expand → migrate → contract, docs/09 §9.3).

CREATE TABLE runs (
    run_id        uuid             PRIMARY KEY,
    run_mode      text             NOT NULL,
    status        text             NOT NULL,
    origin_month  text             NOT NULL,
    model_version text             NOT NULL,
    data_version  text             NOT NULL,
    created_at    timestamptz      NOT NULL,
    completed_at  timestamptz,
    error_code    text,
    progress      double precision NOT NULL DEFAULT 0,
    actor_id      text,
    org_id        text,
    extras        jsonb,
    CONSTRAINT runs_mode_known CHECK (run_mode IN ('backtest', 'live_experimental')),
    CONSTRAINT runs_status_known CHECK (status IN ('queued', 'running', 'completed', 'failed', 'interrupted', 'cancelled')),
    CONSTRAINT runs_origin_format CHECK (origin_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT runs_data_version_format CHECK (data_version ~ '^v[0-9]+\.[0-9]+\.[0-9]+$'),
    CONSTRAINT runs_progress_range CHECK (progress >= 0 AND progress <= 1),
    -- completed ⇔ có thời điểm hoàn tất và không có mã lỗi; failed ⇔ có mã lỗi.
    CONSTRAINT runs_completed_consistent CHECK (status <> 'completed' OR (completed_at IS NOT NULL AND error_code IS NULL)),
    CONSTRAINT runs_failed_consistent CHECK (status <> 'failed' OR error_code IS NOT NULL)
);
CREATE INDEX runs_listing_idx ON runs (created_at DESC, run_id DESC);
-- Cùng đầu vào chỉ có MỘT lượt còn hiệu lực (tất định → không chạy lại): chặn trùng ở tầng DB.
CREATE UNIQUE INDEX runs_one_live_per_input ON runs (run_mode, origin_month, model_version, data_version)
    WHERE status IN ('queued', 'running', 'interrupted', 'completed');

CREATE TABLE jobs (
    job_id          uuid        PRIMARY KEY,
    run_id          uuid        NOT NULL REFERENCES runs (run_id),
    actor_id        text        NOT NULL DEFAULT '',
    idempotency_key text        NOT NULL,
    request_hash    text        NOT NULL,
    created_at      timestamptz NOT NULL,
    CONSTRAINT jobs_key_unique UNIQUE (actor_id, idempotency_key)
);

CREATE TABLE forecasts (
    run_id      uuid     NOT NULL REFERENCES runs (run_id),
    horizon     smallint NOT NULL,
    province_id text     NOT NULL,
    item        jsonb    NOT NULL,
    PRIMARY KEY (run_id, horizon, province_id),
    CONSTRAINT forecasts_horizon_known CHECK (horizon IN (1, 2, 3, 6))
);

CREATE TABLE explanations (
    run_id      uuid     NOT NULL REFERENCES runs (run_id),
    province_id text     NOT NULL,
    horizon     smallint NOT NULL,
    payload     jsonb    NOT NULL,
    PRIMARY KEY (run_id, province_id, horizon),
    CONSTRAINT explanations_horizon_known CHECK (horizon IN (1, 2, 3, 6))
);

CREATE TABLE outbox (
    id           uuid        PRIMARY KEY,
    event_type   text        NOT NULL,
    payload      jsonb       NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
CREATE INDEX outbox_unpublished_idx ON outbox (created_at) WHERE published_at IS NULL;

-- BẤT BIẾN ở tầng DB: kết quả dự báo không sửa/xoá được; lượt đã kết thúc không đổi được nữa.
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'bảng % là bất biến', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER forecasts_immutable BEFORE UPDATE OR DELETE ON forecasts FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER explanations_immutable BEFORE UPDATE OR DELETE ON explanations FOR EACH ROW EXECUTE FUNCTION forbid_change();

CREATE FUNCTION forbid_final_run_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'không được xoá lượt dự báo' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF OLD.status IN ('completed', 'failed', 'cancelled') THEN
        RAISE EXCEPTION 'lượt dự báo đã kết thúc (%) là bất biến', OLD.status USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER runs_final_immutable BEFORE UPDATE OR DELETE ON runs FOR EACH ROW EXECUTE FUNCTION forbid_final_run_change();
