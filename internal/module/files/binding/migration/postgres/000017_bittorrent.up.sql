CREATE TABLE files_torrent_tasks (
    task_id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    node_id VARCHAR(64) NOT NULL,
    info_hash VARCHAR(40) NOT NULL,
    name TEXT NOT NULL,
    metadata BYTEA NOT NULL,
    metadata_bytes BIGINT NOT NULL,
    total_bytes BIGINT NOT NULL,
    result_folder_id VARCHAR(36) NOT NULL
);
CREATE INDEX files_torrent_tasks_owner ON files_torrent_tasks (owner_id, task_id);
CREATE TABLE files_torrent_files (
    task_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    file_index INTEGER NOT NULL,
    relative_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    selected BOOLEAN NOT NULL,
    transfer_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (task_id, file_index)
);
CREATE INDEX files_torrent_files_owner ON files_torrent_files (owner_id, task_id);
CREATE TABLE files_torrent_folders (
    task_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    entry_id VARCHAR(36) NOT NULL,
    relative_path TEXT NOT NULL,
    parent_id VARCHAR(36) NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (task_id, entry_id)
);
CREATE INDEX files_torrent_folders_owner ON files_torrent_folders (owner_id, task_id);
CREATE TABLE files_torrent_jobs (
    gid VARCHAR(16) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(128) NOT NULL,
    node_id VARCHAR(64) NOT NULL,
    claim_token VARCHAR(36) NOT NULL,
    phase VARCHAR(16) NOT NULL,
    workspace_identity VARCHAR(64) NOT NULL,
    node_session_id VARCHAR(128) NOT NULL,
    reserved_bytes BIGINT NOT NULL,
    submitted BOOLEAN NOT NULL,
    accepted BOOLEAN NOT NULL,
    stopped BOOLEAN NOT NULL,
    cleaned BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX files_torrent_jobs_task ON files_torrent_jobs (owner_id, task_id);
CREATE INDEX files_torrent_jobs_node ON files_torrent_jobs (node_id, cleaned, stopped);
