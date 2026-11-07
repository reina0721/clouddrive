CREATE TEMPORARY TABLE files_zip_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0));
INSERT INTO files_zip_rollback_guard SELECT COUNT(*) FROM files_archive_tasks WHERE kind <> 'extract';
DROP TABLE files_zip_rollback_guard;
ALTER TABLE files_archive_tasks DROP COLUMN result_entry_id;
ALTER TABLE files_archive_tasks DROP COLUMN source_signature;
ALTER TABLE files_archive_tasks DROP COLUMN kind;
