CREATE TABLE files_transfers (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    parent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    content_sha256 TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    revision BIGINT NOT NULL,
    entry_id TEXT NOT NULL,
    object_key TEXT NOT NULL,
    failure_code TEXT NOT NULL,
    cleanup_pending BOOLEAN NOT NULL,
    UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX files_transfers_owner_state ON files_transfers (owner_id, state, id);
CREATE INDEX files_transfers_reservation ON files_transfers (state, cleanup_pending);
CREATE TABLE files_transfer_staging (id TEXT PRIMARY KEY, identity TEXT NOT NULL);

