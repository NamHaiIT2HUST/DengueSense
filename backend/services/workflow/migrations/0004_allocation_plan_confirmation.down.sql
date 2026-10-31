ALTER TABLE allocation_plans DROP COLUMN IF EXISTS confirmed_at;
ALTER TABLE allocation_plans DROP COLUMN IF EXISTS confirmed_by;
ALTER TABLE allocation_plans DROP COLUMN IF EXISTS version;
ALTER TABLE allocation_plans DROP COLUMN IF EXISTS status;
