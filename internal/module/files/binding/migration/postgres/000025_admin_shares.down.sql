DROP INDEX files_shares_admin_created;
DROP INDEX files_shares_admin_root;
ALTER TABLE files_shares DROP COLUMN download_count;
ALTER TABLE files_shares DROP COLUMN view_count;
