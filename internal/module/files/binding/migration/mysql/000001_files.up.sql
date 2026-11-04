CREATE TABLE files_owners (owner_id VARCHAR(128) PRIMARY KEY, revision BIGINT NOT NULL DEFAULT 0);
CREATE TABLE files_entries (
 id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(128) NOT NULL, parent_id VARCHAR(36) NOT NULL,
 kind VARCHAR(16) NOT NULL, name VARCHAR(1024) NOT NULL, normalized_name VARCHAR(1024) NOT NULL,
 object_key VARCHAR(128) NOT NULL, size_bytes BIGINT NOT NULL, media_type VARCHAR(255) NOT NULL,
 created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL, trashed_at TIMESTAMP NULL,
 upload_key VARCHAR(128) NOT NULL, content_sha VARCHAR(64) NOT NULL
);
CREATE INDEX files_owner_parent ON files_entries(owner_id, parent_id);
