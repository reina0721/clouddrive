CREATE TABLE iam_api_tokens (
  id VARCHAR(36) PRIMARY KEY,
  account_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  scopes TEXT NOT NULL,
  expires_at DATETIME(6) NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL,
  last_used_at DATETIME(6) NULL,
  UNIQUE KEY uq_iam_api_tokens_hash (token_hash),
  CONSTRAINT fk_iam_api_tokens_account FOREIGN KEY (account_id) REFERENCES iam_accounts(id) ON DELETE CASCADE
);
CREATE INDEX ix_iam_api_tokens_account ON iam_api_tokens(account_id);