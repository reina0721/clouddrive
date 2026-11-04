CREATE TABLE files_shares (
 id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(128) NOT NULL, root_id VARCHAR(36) NOT NULL,
 token VARCHAR(43) NOT NULL, token_digest VARCHAR(64) NOT NULL UNIQUE, password_hash VARCHAR(512) NOT NULL,
 created_at TIMESTAMP NOT NULL, expires_at TIMESTAMP NOT NULL, revoked_at TIMESTAMP NULL,
 attempt_window TIMESTAMP NULL, unlock_attempts INT NOT NULL DEFAULT 0
);
CREATE INDEX files_shares_owner ON files_shares(owner_id);
CREATE TABLE files_share_grants (
 digest VARCHAR(64) PRIMARY KEY, share_id VARCHAR(36) NOT NULL, expires_at TIMESTAMP NOT NULL
);
CREATE INDEX files_share_grants_expiry ON files_share_grants(share_id, expires_at);
