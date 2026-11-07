CREATE TABLE files_trash_retention (
 owner_id VARCHAR(128) NOT NULL PRIMARY KEY,
 revision BIGINT NOT NULL,
 days INTEGER NOT NULL
);
ALTER TABLE files_entries ADD COLUMN trash_expires_at TIMESTAMP NULL;
ALTER TABLE files_entries ADD COLUMN trash_retry_at TIMESTAMP NULL;
CREATE INDEX files_trash_due ON files_entries (trash_retry_at, owner_id, id);
