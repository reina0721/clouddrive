CREATE TABLE iam_authorization_state (
  id TINYINT PRIMARY KEY,
  revision BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT chk_iam_authz_state_id CHECK (id = 1),
  CONSTRAINT chk_iam_authz_state_revision CHECK (revision > 0)
);
INSERT INTO iam_authorization_state (id, revision, updated_at) VALUES (1, 1, '1970-01-01 00:00:00');