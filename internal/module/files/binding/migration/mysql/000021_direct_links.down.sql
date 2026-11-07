CREATE TEMPORARY TABLE files_direct_link_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0) ENFORCED);
INSERT INTO files_direct_link_rollback_guard SELECT COUNT(*) FROM files_direct_links;
DROP TABLE files_direct_link_rollback_guard;
DROP TABLE files_direct_links;
