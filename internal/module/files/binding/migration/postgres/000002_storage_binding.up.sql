CREATE TABLE files_storage (id VARCHAR(16) PRIMARY KEY, identity VARCHAR(64) NOT NULL);
CREATE TABLE files_pending_cleanup (object_key VARCHAR(128) PRIMARY KEY, owner_id VARCHAR(128) NOT NULL, created_at TIMESTAMP NOT NULL);
