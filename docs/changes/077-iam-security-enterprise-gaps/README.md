# 077 用户与权限体系企业级完善（口令治理 / 会话上限 / 登录限流）

## 状态

**已确认，实施完成**（用户确认：P1+P2+P3 全部纳入；P2 会话超限=主动剔最旧；P3 限流=扩展 `http.rateLimit` 路径规则；R077-002 六项企业能力可行性结论已归档）。验证：`go test ./...` 84 包全绿、`go vet ./...`、migration 000005 三驱动、config init 模板、docs-guard 全部通过；受限项见 [tasks.md](tasks.md)。

## 目标

按 R077-001 四维评估（完整/通用/闭环/成熟度），补齐「边界内可直接补」的三项企业级缺口：

1. **P1 口令治理**：`passwordPolicy.historySize`（历史口令，禁止最近 N 次复用）+ `maxPasswordAge`（口令过期 → 复用既有受限会话强制改密语义）。
2. **P2 会话上限**：`iam.local.maxSessionsPerAccount`（并发会话达到上限时主动剔最旧）。
3. **P3 登录限流**：扩展 `http.rateLimit` 增加 `/api/v1/iam/login`、`/api/v1/iam/setup` 路径规则（IP 维度，与账号级锁定构成双维度）。

关键边界：全部默认关闭/不限、存量兼容；不新增权限键、不改 Casbin model/授权 authority/受限会话语义；新增行为的操作/授权留痕纳入既有低敏审计面；MFA/TOTP、OIDC/SSO、数据权限、多租户、角色继承/deny/SoD、批量运营、API-Token、异常告警为候选（含触发条件，R077-002 结论），不进入本批。

## 阅读顺序

1. [研究档案](research/README.md)：R077-001（四维评估与边界判定）
2. [需求](requirements.md)：REQ-077-001..006
3. [设计](design.md)：方案对比、数据流、待确认决策
4. [任务清单](tasks.md)：任务与验证矩阵（待确认/执行）