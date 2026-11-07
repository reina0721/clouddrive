CREATE TABLE files_direct_links (
 id VARCHAR(36) NOT NULL PRIMARY KEY,
 owner_id VARCHAR(128) NOT NULL,
 entry_id VARCHAR(36) NOT NULL,
 token VARCHAR(43) NOT NULL,
 token_digest VARCHAR(64) NOT NULL,
 created_at TIMESTAMP NOT NULL,
 UNIQUE (owner_id, entry_id),
 UNIQUE (token_digest)
);
CREATE INDEX files_direct_links_owner_order ON files_direct_links (owner_id, created_at, id);
