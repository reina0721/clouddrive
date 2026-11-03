CREATE TABLE iam_registration_settings (id INTEGER PRIMARY KEY, enabled BOOLEAN NOT NULL, default_role_id VARCHAR(36) NOT NULL, version BIGINT NOT NULL, updated_at DATETIME NOT NULL);
INSERT INTO iam_registration_settings (id, enabled, default_role_id, version, updated_at) VALUES (1, FALSE, '', 1, CURRENT_TIMESTAMP);
