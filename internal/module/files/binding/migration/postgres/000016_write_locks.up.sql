CREATE TABLE files_write_locks (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    connection_id VARCHAR(36) NOT NULL,
    connection_revision BIGINT NOT NULL,
    root_path TEXT NOT NULL,
    depth VARCHAR(16) NOT NULL,
    owner_xml TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revision BIGINT NOT NULL
);
CREATE INDEX files_write_locks_owner ON files_write_locks (owner_id, id);
CREATE INDEX files_write_locks_expiry ON files_write_locks (expires_at, id);
ALTER TABLE files_transfers ADD COLUMN dav_condition_document TEXT NOT NULL DEFAULT '';
