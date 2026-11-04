CREATE TABLE files_download_tasks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    source_uri TEXT NOT NULL,
    effective_uri TEXT NOT NULL,
    source_origin TEXT NOT NULL,
    target_parent_id TEXT NOT NULL,
    requested_name TEXT NOT NULL,
    client_key TEXT NOT NULL,
    state TEXT NOT NULL,
    intent TEXT NOT NULL,
    validator_kind TEXT NOT NULL,
    validator_value TEXT NOT NULL,
    declared_bytes BIGINT NULL,
    received_bytes BIGINT NOT NULL,
    rate_bytes_per_second REAL NOT NULL,
    progress_at DATETIME NULL,
    media_type TEXT NOT NULL,
    failure_code TEXT NOT NULL,
    source_status INTEGER NOT NULL,
    attempts INTEGER NOT NULL,
    lease_token TEXT NOT NULL,
    lease_until DATETIME NULL,
    revision BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    started_at DATETIME NULL,
    finished_at DATETIME NULL,
    expires_at DATETIME NOT NULL,
    UNIQUE (owner_id, client_key)
);
CREATE INDEX files_download_tasks_owner_state ON files_download_tasks (owner_id, state, created_at, id);
CREATE INDEX files_download_tasks_dispatch ON files_download_tasks (state, intent, lease_until, created_at);
ALTER TABLE files_transfers ADD COLUMN download_id TEXT NOT NULL DEFAULT '';
CREATE INDEX files_transfers_download ON files_transfers (owner_id, download_id, id);
