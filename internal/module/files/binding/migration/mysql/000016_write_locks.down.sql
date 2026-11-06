CREATE TEMPORARY TABLE files_lock_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0) ENFORCED);
INSERT INTO files_lock_rollback_guard SELECT (SELECT COUNT(*) FROM files_write_locks) + (SELECT COUNT(*) FROM files_transfers WHERE dav_condition_document <> '');
ALTER TABLE files_transfers DROP COLUMN dav_condition_document;
DROP TABLE files_write_locks;
DROP TABLE files_lock_rollback_guard;
