-- API-Token 多令牌与状态机（080）：描述与禁用时间（可逆状态）。
ALTER TABLE iam_api_tokens ADD COLUMN description TEXT NULL;
ALTER TABLE iam_api_tokens ADD COLUMN disabled_at DATETIME NULL;