-- Bảng alerts lưu trữ cảnh báo tự động sinh từ kết quả dự báo
CREATE TABLE alerts (
    id UUID PRIMARY KEY,
    run_id UUID NOT NULL,
    province_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'open'
);

-- Bảng cases lưu trữ hồ sơ đã được officer xác nhận từ cảnh báo
CREATE TABLE cases (
    id UUID PRIMARY KEY,
    alert_id UUID NOT NULL REFERENCES alerts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng inbox cho eventx consumer
CREATE TABLE inbox (
    event_id VARCHAR(255) PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng outbox cho eventx publisher (nếu workflow có phát sinh event)
CREATE TABLE outbox (
    id UUID PRIMARY KEY,
    topic VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_unpublished ON outbox(created_at) WHERE published_at IS NULL;
