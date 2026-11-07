CREATE TEMPORARY TABLE files_torrent_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0) ENFORCED);
INSERT INTO files_torrent_rollback_guard SELECT (SELECT COUNT(*) FROM files_download_tasks WHERE kind = 'bittorrent') + (SELECT COUNT(*) FROM files_torrent_tasks) + (SELECT COUNT(*) FROM files_torrent_files) + (SELECT COUNT(*) FROM files_torrent_folders) + (SELECT COUNT(*) FROM files_torrent_jobs);
DROP TABLE files_torrent_jobs;
DROP TABLE files_torrent_folders;
DROP TABLE files_torrent_files;
DROP TABLE files_torrent_tasks;
DROP TABLE files_torrent_rollback_guard;
