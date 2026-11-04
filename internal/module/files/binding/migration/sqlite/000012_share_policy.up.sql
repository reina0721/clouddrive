ALTER TABLE files_shares ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE files_shares ADD COLUMN state VARCHAR(16) NOT NULL DEFAULT 'active';
ALTER TABLE files_shares ADD COLUMN permissions BIGINT NOT NULL DEFAULT 7;
ALTER TABLE files_shares ADD COLUMN revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE files_share_grants ADD COLUMN share_revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE files_transfers ADD COLUMN share_id VARCHAR(36) NOT NULL DEFAULT '';
ALTER TABLE files_transfers ADD COLUMN share_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE files_transfers ADD COLUMN share_grant_digest VARCHAR(64) NOT NULL DEFAULT '';
CREATE INDEX files_transfers_share ON files_transfers(share_id);
