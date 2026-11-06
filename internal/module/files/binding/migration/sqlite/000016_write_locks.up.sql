CREATE TABLE files_write_locks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    connection_id TEXT NOT NULL,
    connection_revision BIGINT NOT NULL,
    root_path TEXT NOT NULL,
    depth TEXT NOT NULL,
    owner_xml TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    revision BIGINT NOT NULL
);
CREATE INDEX files_write_locks_owner ON files_write_locks (owner_id, id);
CREATE INDEX files_write_locks_expiry ON files_write_locks (expires_at, id);
ALTER TABLE files_transfers ADD COLUMN dav_condition_document TEXT NOT NULL DEFAULT '';
