CREATE TABLE iam_user_preferences (
  account_id VARCHAR(64) PRIMARY KEY,
  preferences_json TEXT NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_iam_user_preferences_account FOREIGN KEY (account_id) REFERENCES iam_accounts(id) ON DELETE CASCADE
);
