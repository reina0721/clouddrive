# 052 项目布局与可配置值集中声明任务

## 确认状态

研究门禁已通过；用户已确认当前计划，进入实施与验证。

| ID | 任务 | 状态 | 完成条件 |
| --- | --- | --- | --- |
| `LAYOUT-052-001` | 建立 layout schema、Go/Node loader 与安全校验 | 已完成 | `.scaffold/layout.json`、严格 JSON/路径校验、Go/Node fixture 通过 |
| `LAYOUT-052-002` | 单轨迁移 Go WebUI Binding 与 registry 生成 | 已完成 | facet-relative SourcePath、layout owner、动态 import、无 cwd fallback |
| `LAYOUT-052-003` | 迁移 Node discovery、lint、Vite、Vitest、TSConfig 与 package scripts | 已完成 | shared loader、动态 discovery、生成式 TSConfig 与脚本入口通过 |
| `LAYOUT-052-004` | 建立 WebUI typed development config | 已完成 | Vite/Playwright 共用 parser，`.env.example` 与 port/URL 覆盖测试通过 |
| `LAYOUT-052-005` | 集中 API/WebUI generated artifact paths | 已完成 | Go generator 默认读取 layout，显式 flags 保留，quality/CI/release 使用布局输出 |
| `LAYOUT-052-006` | 集中 tools/release/container smoke 声明 | 已完成 | Windows/Linux 工具与 release 路径读取 layout，container smoke 支持受控管理端点 |
| `LAYOUT-052-007` | 收敛 application 默认 config path | 已完成 | Service/config init 共用 application declaration，Kernel CLI 接收入参；layout tool 校验 identity `config_filename` 一致，产品 identity migration 仍按计划延期 |
| `LAYOUT-052-008` | 增加残留扫描与反向失败门禁 | 已完成 | loader/生成检查、Node layout test 与现有 lint 对旧路径和不安全覆盖失败 |
| `LAYOUT-052-009` | 同步当前 authority 与 documentation impact | 已完成 | WebUI 开发、README、启动与变更文档已同步 |
| `LAYOUT-052-010` | 完成跨平台与全量验证并提交 | 已完成 | Go/WebUI/docs/静态检查已通过；Bash、Docker、Playwright E2E 未在当前 Windows 环境执行并已明确记录 |

## 依赖顺序

```text
001
 ├─> 002 ─> 003 ─> 004
 ├─> 005 ─> 006
 └─> 007
002..007 ─> 008 ─> 009 ─> 010
```

## Checkpoint

- Checkpoint A（001）：冻结 schema、bootstrap locator、path normalization 与 Go/Node 等价 fixture。
- Checkpoint B（002–004）：WebUI layout 与 dev config 单轨迁移完成，默认行为不变。
- Checkpoint C（005–007）：generated/delivery/application default owner 收口。
- Checkpoint D（008–010）：残留搜索、文档、全量验证与单一 Conventional Commit。

任一 Checkpoint 发现需要新公共配置字段、产品身份变更、Auth/Kernel 策略变化、`frontend/` 集成或外部副作用时，状态退回“待确认”。

## 审计命中但延期的候选

以下是 R002 已确认存在的候选，不属于 052 实施任务：

- Auth lockout 次数/时长与 Session touch interval；
- JWKS HTTP transport KeepAlive/IdleConn 等调优；
- Kernel Host health check timeout；
- 产品身份、cookie、scheduler namespace 与 release 名称的一致性迁移；
- 独立 `frontend/` 的构建/配置/退役审计。

它们必须分别说明真实运维需求和兼容/安全影响后再形成新计划。

## 本轮收尾

实现已在确认范围内完成；最终验证只报告实际执行的 Windows 环境结果，Linux、Docker、Playwright E2E 等未执行项不得伪称通过。
