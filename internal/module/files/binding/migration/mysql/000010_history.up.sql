ALTER TABLE files_entries ADD COLUMN history_json TEXT NOT NULL DEFAULT ('[]');
ALTER TABLE files_entries ADD COLUMN history_revision BIGINT NOT NULL DEFAULT 0;
