ALTER TABLE files_write_locks ADD COLUMN wopi_session_id VARCHAR(36) NOT NULL DEFAULT '';
ALTER TABLE files_write_locks ADD COLUMN wopi_entry_id VARCHAR(36) NOT NULL DEFAULT '';
ALTER TABLE files_write_locks ADD COLUMN wopi_value VARCHAR(1024) NOT NULL DEFAULT '';
ALTER TABLE files_write_locks ADD COLUMN wopi_content_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE files_write_locks ADD COLUMN wopi_settings_revision BIGINT NOT NULL DEFAULT 0;
