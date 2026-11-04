ALTER TABLE files_entries ADD COLUMN annotation_json VARCHAR(8192) NOT NULL DEFAULT '{}';
ALTER TABLE files_entries ADD COLUMN annotation_revision BIGINT NOT NULL DEFAULT 0;
