# 080 研究档案：API-Token 多令牌管理与权限知情创建

## 研究范围

本档案回答：任务提示词（080 立项输入）与现有 `iam.api-tokens` 实现的逐项差距；权限知情创建（scope ⊆ 创建者有效权限）的实现路径；令牌状态机与迁移、数量上限与 TTL 配置语义、契约变更清单；以及既有 token-scopes 授权语义的复核结论。

## 检索方式

- 变更序号 `080`（`docs/changes/README.md`），工作树 clean（`baacb08`）。
- 复用：`078/R078-001`（API-Token 设计）、`079`（敏感写告警）、`058`（授权语义）、`077`（受限会话语义）、`066`（列表过滤先例）。
- 代码证据（`baacb08`）：`iam/service/service.go`（CreateApiToken 1945 / ListApiTokens 1982 / RotateApiToken 2009 / ResolveApiToken 2045）、`iam/repo/repository.go`、`iam/binding/http/{contract,huma}.go`、`iam/authorization/runtime.go`（ProjectPermissions）、`iam/binding/config/config.go`（maxSessionsPerAccount 惯例）、`settings/binding/webui/web/SecurityPage.tsx`（078 基础区块）。
- 平台参考（Cloudflare API Tokens / 腾讯云 CAM / GitHub PAT / AWS IAM Access Keys）：由任务提示词给出设计要点，本档案落实为本项目取舍。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R080-001](R080-001-token-gap-and-inheritance/report.md) | API-Token 多令牌管理与权限知情创建：现状差距、权限继承语义、状态机与契约 | active |