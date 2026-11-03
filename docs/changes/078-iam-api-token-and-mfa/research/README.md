# 078 研究档案：API-Token 与 MFA/TOTP

## 研究范围

本档案回答两项企业级能力的现状、设计取向与实施边界（承接 R077-002 判定）：

1. **R078-001**：API-Token——机器访问令牌的发放/使用/轮换/吊销/审计闭环如何落在既有 IAM+Auth 边界内（含新增权限键的必要性）。
2. **R078-002**：MFA/TOTP——RFC 6238 实现路径与技术选型结论（含第三方候选无法在线复核时的决策）。

## 检索方式

- 按 `docs/changes/README.md` 确认下一个变更序号为 `078`；工作树 clean（commit `edc8151`，077 完成）。
- 复用：`R077-002`（六项可行性结论：API-Token 边界内可新增、MFA 需先选型）、`054/058`（IAM/Auth 边界）、`064`（MFA 候选）、076 密码/会话治理。
- 代码证据：`internal/module/iam/{repo,service,binding/http,permission}`、`internal/module/auth/{{model,service},middleware,binding/http}`、`internal/composition/identity_access.go`、`api/openapi.yaml`，快照 commit `edc8151`。
- 外部选型：RFC 6238（IETF 官方标准，语义自含）为 TOTP 唯一实现依据；`pquerna/otp` 为业界成熟候选，但**本次 web 检索通道不可用（认证失败），无法按 AGENTS 3.2 用官方源码/文档复核其当前维护状态与安全记录**，因此不作为默认选项。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R078-001](R078-001-api-token-design/report.md) | API-Token 闭环设计：凭据模型、认证链、管理面、权限键与审计 | active |
| [R078-002](R078-002-mfa-totp-selection/report.md) | MFA/TOTP 技术选型：RFC 6238 标准、自研 vs 第三方、实施边界 | active |