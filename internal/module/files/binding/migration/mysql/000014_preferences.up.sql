CREATE TABLE files_preferences (
    owner_id VARCHAR(36) PRIMARY KEY,
    revision BIGINT NOT NULL,
    document TEXT NOT NULL
);
