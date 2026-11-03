-- BE-090-005 跨设备用户偏好（090）：每账号一行 JSON 覆盖；缺失即使用默认。
CREATE TABLE iam_user_preferences (
  account_id TEXT PRIMARY KEY REFERENCES iam_accounts(id) ON DELETE CASCADE,
  preferences_json TEXT NOT NULL,
  updated_at DATETIME NOT NULL
);
