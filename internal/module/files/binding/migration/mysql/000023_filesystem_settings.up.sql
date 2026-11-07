CREATE TABLE files_filesystem_settings (
 id VARCHAR(32) NOT NULL PRIMARY KEY,
 revision BIGINT NOT NULL,
 overrides_json TEXT NOT NULL
);
