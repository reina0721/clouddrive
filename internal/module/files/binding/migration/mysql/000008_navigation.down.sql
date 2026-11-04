CREATE TEMPORARY TABLE files_navigation_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0));
INSERT INTO files_navigation_rollback_guard SELECT COUNT(*) FROM files_entries WHERE kind = 'shortcut';
INSERT INTO files_navigation_rollback_guard SELECT COUNT(*) FROM files_pins;
DROP TABLE files_pins;
DROP TABLE files_navigation_states;
ALTER TABLE files_entries DROP COLUMN share_token;
DROP TABLE files_navigation_rollback_guard;
