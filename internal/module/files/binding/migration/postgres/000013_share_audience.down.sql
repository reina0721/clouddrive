CREATE TEMPORARY TABLE files_share_audience_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0));
INSERT INTO files_share_audience_rollback_guard SELECT (SELECT COUNT(*) FROM files_shares WHERE audience_json NOT IN ('{}','{"anonymous":null,"authenticated":null,"accounts":[],"roles":[]}')) + (SELECT COUNT(*) FROM files_entries WHERE access_policy_json <> 'null' OR access_policy_revision <> 0) + (SELECT COUNT(*) FROM files_share_grants WHERE audience_subject <> '') + (SELECT COUNT(*) FROM files_transfers WHERE share_audience_subject <> '');
ALTER TABLE files_transfers DROP COLUMN share_audience_subject;
ALTER TABLE files_share_grants DROP COLUMN audience_subject;
ALTER TABLE files_entries DROP COLUMN access_policy_revision;
ALTER TABLE files_entries DROP COLUMN access_policy_json;
ALTER TABLE files_shares DROP COLUMN audience_json;
DROP TABLE files_share_audience_rollback_guard;
