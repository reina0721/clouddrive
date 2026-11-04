ALTER TABLE files_entries ADD COLUMN share_token TEXT NOT NULL DEFAULT '';
CREATE TABLE files_navigation_states (
    owner_id TEXT PRIMARY KEY,
    revision BIGINT NOT NULL
);
CREATE TABLE files_pins (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX files_pins_owner_target ON files_pins (owner_id, target_kind, target_id);
CREATE INDEX files_pins_owner_position ON files_pins (owner_id, position);
