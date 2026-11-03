# 078 API-Token 机器访问能力（+ MFA/TOTP 选型归档）

## 状态

**已确认，实施完成**（用户确认：API-Token + MFA/TOTP 一起实施；含 WebUI 管理区块）。验证：`go test ./...` 全绿（含令牌生命周期/MFA 两步/挑战/恢复码新测试）、`go vet ./...`、migration 000006/000007 三驱动、contract-gen golden（52 operation、23 权限键）、Vitest 144、typecheck/lint:modules/lint:i18n/lint:architecture 通过、docs-guard 通过；受限项见 [tasks.md](tasks.md)。

## 目标

1. **API-Token（实施完成）**：机器访问凭据完整闭环——`iam_<secret>` 高熵 token（sha256 存储、明文仅一次）、Bearer 复合认证链（JWT→API-Token）、管理面 HTTP + 新权限键 `iam:api-token:read/write`、低敏审计；token-scopes 直达既有授权，授权路径零改动。
2. **MFA/TOTP（实施完成）**：RFC 6238 自研实现（官方向量验证互通、零第三方）；自助绑定/确认/解绑、一次性恢复码、登录两步（`mfa_required` 挑战 + `login/mfa-verify`）、会话 `mfa_verified` 标记；只加强认证，不改变授权权威。
3. **WebUI（实施完成）**：设置中心安全页新增 MFA 与 API 令牌区块（创建/轮换明文一次显示），settings mutation 统一携带 Session CSRF（076 语义）。

关键边界：不改变授权 authority/Session/CSRF/token-scopes 语义；secret 不落日志与审计、明文仅一次；API-Token 不替代 Session。

## 阅读顺序

1. [研究档案](research/README.md)：R078-001（API-Token 设计）、R078-002（MFA 选型）
2. [需求](requirements.md)：REQ-078-001..008
3. [设计](design.md)：方案对比、数据流、待确认决策
4. [任务清单](tasks.md)：任务与验证矩阵（待确认/执行）