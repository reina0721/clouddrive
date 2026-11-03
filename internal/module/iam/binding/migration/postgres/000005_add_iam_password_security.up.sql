-- 口令治理（077）：凭据表记录最近一次改密时间，用于 maxPasswordAge 过期判定。
ALTER TABLE iam_local_credentials ADD COLUMN password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE iam_local_credentials SET password_changed_at = updated_at;
-- 口令历史表：只存哈希，供 passwordPolicy.historySize 禁止最近 N 次复用。
CREATE TABLE iam_password_history (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES iam_accounts(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_iam_password_history_account ON iam_password_history(account_id, created_at);