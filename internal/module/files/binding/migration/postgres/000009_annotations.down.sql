CREATE TEMPORARY TABLE files_annotations_rollback_guard (remaining BIGINT NOT NULL CHECK (remaining = 0));
INSERT INTO files_annotations_rollback_guard SELECT COUNT(*) FROM files_entries WHERE annotation_revision <> 0 OR annotation_json <> '{}';
ALTER TABLE files_entries DROP COLUMN annotation_revision;
ALTER TABLE files_entries DROP COLUMN annotation_json;
DROP TABLE files_annotations_rollback_guard;
