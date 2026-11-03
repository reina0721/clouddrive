CREATE TABLE iam_api_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES iam_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  last_used_at DATETIME NULL
);
CREATE INDEX ix_iam_api_tokens_account ON iam_api_tokens(account_id);