CREATE TABLE iam_authorization_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at DATETIME NOT NULL
);
INSERT INTO iam_authorization_state (id, revision, updated_at) VALUES (1, 1, '1970-01-01 00:00:00');