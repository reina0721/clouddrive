CREATE TABLE files_download_tasks (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    kind VARCHAR(16) NOT NULL,
    source_uri TEXT NOT NULL,
    effective_uri TEXT NOT NULL,
    source_origin TEXT NOT NULL,
    target_parent_id VARCHAR(36) NOT NULL,
    requested_name TEXT NOT NULL,
    client_key VARCHAR(64) NOT NULL,
    state VARCHAR(16) NOT NULL,
    intent VARCHAR(16) NOT NULL,
    validator_kind VARCHAR(16) NOT NULL,
    validator_value TEXT NOT NULL,
    declared_bytes BIGINT NULL,
    received_bytes BIGINT NOT NULL,
    rate_bytes_per_second DOUBLE PRECISION NOT NULL,
    progress_at TIMESTAMPTZ NULL,
    media_type TEXT NOT NULL,
    failure_code VARCHAR(32) NOT NULL,
    source_status INTEGER NOT NULL,
    attempts INTEGER NOT NULL,
    lease_token VARCHAR(36) NOT NULL,
    lease_until TIMESTAMPTZ NULL,
    revision BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE (owner_id, client_key)
);
CREATE INDEX files_download_tasks_owner_state ON files_download_tasks (owner_id, state, created_at, id);
CREATE INDEX files_download_tasks_dispatch ON files_download_tasks (state, intent, lease_until, created_at);
ALTER TABLE files_transfers ADD COLUMN download_id VARCHAR(36) NOT NULL DEFAULT '';
CREATE INDEX files_transfers_download ON files_transfers (owner_id, download_id, id);
