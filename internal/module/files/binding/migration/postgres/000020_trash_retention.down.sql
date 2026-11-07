CREATE TEMPORARY TABLE files_retention_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0));
INSERT INTO files_retention_rollback_guard SELECT COUNT(*) FROM files_trash_retention;
INSERT INTO files_retention_rollback_guard SELECT COUNT(*) FROM files_entries WHERE trash_expires_at IS NOT NULL OR trash_retry_at IS NOT NULL;
DROP TABLE files_retention_rollback_guard;
DROP INDEX files_trash_due;
ALTER TABLE files_entries DROP COLUMN trash_retry_at;
ALTER TABLE files_entries DROP COLUMN trash_expires_at;
DROP TABLE files_trash_retention;
