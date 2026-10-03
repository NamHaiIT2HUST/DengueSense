-- Bổ sung các cột thông tin cho cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Hồ sơ phòng chống dịch';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'open';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) NOT NULL DEFAULT 'officer';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE cases ALTER COLUMN alert_id DROP NOT NULL;

-- Bảng quan hệ nhiều-nhiều giữa case và alerts
CREATE TABLE IF NOT EXISTS case_alerts (
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (case_id, alert_id)
);

-- Bảng phương án phân bổ nguồn lực (Layer 2 Optimize)
CREATE TABLE IF NOT EXISTS allocation_plans (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    budget DOUBLE PRECISION NOT NULL,
    total_cost DOUBLE PRECISION NOT NULL,
    estimated_cases_prevented DOUBLE PRECISION NOT NULL,
    allocations JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng dự thảo văn bản (Layer 3 GenAI & Soạn thảo)
CREATE TABLE IF NOT EXISTS dispatch_drafts (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    draft_type VARCHAR(20) NOT NULL, -- 'b2b' hoặc 'b2g'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 của content
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- DRAFT, PENDING_REVIEW, CHANGES_REQUESTED, APPROVED, REJECTED
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng lịch sử các phiên bản sửa đổi của dự thảo (phục vụ tính diff và kiểm toán)
CREATE TABLE IF NOT EXISTS draft_revisions (
    id UUID PRIMARY KEY,
    draft_id UUID NOT NULL REFERENCES dispatch_drafts(id) ON DELETE CASCADE,
    version INT NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    updated_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng phê duyệt (Quy tắc 4 mắt: reviewer_id != created_by đối với B2G)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY,
    draft_id UUID NOT NULL REFERENCES dispatch_drafts(id) ON DELETE CASCADE,
    draft_version INT NOT NULL,
    reviewer_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'approve', 'reject', 'request_changes'
    note TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng lệnh điều phối đã ban hành (chỉ tạo khi review(action=approve) trên đúng version)
CREATE TABLE IF NOT EXISTS dispatch_orders (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    draft_id UUID NOT NULL REFERENCES dispatch_drafts(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SENDING, SENT, DELIVERY_FAILED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_case_alerts_case_id ON case_alerts(case_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_drafts_case_id ON dispatch_drafts(case_id);
CREATE INDEX IF NOT EXISTS idx_reviews_draft_id ON reviews(draft_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_orders_case_id ON dispatch_orders(case_id);
