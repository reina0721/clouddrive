ALTER TABLE files_entries ADD COLUMN share_token VARCHAR(64) NOT NULL DEFAULT '';
CREATE TABLE files_navigation_states (
    owner_id VARCHAR(128) PRIMARY KEY,
    revision BIGINT NOT NULL
);
CREATE TABLE files_pins (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(128) NOT NULL,
    target_kind VARCHAR(16) NOT NULL,
    target_id VARCHAR(36) NOT NULL,
    position INTEGER NOT NULL,
    created_at DATETIME(6) NOT NULL
);
CREATE UNIQUE INDEX files_pins_owner_target ON files_pins (owner_id, target_kind, target_id);
CREATE INDEX files_pins_owner_position ON files_pins (owner_id, position);
