-- MFA/TOTP（078，R078-002）：会话标记 MFA 完成状态（登录两步后为 true）。
ALTER TABLE iam_sessions ADD COLUMN mfa_verified TINYINT(1) NOT NULL DEFAULT 0;
-- TOTP 种子：账号最多一个已确认绑定；secret 以文本存 base32（确认后不再返回）。
CREATE TABLE iam_totp_secrets (
  account_id VARCHAR(36) PRIMARY KEY,
  secret TEXT NOT NULL,
  confirmed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  confirmed_at DATETIME(6) NULL,
  CONSTRAINT fk_iam_totp_secrets_account FOREIGN KEY (account_id) REFERENCES iam_accounts(id) ON DELETE CASCADE
);
-- 恢复码：一次性使用；只存哈希。
CREATE TABLE iam_mfa_recovery_codes (
  account_id VARCHAR(36) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  used_at DATETIME(6) NULL,
  PRIMARY KEY (account_id, code_hash),
  CONSTRAINT fk_iam_mfa_recovery_account FOREIGN KEY (account_id) REFERENCES iam_accounts(id) ON DELETE CASCADE
);