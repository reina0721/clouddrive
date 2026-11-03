# 042 任务清单

## 1. 当前状态

- 研究门禁：已通过（`R001`）。
- 计划状态：已确认。
- 实施授权：用户在完整计划报告后的后续消息明确要求实施，并再次明确要求建立本目录。
- 当前状态：前置迁移已形成干净基线，042 的核心代码、CLI、Ops 数据展示和主题能力已实施；完整验收仍缺少 E2E、视觉、真实 HTTPS 与部署验证。
- Git 边界：只提交本次 042 相关源码、迁移、WebUI、文档和生成物；不吸收本地依赖安装目录或构建产物。

## 2. 研究与计划

| ID | 工作量 | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| RES-001 | L | 无 | 复核 Module、Binding、Composition、Auth、Ops、Todo、i18n、HTTP Contract、前端与安全主源 | R001 区分当前事实、用户决策、目标设计、局限和计划影响 | 已完成 |
| PLAN-001 | L | RES-001 | 形成需求、设计、任务与验证方案 | 042 固定文档齐全、互相引用、研究门禁和 Git 阻塞明确 | 已完成 |

## 3. 实施任务

| ID | 工作量 | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| ADM-001 | L | 干净基线 | 实现可选 Admin Binding、Catalog、校验和 revision | Auth/Ops 可聚合；Todo 无 Binding；重复/缺失/环/未知 operation 等 fail closed | 已完成 |
| ADM-002 | L | ADM-001 | 实现 Composition 聚合、Admin Host 与 manifest | 单一 Composition 汇总；manifest 无 SourcePath；访问状态来自 Auth policy | 已完成 |
| GEN-001 | L | ADM-001 | 实现 Admin WebUI codegen | lazy registry、revision、clean check 可验证 | 已完成 |
| AUTH-001 | L | 干净基线 | 实现本地管理员、Argon2id、设置 Token、登录锁定与 migration | 原子首次设置、密码策略、唯一约束、固定成本失败路径 | 已完成 |
| AUTH-002 | L | AUTH-001 | 实现服务端 Session、Cookie、CSRF、过期与撤销 | 32字节随机 ID、摘要存储、安全 Cookie、idle/absolute、Origin/CSRF | 已完成 |
| AUTH-003 | M | AUTH-002 | 分离 Bearer/Admin Session/management 认证路径并增加 reset-password CLI | Todo 不接受 Session；management 接受 Bearer 或 Session；重置撤销 Session | 已完成 |
| WEB-001 | L | GEN-001 | 建立 React/Vite/HeroUI WebUI 宿主与稳定前端契约 | Router/Menu/i18n 从 manifest/registry 装配；模块不能穿透宿主内部实现 | 已完成基础宿主 |
| WEB-002 | L | WEB-001, AUTH-002 | 实现 Auth 模块 setup/login/session 页面 | 使用真实 Auth API，无 Web Storage 凭据 | 已完成基础闭环 |
| WEB-003 | M | WEB-001, ADM-002 | 实现 Ops 真实 Dashboard | build/probe/diagnostics/metrics 使用真实 management 数据，权限与降级可见 | 已完成基础覆盖 |
| WEB-004 | L | WEB-001 | 实现主题、品牌、响应式布局和视觉状态 | 主题预设/编辑/导入导出、桌面/移动布局、403/404/mismatch | 已完成基础覆盖 |
| GOV-001 | M | 全部实施任务 | 同步主题 authority 与模块开发指南 | Admin Binding、Session 运维、WebUI 开发和当前行为进入正式主题文档 | 已完成基础文档 |
| VER-001 | L | 全部实施任务 | 执行 Go/Node/codegen/E2E/视觉/安全验证 | requirements 有可复核证据，失败和未执行项如实记录 | 部分完成：Go/lint/typecheck/build/codegen 已通过 |

## 4. 实施顺序

```text
干净迁移基线
  -> ADM-001
  -> AUTH-001 -> AUTH-002 -> AUTH-003
  -> ADM-002 -> GEN-001
  -> WEB-001 -> WEB-002 + WEB-003 + WEB-004
  -> GOV-001 -> VER-001
```

实现、生成物、测试和权威文档必须同轨收敛。不得先建立模拟页面冒充真实能力，也不得让 Session Cookie 进入普通业务 API。

## 5. 重新确认触发器

- 需要改变普通业务 API 的 Bearer/JWT 语义或让 WebUI Session 成为通用凭据；
- 需要引入动态插件、Module Federation、远程页面或运行时脚本加载；
- 需要为 Todo 或其他未确认模块增加 Admin 页面；
- 需要改变 Kernel Capability、数据库引擎支持、现有 management wire contract 或部署方式；
- 需要 MFA、多管理员治理、密码找回、云主题或外部写入；
- 前置迁移提交后的真实代码推翻 R001 结论。

## 6. 当前证据

| 日期 | 范围 | 证据 | 结论 |
| --- | --- | --- | --- |
| 2026-08-21 | Git 快照 | `git log -1` 为 `8e98d44`；实施前 `git status --branch --short` 干净 | 前置迁移基线满足实施门禁 |
| 2026-08-21 | 现有契约 | `internal/module/contracts.go`、模块开发指南、`applicationHTTPModules()`、Todo/Auth/Ops 模块 | Admin 应复用按需 Binding + 显式 Composition，不建立插件体系 |
| 2026-08-21 | Auth/Ops | Auth 只有开发匿名/JWT；Ops 已有真实 management Handler | Auth 需新建 WebUI Session；Ops 可提供首个真实看板 |
| 2026-08-21 | 外部主源 | HeroUI、Vite、React Router 与 OWASP 官方文档 | 目标前端和 Session/CSRF/密码安全方案可行 |
| 2026-08-21 | 实施验证 | `go test ./...`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm generate:check` | 核心代码、CLI、Ops 数据展示与 WebUI 构建通过；E2E、视觉、真实 HTTPS/部署验证未执行 |
