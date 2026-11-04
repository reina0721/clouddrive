DROP INDEX files_transfers_connection;
ALTER TABLE files_transfers DROP COLUMN connection_revision;
ALTER TABLE files_transfers DROP COLUMN connection_id;
ALTER TABLE files_transfers DROP COLUMN expected_content_revision;
ALTER TABLE files_transfers DROP COLUMN expected_entry_id;
ALTER TABLE files_transfers DROP COLUMN quota_reserved_bytes;
ALTER TABLE files_transfers DROP COLUMN size_known;
ALTER TABLE files_transfers DROP COLUMN source;
DROP TABLE files_connections;
