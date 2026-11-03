CREATE TABLE iam_authorization_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  revision BIGINT NOT NULL CHECK (revision > 0),
  updated_at TIMESTAMPTZ NOT NULL
);
INSERT INTO iam_authorization_state (id, revision, updated_at) VALUES (1, 1, '1970-01-01 00:00:00');