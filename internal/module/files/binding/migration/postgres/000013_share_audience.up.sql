ALTER TABLE files_shares ADD COLUMN audience_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE files_entries ADD COLUMN access_policy_json TEXT NOT NULL DEFAULT 'null';
ALTER TABLE files_entries ADD COLUMN access_policy_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE files_share_grants ADD COLUMN audience_subject VARCHAR(36) NOT NULL DEFAULT '';
ALTER TABLE files_transfers ADD COLUMN share_audience_subject VARCHAR(36) NOT NULL DEFAULT '';
