CREATE TABLE files_connections (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    root_id TEXT NOT NULL,
    read_only BOOLEAN NOT NULL,
    block_system_files BOOLEAN NOT NULL,
    secret_digest TEXT NOT NULL,
    state TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    revision BIGINT NOT NULL
);
CREATE INDEX files_connections_owner ON files_connections (owner_id, id);
ALTER TABLE files_transfers ADD COLUMN source TEXT NOT NULL DEFAULT 'tus';
ALTER TABLE files_transfers ADD COLUMN size_known BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE files_transfers ADD COLUMN quota_reserved_bytes BIGINT NOT NULL DEFAULT 0;
UPDATE files_transfers SET quota_reserved_bytes = size_bytes;
ALTER TABLE files_transfers ADD COLUMN expected_entry_id TEXT NOT NULL DEFAULT '';
ALTER TABLE files_transfers ADD COLUMN expected_content_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE files_transfers ADD COLUMN connection_id TEXT NOT NULL DEFAULT '';
ALTER TABLE files_transfers ADD COLUMN connection_revision BIGINT NOT NULL DEFAULT 0;
CREATE INDEX files_transfers_connection ON files_transfers (connection_id, state);
