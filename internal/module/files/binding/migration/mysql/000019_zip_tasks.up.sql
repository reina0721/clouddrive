ALTER TABLE files_archive_tasks ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'extract';
ALTER TABLE files_archive_tasks ADD COLUMN source_signature VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE files_archive_tasks ADD COLUMN result_entry_id VARCHAR(36) NOT NULL DEFAULT '';
