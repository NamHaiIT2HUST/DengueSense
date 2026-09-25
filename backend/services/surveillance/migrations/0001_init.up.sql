-- Schema `surveillance` do role svc_surveillance sở hữu (infra/postgres/init); search_path của role trỏ vào schema này,
-- nên không cần tiền tố. Mỗi migration chỉ THÊM (expand → migrate → contract, docs/09 §9.3).

-- Danh mục 34 tỉnh: dữ liệu tham chiếu, nạp bằng `surveillance seed`.
CREATE TABLE provinces (
    province_id text PRIMARY KEY,
    name        text NOT NULL,
    region      text NOT NULL,
    CONSTRAINT provinces_id_format CHECK (province_id ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT provinces_region_known CHECK (region IN ('Bắc', 'Trung', 'Nam'))
);

-- Ranh giới theo phiên bản (bất biến — xem trigger bên dưới).
CREATE TABLE geometry_versions (
    version    text        PRIMARY KEY,
    geojson    jsonb       NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    seq        bigint      GENERATED ALWAYS AS IDENTITY
);

-- Phiên bản dữ liệu (panel) đã công bố: BẤT BIẾN. Lưu nguyên file Parquet để `forecast` tải về và kiểm sha256.
CREATE TABLE data_versions (
    version      text             PRIMARY KEY,
    published_at timestamptz      NOT NULL,
    first_month  text             NOT NULL,
    last_month   text             NOT NULL,
    real_share   double precision NOT NULL,
    n_rows       integer          NOT NULL,
    n_provinces  integer          NOT NULL,
    sha256       text             NOT NULL,
    known_issues text[]           NOT NULL DEFAULT '{}',
    panel        bytea            NOT NULL,
    CONSTRAINT data_versions_version_format CHECK (version ~ '^v[0-9]+\.[0-9]+\.[0-9]+$'),
    CONSTRAINT data_versions_months_format CHECK (first_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND last_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT data_versions_real_share_range CHECK (real_share >= 0 AND real_share <= 1),
    CONSTRAINT data_versions_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT data_versions_counts_positive CHECK (n_rows > 0 AND n_provinces > 0)
);
CREATE INDEX data_versions_latest_idx ON data_versions (published_at DESC, version DESC);

CREATE TABLE observations (
    data_version       text             NOT NULL REFERENCES data_versions (version),
    province_id        text             NOT NULL REFERENCES provinces (province_id),
    month              text             NOT NULL,
    cases              double precision NOT NULL,
    incidence_per_100k double precision,
    data_source        text             NOT NULL,
    population         bigint,
    PRIMARY KEY (data_version, province_id, month),
    CONSTRAINT observations_month_format CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT observations_cases_nonneg CHECK (cases >= 0),
    CONSTRAINT observations_source_known CHECK (data_source IN ('real', 'estimated', 'imputed', 'simulated'))
);

-- Outbox (docs/09 §7.4): sự kiện ghi CÙNG giao dịch với thay đổi nghiệp vụ; relay (Đợt 1 sau) gửi lên NATS.
CREATE TABLE outbox (
    id           uuid        PRIMARY KEY,
    event_type   text        NOT NULL,
    payload      jsonb       NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
CREATE INDEX outbox_unpublished_idx ON outbox (created_at) WHERE published_at IS NULL;

-- BẤT BIẾN ở tầng DB: dù mã ứng dụng có lỗi, phiên bản dữ liệu/quan sát/ranh giới đã công bố không sửa, không xoá được.
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'bảng % là bất biến (phiên bản đã công bố không được sửa/xoá)', TG_TABLE_NAME
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$;
CREATE TRIGGER data_versions_immutable BEFORE UPDATE OR DELETE ON data_versions FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER observations_immutable BEFORE UPDATE OR DELETE ON observations FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER geometry_versions_immutable BEFORE UPDATE OR DELETE ON geometry_versions FOR EACH ROW EXECUTE FUNCTION forbid_change();
