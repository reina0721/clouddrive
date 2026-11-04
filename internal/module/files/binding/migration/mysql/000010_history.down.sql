CREATE TEMPORARY TABLE files_history_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0) ENFORCED);
INSERT INTO files_history_rollback_guard SELECT COUNT(*) FROM files_entries WHERE history_revision <> 0 OR history_json <> '[]';
ALTER TABLE files_entries DROP COLUMN history_revision;
ALTER TABLE files_entries DROP COLUMN history_json;
DROP TABLE files_history_rollback_guard;
