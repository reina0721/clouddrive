CREATE TABLE files_transfers (
    id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    parent_id VARCHAR(36) NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    content_sha256 VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    state VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revision BIGINT NOT NULL,
    entry_id VARCHAR(36) NOT NULL,
    object_key VARCHAR(256) NOT NULL,
    failure_code VARCHAR(64) NOT NULL,
    cleanup_pending BOOLEAN NOT NULL,
    UNIQUE (owner_id, idempotency_key),
    INDEX files_transfers_owner_state (owner_id, state, id),
    INDEX files_transfers_reservation (state, cleanup_pending)
);
CREATE TABLE files_transfer_staging (id VARCHAR(36) PRIMARY KEY, identity VARCHAR(64) NOT NULL);

