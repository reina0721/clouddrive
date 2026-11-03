CREATE TABLE iam_user_preferences (
  account_id VARCHAR(64) PRIMARY KEY REFERENCES iam_accounts(id) ON DELETE CASCADE,
  preferences_json TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
