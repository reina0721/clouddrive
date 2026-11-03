# 077 任务清单：用户与权限体系企业级完善（口令治理 / 会话上限 / 登录限流）

## 状态

研究门禁已通过（[R077-001](research/R077-001-enterprise-iam-gap-audit/report.md)、[R077-002](research/R077-002-enterprise-capabilities-feasibility/report.md)）；计划已确认（用户确认：P1+P2+P3 全部纳入；P2 会话超限=主动剔最旧；P3 限流=扩展 http.rateLimit 路径规则；R077-002 六项可行性结论写入计划）；**实施完成并验证**（2026-09）。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-077-001` | M | — | 研究档案（四维评估、边界内/候选判定） | metadata/report/README 齐全；门禁通过 | 完成 |
| `RES-077-002` | M | RES-077-001 | 企业能力可行性分析（MFA/API-Token/风险控制/操作留痕/授权留痕/异常告警） | metadata/report 齐全；结论写入计划 | 完成 |
| `PLAN-077-001` | M | RES | 需求/设计/任务/影响计划并提交确认 | 文档齐全；用户确认范围与决策 | 完成 |
| `P1-077-001` | M | 确认 | 口令历史（migration 000005 历史表 + repo 记录/查询/裁剪 + service 复用校验 + passwordPolicy.historySize + HTTP 409 + 审计联动） | 历史复用拒绝；N 裁剪；默认 0 兼容 | 完成 |
| `P1-077-002` | M | P1-001 | 口令过期（凭据 changed_at 列 + maxPasswordAge + 登录/解析过期判定复用受限会话 + 改密清除） | 过期登录受限改密；改密恢复；默认 0 兼容 | 完成 |
| `P2-077-001` | M | 确认 | 会话数量上限（config maxSessionsPerAccount + createSession 事务内剔最旧 + 审计联动） | 超限剔最旧；会话总数保持上限；默认不限 | 完成 |
| `P3-077-001` | M | 确认 | 登录 IP 限流（pkg/httpx.PathRateLimiter 按路径规则 + http.rateLimit.routes 配置 + kernel/composition 装配 + config init/example） | 路径独立 bucket；全局回退；无效规则拒载；默认不启用 | 完成 |
| `TEST-077-001` | M | 上述 | Go 测试（历史/过期/会话剔旧/路径限流 + 迁移 + 默认兼容 + 审计边界） | `go test ./...` 84 包、`go vet ./...` 全绿 | 完成 |
| `DOC-077-001` | M | 上述 | 更新 security.md/runtime-capabilities.md/配置说明/模块 README/变更记录 + config init/example | docs-guard 通过；config init 实测生成新节 | 完成 |
| `VER-077-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 84 包全绿（含 historySize/maxPasswordAge/maxSessions/PathRateLimiter 新测试） |
| Go 静态 | `go vet ./...` | 通过 |
| 迁移 | IAM migration set up/down（000005 三驱动 + SHA256） | 通过（set_test 校验） |
| 配置模板 | `go run ./cmd/app config init`（临时输出） | 生成 historySize/maxPasswordAge/maxSessionsPerAccount/routes 节 |
| 文档 | docs-guard | 通过 |
| 契约 | 无新 HTTP operation；错误码复用既有 stable codes | 复核通过 |

## 未执行/受限项

- **MFA/TOTP、OIDC/SSO/LDAP、数据权限、多租户、角色继承/deny/SoD、批量导入导出**：候选（R077-001/002），未授权、不实施。
- **API-Token、异常告警**：R077-002 判定为边界内可新增（下一批候选），未实施。
- **动态风险控制**：R077-002 判定需独立设计研究（因子/数据源/与 MFA/告警联动），未实施。
- **WebUI 页面**：本批无前端改动（会话页/安全页复用既有语义；限流/历史/过期为服务端配置能力）。
- 多实例一致性验证：保持既有独立边界（限流/会话治理为进程级）。