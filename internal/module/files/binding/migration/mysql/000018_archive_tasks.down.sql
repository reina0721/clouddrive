CREATE TEMPORARY TABLE files_archive_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0) ENFORCED);
INSERT INTO files_archive_rollback_guard SELECT COUNT(*) FROM files_archive_tasks;
DROP TABLE files_archive_tasks;
DROP TABLE files_archive_rollback_guard;
