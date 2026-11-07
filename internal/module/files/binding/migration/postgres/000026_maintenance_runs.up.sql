CREATE TABLE files_maintenance_runs (
    id VARCHAR(36) PRIMARY KEY,
    kind VARCHAR(24) NOT NULL,
    state VARCHAR(16) NOT NULL,
    failure_code VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    duration_ms BIGINT NOT NULL
);
CREATE INDEX files_maintenance_runs_kind ON files_maintenance_runs (kind, created_at, id);
