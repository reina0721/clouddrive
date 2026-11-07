DROP INDEX files_shares_admin_created ON files_shares;
DROP INDEX files_shares_admin_root ON files_shares;
ALTER TABLE files_shares DROP COLUMN download_count;
ALTER TABLE files_shares DROP COLUMN view_count;
