# 061 任务清单

## 1. 门禁状态

- 研究门禁：已通过（R061-001、R061-002；R061-002 针对用户“全 WebUI mock + 显式声明 + i18n 双语”要求补充的架构研究）。
- 计划状态：**已确认**（用户于计划报告后明确“确认，实施”，采纳决策 1–5 推荐项）。
- 待确认决策：见 `design.md` §8（决策 1：模式 B facade；决策 2：模块自有 mock + 生成 registry + SDK 能力 mock；决策 3：mock manifest 生成；决策 4：未知子路径 JSON 404；决策 5：`webui build` 拒绝 mock）——**全部按推荐采纳**。
- 相关前置：060 已提交（`86c2ca8`），当前 HEAD `20a634c`，工作区干净；本任务只处理 061 文件与对应实现/文档范围，不动 `frontend/`、`old-backend/`、CORS/Session/Origin 取值与其它模块非 WebUI 导出面。

## 2. 研究与计划

| ID | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- |
| `RES-061-001` | 定位模式 B 下 `/management/*` 4xx 根因与两种模式数据通路 | R061-001 区分事实/推断，覆盖 handler 注册、listener 组成、SPA 排除、Vite 代理、060 E2E 断言 | 已完成 |
| `RES-061-002` | 全 WebUI mock 设计（端点清单、boot/revision 门禁、Catalog 单一来源、归属与 i18n） | R061-002 覆盖事实、推断、候选与推荐 | 已完成 |
| `PLAN-061-001` | 形成需求、设计、文件影响、验证与任务计划（含显式声明、默认 server-hosted、全 WebUI mock） | requirements/design/tasks/README 齐全，状态“待确认”，提交计划报告 | 已完成 |

## 3. 实施任务（待确认后启用）

| ID | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| `SRV-061-001` | 决策 1 | `internal/module/ops/binding/http` 导出 `ManagementRoutePaths()` 并让注册循环消费 | 路径清单单一来源；handler_test 覆盖清单与注册一致；management 行为不回归 | 已完成 |
| `SRV-061-002` | SRV-061-001 | `applicationRouter` 增加 facade 参数并按清单注册已知子路径 GET handler；模式 B 由 generation 传入 `generation.opsModule.ManagementHTTP` | 模式 B `/management/readyz` 200 JSON、`/management/metrics` 按 metricsAccess、未知子路径 404 JSON、非 GET 405；模式 A 回归 404 | 已完成 |
| `CTR-061-001` | 决策 2/3 | `internal/webui` Binding 契约增加 `MockSource`（Entry⇒必需、路径归属/扩展名校验）；SDKInventory 增加 `mock` 能力；生成器渲染 `webuiMockRegistry` 与 `webuiMockManifest`（catalog 投影、revision 一致） | 契约测试、生成稳定性（`generate --check`）、manifest `catalogRevision==Revision`、全路由 allowed/available | 已完成 |
| `WEB-061-001` | 决策 2 | 宿主 mock 传输层：`contracts.requestJSON/requestText` 按 `readWebUIDataSource()==="mock"` 切换 `webui/src/mock/router.ts`；宿主 mock（manifest/session/logout）`host.ts`；新增 `@webui/sdk/mock` 类型与 vite alias | mock 模式零真实请求；未命中 404 语义与真实同构；`server-hosted/separated` 零 mock 路径 | 已完成 |
| `WEB-061-002` | 决策 5 | 环境声明配置：`VITE_WEBUI_DATA_SOURCE`（三值、默认 `server-hosted`）接入 `.env.example`、typed 解析器校验、`vite-env.d.ts` 类型、`@webui/sdk/runtime` re-export、`webui build` 拒绝 mock | 默认/覆盖/非法回退正确；tooling 非法值启动前失败；解析测试覆盖 | 已完成 |
| `WEB-061-003` | CTR-061-001 | 四个模块（iam/organization/navigation/ops）新增 `binding/webui/web/mock.ts`（复用自身 `api.ts` 类型）并在 Binding 声明 `MockSource` 与 Requires mock | 每模块 fixture 形状与页面用例一致；registry 覆盖全部 Entry 模块 | 已完成 |
| `WEB-061-004` | WEB-061-001 | 全局模拟标识：`MockBadge`（AppShell，`webui.host.mock.*` 双语）；Ops 数据层 `environment.ts`（声明 mock 由传输层接管；真实模式探测 connected/unreachable + `source.unreachable.*` 双语横幅） | 徽标双语渲染；Ops unreachable 降级（`—`、重试、零伪造）；i18n 门禁通过 | 已完成 |
| `TEST-061-001` | SRV-061-002, WEB-061-001..004 | Go facade/契约/生成测试翻转扩展；Vitest（声明读取、mock router、revision 一致、模块 mock 形状、徽标、Ops 降级） | 验收标准 8/9 证据；本机 `go test`、`pnpm test` 通过 | 已完成 |
| `E2E-061-001` | WEB-061-003, TEST-061-001 | 本机验收：模式 B 真实数据（登录 → 运行状态 available；`curl /management/readyz` 200、未知 404）；mock 模式（无后端 boot + 全页面导航 + 徽标双语）；Playwright mock/托管 project 受限记录 | 验收标准 1/2/5；受限项记录 CI/后续 | 已完成（本机：Playwright mock project 通过（零后端 boot/导航/双语徽标）、dev project 10 用例通过、模式 B 冒烟：`/` SPA 200、`/management/build` 200、`/management/readyz` 200 JSON、`/management/nope` 404 JSON Problem；托管模式浏览器完整会话验收记录为 CI/后续项） |
| `DOC-061-001` | TEST-061-001 | 同步 authority 文档与 `config.example.yaml`、`webui/.env.example`，标注 060/024 遗留表述被替换 | 验收标准 10；`Verify-Docs` 通过；残留只在历史变更记录 | 已完成 |
| `GIT-061-001` | DOC-061-001, E2E-061-001 | 审查 diff、运行全量验证并提交 | 只 stage 061 文件；Conventional Commit；不 push | 本提交执行 |

## 4. 实施顺序

```text
SRV-061-001 -> SRV-061-002 -> CTR-061-001 -> WEB-061-002 -> WEB-061-001 -> WEB-061-003 -> WEB-061-004 -> TEST-061-001 -> E2E-061-001 -> DOC-061-001 -> GIT-061-001
```

实施中若发现必须改变公开业务 API 契约、CORS/Session/Origin 语义、模块 owner 边界、manifest 契约（除本任务声明的 `MockSource` 扩展）或引入新第三方依赖，退回研究/待确认并更新计划。

## 5. 验证矩阵

| 范围 | 命令/证据 |
| --- | --- |
| Go | `go test ./... -count=1`、`go vet ./...`；composition/ops/webui-contract 定向测试 |
| WebUI | `pnpm generate:check`、`pnpm lint`、`pnpm lint:modules`、`pnpm lint:i18n`、`pnpm typecheck`、`pnpm test`；`project-layout.test.mjs` 枚举校验 |
| 环境声明 | 默认 `server-hosted`；`separated`/`mock` 覆盖生效；非法值 tooling 失败 + 客户端回退；`webui build` 拒绝 mock（决策 5） |
| 路由语义 | 模式 B：`/management/{startupz,livez,readyz,build}` 200 JSON、`/diagnostics`/`/metrics` 按授权、未知子路径 404 JSON、非 GET 405、不回退 HTML；模式 A：`/management/*` 404 回归 |
| mock 传输层 | 声明 mock 零真实请求；router 路径+方法匹配与未命中 404 语义；真实声明零 mock 路径 |
| mock 覆盖 | `webuiMockRegistry` 覆盖全部 Entry 模块；模块 mock 与自带类型一致；mock manifest `catalogRevision==webuiRevision`；徽标双语 |
| Ops 分级 | 真实模式 connected/unreachable；unreachable 显示横幅与 `—`、可重试、零伪造；单能力失败语义不回归 |
| E2E | 模式 B 浏览器运行状态页；mock 无后端全导航；Playwright 受限记录 |
| 文档 | `Verify-Docs`；`060/024` 遗留表述只在历史记录 |
| 范围 | 未新增公开 API operation；CORS/Session/Origin 取值未变；无新第三方依赖；`frontend/`、`old-backend/` 未动 |

## 6. 重新确认触发器

- 用户拒绝决策 1（不接受模式 B 业务 listener 暴露 management 集合）→ 回到研究，评估“新增受保护业务 API 端口”或“前端直连 9090 + CORS”等替代路径。
- 用户拒绝决策 2/3（例如要求 mock 集中宿主、或允许手写 manifest）→ 更新设计（涉及契约/所有权边界时必须返回研究）。
- 用户要求环境声明的其它承载方式（如 Go 侧注入、manifest 字段、运行时接口）→ 更新设计（涉及 Manifest 契约时必须返回研究）。
- 需要把管理面折叠进公开 API 契约、改变 metricsAccess/scope 策略或引入新前端依赖（如 MSW）→ 返回研究/待确认。