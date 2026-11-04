CREATE TEMPORARY TABLE files_download_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0) ENFORCED);
INSERT INTO files_download_rollback_guard SELECT (SELECT COUNT(*) FROM files_download_tasks) + (SELECT COUNT(*) FROM files_transfers WHERE download_id <> '' OR source = 'offline');
DROP INDEX files_transfers_download ON files_transfers;
ALTER TABLE files_transfers DROP COLUMN download_id;
DROP TABLE files_download_tasks;
DROP TABLE files_download_rollback_guard;
