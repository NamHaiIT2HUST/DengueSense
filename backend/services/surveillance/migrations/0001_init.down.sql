-- Hoàn tác 0001: chỉ dùng trên DB thử nghiệm/dev (xoá toàn bộ dữ liệu của schema).
DROP TABLE IF EXISTS outbox;
DROP TABLE IF EXISTS observations;
DROP TABLE IF EXISTS data_versions;
DROP TABLE IF EXISTS geometry_versions;
DROP TABLE IF EXISTS provinces;
DROP FUNCTION IF EXISTS forbid_change();
