CREATE TABLE files_archive_tasks (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    source_id VARCHAR(36) NOT NULL,
    source_name TEXT NOT NULL,
    client_key VARCHAR(36) NOT NULL,
    request_json TEXT NOT NULL,
    destination_id VARCHAR(36) NOT NULL,
    state VARCHAR(16) NOT NULL,
    failure_code VARCHAR(32) NOT NULL,
    created_count INTEGER NOT NULL,
    skipped_count INTEGER NOT NULL,
    renamed_count INTEGER NOT NULL,
    candidates TEXT NOT NULL,
    lease_token VARCHAR(36) NOT NULL,
    lease_until TIMESTAMPTZ NULL,
    cleanup_after TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (owner_id, client_key)
);
CREATE INDEX files_archive_tasks_owner ON files_archive_tasks (owner_id, created_at, id);
CREATE INDEX files_archive_tasks_dispatch ON files_archive_tasks (state, created_at, id);
CREATE INDEX files_archive_tasks_cleanup ON files_archive_tasks (state, cleanup_after, id);
