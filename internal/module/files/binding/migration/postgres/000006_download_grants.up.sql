ALTER TABLE files_share_grants ADD COLUMN entry_id VARCHAR(36) NOT NULL DEFAULT '';
ALTER TABLE files_share_grants ADD COLUMN content_revision BIGINT NOT NULL DEFAULT 0;
