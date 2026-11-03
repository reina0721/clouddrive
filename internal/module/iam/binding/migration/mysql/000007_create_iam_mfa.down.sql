DROP TABLE iam_mfa_recovery_codes;
DROP TABLE iam_totp_secrets;
ALTER TABLE iam_sessions DROP COLUMN mfa_verified;