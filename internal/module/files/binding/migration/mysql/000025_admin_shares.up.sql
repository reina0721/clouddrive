ALTER TABLE files_shares ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE files_shares ADD COLUMN download_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX files_shares_admin_root ON files_shares(root_id);
CREATE INDEX files_shares_admin_created ON files_shares(created_at, id);
