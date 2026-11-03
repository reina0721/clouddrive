-- API-Token 多令牌与状态机（080）：描述与禁用时间（可逆状态）。
ALTER TABLE iam_api_tokens ADD COLUMN description VARCHAR(1024) NULL;
ALTER TABLE iam_api_tokens ADD COLUMN disabled_at DATETIME(6) NULL;