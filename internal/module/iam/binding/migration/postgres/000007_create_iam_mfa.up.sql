-- MFA/TOTP（078，R078-002）：会话标记 MFA 完成状态（登录两步后为 true）。
ALTER TABLE iam_sessions ADD COLUMN mfa_verified BOOLEAN NOT NULL DEFAULT FALSE;
-- TOTP 种子：账号最多一个已确认绑定；secret 以文本存 base32（确认后不再返回）。
CREATE TABLE iam_totp_secrets (
  account_id TEXT PRIMARY KEY REFERENCES iam_accounts(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ NULL
);
-- 恢复码：一次性使用；只存哈希。
CREATE TABLE iam_mfa_recovery_codes (
  account_id TEXT NOT NULL REFERENCES iam_accounts(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ NULL,
  PRIMARY KEY (account_id, code_hash)
);