# 080 API-Token 多令牌管理与权限知情创建

## 状态

**已确认，实施完成**（用户确认实施与「复杂功能独立页面、安全页只作入口」原则）。验证：`go test ./...` 全绿（越权/生命周期/过滤/上限/TTL 新测试）、`go vet ./...`、migration 000008 三驱动、contract-gen golden（55 operations）、WebUI typecheck/lint/Vitest 144/Playwright 22、docs-guard 全部通过；受限项见 [tasks.md](tasks.md)。

## 目标

1. **权限知情创建**（安全核心）：创建时服务端实时投影创建者有效权限并强制 `token scope ⊆ 创建者权限`（越权 403、未知 404、受限改密禁止管理 403）；授权按令牌自身 scope 生效、与创建者后续权限变化解耦（不自动收缩，治理=禁用/轮换/吊销）。
2. **多令牌与生命周期**：命名/描述、数量上限（默认 5，按未吊销计数）与默认 TTL、状态机 active/disabled/expired/revoked、`PATCH` 元数据与 `disable/enable`、status 过滤、使用观测。
3. **WebUI（独立页 + 入口）**：IAM 独立管理页 `/admin/api-tokens`（列表/创建向导权限勾选/明文一次/开关/轮换/吊销）；设置中心安全页令牌区块降级为入口与摘要（MFA 保留）。

## 阅读顺序

1. [研究档案](research/README.md)：R080-001（差距核实与设计）
2. [需求](requirements.md)：REQ-080-001..008
3. [设计](design.md)：方案对比、数据流、待确认决策
4. [任务清单](tasks.md)：任务与验证矩阵（待确认/执行）