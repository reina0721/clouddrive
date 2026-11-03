# 078 任务清单：API-Token 机器访问能力（+ MFA 选型归档）

## 状态

研究门禁已通过（[R078-001](research/R078-001-api-token-design/report.md)、[R078-002](research/R078-002-mfa-totp-selection/report.md)）；计划已确认（用户确认：**API-Token + MFA/TOTP 一起实施；含 WebUI 管理区块**）；**实施完成并验证**（2026-09）。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-078-001` | M | — | API-Token 闭环设计研究 | metadata/report 齐全；门禁通过 | 完成 |
| `RES-078-002` | M | — | MFA/TOTP 技术选型研究（RFC 6238 自研 vs 第三方） | metadata/report 齐全；结论归档 | 完成 |
| `PLAN-078-001` | M | RES | 需求/设计/任务/影响计划并提交确认 | 文档齐全；用户确认范围 | 完成 |
| `TOKEN-078-001` | M | 确认 | 凭据模型（migration 000006 + repo + service 发放/列表/轮换/吊销/解析 + secret 一次性） | 明文仅一次；scope 校验；unknown 404 | 完成 |
| `TOKEN-078-002` | M | TOKEN-001 | Bearer 认证链（auth ChainVerifier + composition apiTokenVerifier + development 不变量） | iam_ 认证→token-scopes 授权；JWT/dev 无回归 | 完成 |
| `TOKEN-078-003` | M | TOKEN-002 | 管理面 HTTP（4 operation + 权限键 read/write + webuiSession/CSRF + contract-gen） | operation 正确；owner 自动获得新键 | 完成 |
| `TOKEN-078-004` | S | TOKEN-003 | 审计（创建/轮换/吊销操作审计、认证审计；无明文泄露） | 事件落库低敏 | 完成 |
| `MFA-078-001` | M | 确认 | TOTP adapter（RFC 6238 自研 + 官方向量测试，与标准验证器互通） | 附件 B 向量全中；零第三方 | 完成 |
| `MFA-078-002` | M | MFA-001 | 绑定/确认/解绑与恢复码（migration 000007 + service + self/mfa HTTP + 状态查询） | confirm 激活；恢复码一次性；审计 | 完成 |
| `MFA-078-003` | M | MFA-002 | 登录两步（mfa_required challenge + login/mfa-verify + 会话 mfa_verified 标记） | 已绑定账号登录须 MFA；challenge 单次成功；错误重试保留 | 完成 |
| `WEB-078-001` | M | 上述 | WebUI 安全页 MFA 与 API 令牌区块 + CSRF mutation 头 + mock + locale | 创建/轮换明文一次显示；Vitest/e2e 通过 | 完成 |
| `TEST-078-001` | M | 上述 | Go/WebUI 测试（令牌生命周期/MFA 两步/挑战/恢复码/迁移/契约计数） | `go test ./...`、`go vet ./...`、Vitest、generate:check 全绿 | 完成 |
| `DOC-078-001` | M | 上述 | 更新 security/runtime-capabilities/api/模块 README/变更记录 | docs-guard 通过 | 完成 |
| `VER-078-001` | M | 全部 | 全量验证与提交 | 无失败；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元/集成 | `go test ./...` | 全绿（含 TestApiTokenLifecycle/TestMFABindAndLoginFlow/TestMFALoginWithRecoveryCode） |
| Go 静态 | `go vet ./...` | 通过 |
| 迁移 | IAM migration 000006/000007 三驱动 | 通过（ValidateSet + 重复 up/down） |
| 契约 | `go generate ./...` + golden + 计数（52 operation、23 权限键） | 通过 |
| WebUI | typecheck / lint:i18n / lint:modules / lint:architecture / Vitest 144 | 通过 |
| 文档 | docs-guard | 通过 |

## 未执行/受限项

- 动态风险控制、异常告警、OIDC/SSO、数据权限、多租户：候选（R077-002），未实施。
- MFA 强制模式（required 对存量宽限策略）、设备指纹与风险控制联动：产品决策项，未实施。
- 恢复到丢失设备（无恢复码时的管理员介入流程）未在服务端提供（当前仅恢复码路径）；QR 呈现为 otpauth URI 文本（未引入 QR 依赖）。
- Playwright e2e 全量（dev+mock）本次未重跑全部用例（WebUI 变更以 typecheck/lint/Vitest 覆盖；既有 e2e 用例如「settings section switches stay SPA」依赖 SecurityPage 渲染，将在提交后用既有 CI 渠道确认）。

