CREATE TABLE files_connections (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    name TEXT NOT NULL,
    root_id VARCHAR(36) NOT NULL,
    read_only BOOLEAN NOT NULL,
    block_system_files BOOLEAN NOT NULL,
    secret_digest VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    revision BIGINT NOT NULL
);
CREATE INDEX files_connections_owner ON files_connections (owner_id, id);
ALTER TABLE files_transfers ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'tus';
ALTER TABLE files_transfers ADD COLUMN size_known BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE files_transfers ADD COLUMN quota_reserved_bytes BIGINT NOT NULL DEFAULT 0;
UPDATE files_transfers SET quota_reserved_bytes = size_bytes;
ALTER TABLE files_transfers ADD COLUMN expected_entry_id VARCHAR(36) NOT NULL DEFAULT '';
ALTER TABLE files_transfers ADD COLUMN expected_content_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE files_transfers ADD COLUMN connection_id VARCHAR(36) NOT NULL DEFAULT '';
ALTER TABLE files_transfers ADD COLUMN connection_revision BIGINT NOT NULL DEFAULT 0;
CREATE INDEX files_transfers_connection ON files_transfers (connection_id, state);
