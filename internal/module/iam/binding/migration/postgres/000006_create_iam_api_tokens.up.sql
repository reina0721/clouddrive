CREATE TABLE iam_api_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES iam_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NULL
);
CREATE INDEX ix_iam_api_tokens_account ON iam_api_tokens(account_id);