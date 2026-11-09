CREATE TEMPORARY TABLE files_wopi_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0));
INSERT INTO files_wopi_rollback_guard SELECT COUNT(*) FROM files_write_locks WHERE wopi_session_id <> '';
ALTER TABLE files_write_locks DROP COLUMN wopi_settings_revision;
ALTER TABLE files_write_locks DROP COLUMN wopi_content_revision;
ALTER TABLE files_write_locks DROP COLUMN wopi_value;
ALTER TABLE files_write_locks DROP COLUMN wopi_entry_id;
ALTER TABLE files_write_locks DROP COLUMN wopi_session_id;
DROP TABLE files_wopi_rollback_guard;
