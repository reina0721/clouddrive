CREATE TABLE files_transfers (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    parent_id VARCHAR(36) NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    content_sha256 VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    state VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revision BIGINT NOT NULL,
    entry_id VARCHAR(36) NOT NULL,
    object_key VARCHAR(256) NOT NULL,
    failure_code VARCHAR(64) NOT NULL,
    cleanup_pending BOOLEAN NOT NULL,
    UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX files_transfers_owner_state ON files_transfers (owner_id, state, id);
CREATE INDEX files_transfers_reservation ON files_transfers (state, cleanup_pending);
CREATE TABLE files_transfer_staging (id VARCHAR(36) PRIMARY KEY, identity VARCHAR(64) NOT NULL);

