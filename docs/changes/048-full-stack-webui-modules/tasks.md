# 048 实施任务清单

## 1. 当前状态

- 研究门禁：已通过（R001、R002 历史比较、R003 所有权决策、R004 启用与加载门禁）。
- 计划状态：已按“业务模块继续持有 WebUI、core 只提供 SDK、未通过门禁不加载”完成修订并获确认，实施与验收已完成。
- 实施授权：已确认（2026-08-21，用户确认“开始实施 048 方案”）。
- 当前代码事实：SDK public surface、模块边界、Binding/生成门禁、CSS Modules、资源加载隔离和 fixture 验收均已落地。
- Git 边界：只提交本任务确认范围，不 push；最终提交前执行单轨残留审查。

## 2. 研究与计划

| ID | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- |
| RES-001 | 审计当前 Binding/Composition/codegen/Router/host/CSS 耦合 | R001 区分模块所有权与宿主泄漏 | 已完成 |
| RES-002 | 比较集中前端、分离 facet、模块共置与运行时微前端 | R002 保存历史比较，R003 明确用户修订决策 | 已完成 |
| RES-003 | 研究模块自有 WebUI 与 SDK capability 升级边界 | module-local/host-level 判定、SourcePath 和 SDK 约束可实施 | 已完成 |
| PLAN-001 | 修订 requirements/design/tasks | 撤销页面迁移与 SourcePath 删除，形成 SDK 分层和门禁 | 已完成 |
| RES-004 | 研究 Activation/Delivery/Availability/Access 与资源加载顺序 | R004 证明 locale 全量加载缺口并形成 fail-closed 状态模型 | 已完成 |
| PLAN-002 | 补充启用、降级、locale/query 门禁 | requirements/design/tasks 覆盖未完成模块零加载与单模块错误隔离 | 已完成 |

## 3. 待确认基础重构

以下任务只有在用户确认修订后的 048 计划后才能实施。

### Checkpoint A：SDK 与依赖边界

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| SDK-001 | 用户确认 | 盘点并冻结首批 SDK public surface | runtime/http/i18n/query/navigation/ui/feedback 职责、错误和取消语义明确 | 已实施 |
| SDK-002 | SDK-001 | 把现有 contracts/ui 收敛到 `@webui/sdk/*` | 模块只依赖 SDK，第三方易变类型不穿透 | 已实施（首轮） |
| SDK-GOV-001 | SDK-001 | 建立 capability 新增与版本治理 | 无 resolve/get；破坏性变化单轨；module-local/host-level 流程入文档/测试 | 已完成 |
| ARCH-001 | SDK-002 | 建立 import architecture gate | platform 不导入 module、module 只导入 SDK、module 间无 import | 已实施 |

### Checkpoint B：模块所有权闭合

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| STYLE-001 | ARCH-001 | 把 Auth/Ops 业务 CSS 迁回模块 | CSS Modules 生效；global 只含 reset/token/platform；视觉不回归 | 已完成 |
| AUTH-BOUNDARY-001 | SDK-002 | 收敛宿主 Auth Session 耦合 | HostRuntime 只见 Principal/Access/通用动作；Session/CSRF 语义不变 | 已实施 |
| AUTH-MODULE-001 | STYLE-001, AUTH-BOUNDARY-001 | 让 Auth 页面只消费 SDK | 页面仍在 Auth 模块；API/locale/style/test 全部模块自有 | 已实施（首轮） |
| OPS-MODULE-001 | STYLE-001, SDK-002 | 让 Ops 页面只消费 SDK | 页面仍在 Ops 模块；query/API/locale/style/test 全部模块自有 | 已实施（首轮） |
| HOST-CLEAN-001 | AUTH-MODULE-001, OPS-MODULE-001 | 删除宿主业务分支和业务 DTO/CSS | Router/Shell/platform 无具体 ModuleID、业务类型和 selector | 已完成 |

### Checkpoint C：Binding 与生成通用化

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| CATALOG-001 | HOST-CLEAN-001 | 收敛 `applicationWebUIModules()` 唯一注册汇总 | Catalog/generator/runtime manifest 都消费同一 registration 列表 | 已实施 |
| ACT-001 | CATALOG-001 | 建立显式 `ModuleRegistration/ActivationState` | 未指定/未知失败；disabled 不进入 deployable Catalog、registry、manifest | 已实施 |
| DELIVERY-001 | ACT-001 | 收敛 Delivery 投影与可达资源生成 | not-implemented 无默认/菜单/manifest；只生成 implemented 可达 Entry/Locale | 已实施 |
| PATH-001 | DELIVERY-001 | 加固 SourcePath module owner 与边界校验 | 启用内容的相对路径、扩展名、目录/reparse point、runtime 剥离测试通过 | 已实施（首轮） |
| CAP-001 | SDK-GOV-001, ACT-001 | 建立 SDK requirement/inventory fail-fast | enabled 内容的 unknown/missing/major mismatch 在 generate/typecheck 前失败，无 runtime locator | 已实施 |
| GEN-001 | PATH-001, CAP-001 | 证明 generator 完全通用 | disabled/not-implemented 零输出；新 fixture 只改变 Binding 与生成 registry | 已完成 |

### Checkpoint D：运行门禁与错误隔离

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| AVAIL-001 | SDK-GOV-001, ACT-001 | 定义通用 route availability contract 与 provider 聚合 | available/degraded/unavailable authority 明确；缺失/超时/未知 fail closed；无 ModuleID 分支 | 已完成 |
| LOAD-GATE-001 | GEN-001, AVAIL-001 | 在 lazy import 前实现 revision/access/availability route guard | 只有 allowed + available/supported-degraded 触发业务 Entry | 已完成 |
| LOCALE-GATE-001 | LOAD-GATE-001 | 把 i18n 改为 host-first 与 eligible namespace 按需加载 | disabled/not-implemented/denied/unavailable locale 不请求；单模块失败隔离 | 已完成 |
| QUERY-GATE-001 | SDK-002, LOAD-GATE-001 | 建立 query 自动执行与取消门禁 | access/availability/generation 失效即取消；degraded 只请求允许 capability | 已完成 |
| ISOLATION-001 | LOCALE-GATE-001, QUERY-GATE-001 | 建立模块资源与 render 故障隔离 | locale/Entry/page/query 故障不影响 Shell、登录和其他模块 | 已完成 |

### Checkpoint E：验收与单轨交付

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| FIXTURE-001 | ISOLATION-001 | 增加普通 module fixture | 覆盖 enabled/disabled/not-implemented/degraded/unavailable，生产导航无假业务 | 已完成 |
| TEST-001 | FIXTURE-001, HOST-CLEAN-001 | 完成 Go/生成/TS/React/architecture/E2E/visual 门禁 | requirements 状态与零加载矩阵全部有证据 | 已完成 |
| DOC-001 | TEST-001 | 同步 WebUI、应用模块和架构 authority | 新模块接入与新 SDK capability 流程成为唯一当前规范 | 已完成 |
| GIT-001 | DOC-001 | 审查并提交单轨重构 | 旧 import/业务 CSS/宿主耦合无残留，只提交确认范围，不 push | 已完成 |

## 4. 新 SDK capability 的独立任务模板

任何业务模块触发的新宿主能力必须插入以下任务链，不能直接修改 SDK：

```text
CAP-RES-<id>  研究真实用例、现有 SDK 缺口、module-local/host-level 判定
CAP-DES-<id>  定义项目自有 interface、版本、失败/取消/资源语义
CAP-ADP-<id>  在 webui platform 实现 adapter，不含业务 ModuleID
CAP-TST-<id>  contract、architecture、integration test
MOD-ADOPT-<id> 业务模块声明 requirement 并消费 SDK
```

`CAP-DES` 改变 public SDK 或依赖选择时必须重新确认。`MOD-ADOPT` 不得绕过未完成的 adapter task。

## 4.1 本轮实施证据

- Go：`ModuleRegistration`、Activation/Delivery/Availability、SDK inventory、SourcePath owner 校验和统一 Catalog 已接入 `internal/composition`；`GenerateWebUIRegistryForCatalog` 用独立临时模块 fixture 证明生成器不依赖 Auth/Ops 具体集合。
- WebUI：模块源码已迁移到 `@webui/sdk/*` public surface；HostRuntime 不暴露 WebUISession；host locale 先启动，当前 route 的 locale、Entry 和 query 均受 access/availability 门禁。
- 样式与架构：Auth/Ops 页面使用模块 CSS Modules root scope；宿主全局 CSS 仅保留 platform/token/reset；架构扫描拒绝业务 selector、旧 SDK alias、宿主到模块导入和模块间导入。
- Fixture/状态矩阵：Go contract fixture 覆盖 enabled、disabled、not-implemented、denied、unavailable、supported degraded、unsupported degraded；独立 fixture 生成测试覆盖 module-owned source path、Entry 和 locale registry。
- 自动化与视觉：`pnpm e2e -- --workers=1` 覆盖 setup/login/logout/session、denied/unavailable/degraded 和 management 零请求/能力请求；Playwright 生成 Auth/Ops 桌面、移动和暗色截图，并已人工检查 dashboard 响应式布局与主题结果。
- 单轨审查：已完成旧 `@webui/contracts`/`@webui/ui`、业务宿主 selector、SourcePath runtime 泄漏和具体模块宿主分支搜索；不保留兼容别名或第二套实现。

## 4.2 验证命令与结果

以下命令均在 048 最终工作树执行并通过：

```powershell
go test ./...
cd webui
pnpm lint
pnpm lint:modules
pnpm typecheck
pnpm test
pnpm build
pnpm e2e -- --workers=1 --reporter=line
pnpm generate:check
cd ..
git diff --check
```

Playwright 截图保留在被 Git 忽略的 `webui/test-results/` 运行产物中；它们是验收证据，不进入生产 registry 或提交内容。

## 5. 后续独立业务变更

| 候选变更 | 业务模块持有内容 | 可能触发的 SDK 研究 |
| --- | --- | --- |
| 完整 Account | 用户、凭据、角色、权限、Session、安全策略、页面和 API | identity/session、全局账号菜单 |
| Audit | 审计事件、查询、详情、导出、脱敏、页面 | 大文件下载或全局任务中心 |
| System Settings | 配置候选、校验、diff、应用结果、页面 | navigation blocker、全局变更状态 |
| Maintenance Tools | 明确 owner 的运维动作、Execution Record、审计、页面 | 长任务进度、SSE/WebSocket |

“可能触发”不代表提前建设；只有真实用例且现有 SDK 不足时才进入 capability 任务链。

## 6. 实施顺序

```text
A: SDK-001 -> SDK-002 -> SDK-GOV-001 -> ARCH-001
  -> B: STYLE-001 -> AUTH-BOUNDARY-001 -> AUTH-MODULE-001
        OPS-MODULE-001 -> HOST-CLEAN-001
  -> C: CATALOG-001 -> ACT-001 -> DELIVERY-001 -> PATH-001
        CAP-001 -> GEN-001
  -> D: AVAIL-001 -> LOAD-GATE-001 -> LOCALE-GATE-001
        QUERY-GATE-001 -> ISOLATION-001
  -> E: FIXTURE-001 -> TEST-001 -> DOC-001 -> GIT-001
```

如果实施中发现某个现有 Auth/Ops 需求需要新 SDK capability，先插入第 4 节任务链；不能在模块迁移任务里顺手扩展 core。

## 7. 验证矩阵

| 范围 | 计划检查 |
| --- | --- |
| Go Contract | registration/activation、Binding owner/path、delivery、duplicate、operation、SDK requirement |
| Codegen | disabled/not-implemented 零输出、普通 module 不改 generator、runtime manifest 无 SourcePath |
| Frontend | SDK public API、lint、typecheck、unit、build |
| Architecture | platform 无 module import/ID；module 只 import SDK；module 间零 import |
| Style | global CSS 无业务 selector；CSS Modules scoped |
| Security | Session/CSRF/Origin/CORS/Cookie/operation gate 不回归 |
| Runtime state | access/availability 门禁先于 Entry/Locale/Query；状态失效取消请求 |
| Isolation | 单模块 locale/Entry/page/query 故障不影响 Shell、登录与其他模块 |
| E2E | setup/login/logout/session、403/404/unavailable/degraded、Ops 真实 query、route lazy/error |
| Visual | Auth/Ops 桌面/移动、明暗主题与状态 |
| Ordinary module | 只改 module + composition，`webui/` core 零 Diff |
| New capability | interface/adapter 无 ModuleID，contract test 先于 adoption |
| Diff | `git diff --check`，旧 import/业务 CSS/耦合说明无残留 |

## 8. 重新确认触发器

- 新增或破坏性修改 SDK public interface；
- platform 引入新的第三方技术或全局资源/lifecycle；
- 需要 runtime resolver、远程模块、动态安装或跨模块共享可变状态；
- 需要改变 Session/CSRF/Origin、数据库 migration、API path 或 operation；
- SourcePath 需要越过模块目录；
- Activation 需要从重新构建改为运行时热启用或动态 registry；
- availability authority、状态集合、degraded capability 或默认呈现策略改变；
- 普通模块无法在 core 零修改前提下接入；
- 业务模块需要访问另一个模块或 platform internal。
