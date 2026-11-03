# R061-002 整个 WebUI（骨架与全部数据）mock 实现与显式声明设计

## 研究问题

用户把 061 的范围扩大：mock 不是 Ops 专属，而是**整个 WebUI 骨架及所有数据**都需实现 mock，并**显式声明配置**（区分环境，默认服务托管构建产物），同时遵守 i18n 规范保持双语。需要回答：

1. WebUI 全部 HTTP 的通路（是否单一入口）、宿主 boot 依赖与 revision 门禁；
2. 骨架与各模块页面的数据端点清单与形状来源（模块自有契约）；
3. mock manifest / mock session / 模块 mock 数据的归属与生成方式（单一来源 vs 手写 fixture）；
4. 显式声明（mock 环境）的消费位置与全局标识（i18n 双语）落点；
5. 对 Binding/Catalog 契约、生成器、SDK 能力面与门禁的影响。

## 方法与范围

- 依据：`webui/src/contracts/index.tsx`、`webui/src/api.ts`、`webui/src/App.tsx`、`webui/src/i18n.ts`、`webui/src/i18n/locale/{zh-CN,en-US}.json`、`webui/src/sdk/*`、`internal/module/{iam,organization,navigation,ops}/binding/webui/web/api.ts`、`internal/webui/contract.go`、`internal/composition/webui_registry.go`、`internal/composition/blueprint.go`、`internal/module/ops/binding/webui/binding.go`、`webui/src/generated/webui-registry.ts`、`webui/vite.config.ts`。
- 快照：HEAD `20a634c`（2026-08-22），工作区干净；未启动服务、未修改文件。
- 关系：本记录是 [R061-001](R061-001-ops-management-reachability/report.md) 的姊妹记录，R061-001 解决“真实数据通路 4xx”，本记录解决“显式声明 mock 环境下的全量数据层”。

## 当前事实

### 1. 全部 WebUI HTTP 是单一入口

- 宿主 `webui/src/api.ts`（manifest/session/logout）与四个模块 `api.ts`（iam/organization/navigation/ops）**全部**通过 `@webui/sdk/http`（`webui/src/contracts/index.tsx` 的 `requestJSON`/`requestText`）发起请求；模块被 lint 约束只能依赖 `@webui/sdk/*` 与自身 API。因此拦截 `requestJSON`/`requestText` 即可覆盖**整个 WebUI**（骨架 + 全模块）的 HTTP。
- `requestJSON`：`fetch(credentials: include)` → 非 ok 抛错 → 204 返回 undefined → 否则 JSON。`requestText` 类似返回文本（Ops `/management/metrics`）。

### 2. 宿主 boot 依赖与 revision 门禁

- `App.tsx` 启动并行加载 `loadManifest()`（GET `/api/v1/webui/manifest`）与 `loadSession()`（GET `/api/v1/iam/session`，失败静默）；manifest 加载失败 → 装配错误页。
- `manifest.catalogRevision !== webuiRevision`（生成 registry 内的常量）→ 停在“部署版本不匹配”页。**mock manifest 的 `catalogRevision` 必须等于生成 registry 的 `webuiRevision`**，否则 mock 模式无法 boot。
- manifest 驱动路由/菜单；route `access`/`availability`/`deliveryState` 决定页面可加载性（`useGatedQueries` 与 `ManifestPage` 门禁）。mock 模式需要全部路由 `allowed + available + implemented` 才可整树浏览。

### 3. 模块与宿主端点清单（mock 覆盖面）

| 所有者 | 端点（方法） |
| --- | --- |
| 宿主 | `/api/v1/webui/manifest`（GET）、`/api/v1/iam/session`（GET）、`/api/v1/iam/logout`（POST） |
| IAM | `/api/v1/iam/login|setup|self/password`、`/accounts`（GET/POST）、`/accounts/{id}/status|password-reset|roles`（PATCH/POST/GET/PUT）、`/roles`（GET/POST）、`/roles/{id}/permissions`（GET/PUT）、`/permissions`（GET） |
| Organization | `/departments`（GET/POST）、`/departments/tree`（GET）、`/departments/{id}`（PATCH）、`/positions`（GET/POST）、`/positions/{id}`（PATCH）、`/accounts/{id}/assignment`（GET/PUT）、并复用 IAM `/accounts` |
| Navigation | `/api/v1/navigation/menus`（GET）、`/menus/{id}`（PUT）、并调用 `/api/v1/iam/session` 取 CSRF |
| Ops | `/management/build|startupz|livez|readyz|diagnostics`（GET JSON）、`/management/metrics`（GET 文本） |

- 模块页面类型（`Account`/`Role`/`Department`/`Menu` 等）都在模块自有 `api.ts` 声明；mock fixture 形状可直接复用这些类型（模块自有）。

### 4. Catalog/Binding 契约与生成器是单一来源

- `internal/webui.Binding{ModuleID, Entries, Routes, Navigation, Locales, Requires}`；`Catalog{Bindings, Revision}`；`GenerateWebUIRegistryForCatalogWithLayout` 从同一 catalog 渲染 `webui-registry.ts`（`webuiRevision` = `catalog.Revision` SHA-256，entries→lazy import，locale registry）。
- 模块 Binding 声明在各自 `binding/webui/binding.go`；`internal/composition/blueprint.go` 的 `buildApplicationWebUICatalog` 聚合为应用 catalog；`applicationWebUICatalog()` 是 runtime manifest 与生成器共享的唯一声明汇总点。
- 因此：**mock manifest 可由同一 Go catalog 投影生成**（`ManifestForWithNavigation` + 全 allowed/全 available + 默认策略），天然满足 revision 一致，杜绝手写 fixture 漂移。

### 5. SDK 能力面与 i18n

- SDK 按 `runtime/http/i18n/query/navigation/ui/feedback` 分包；模块在 `Requires` 声明 SDK 能力主版本，`applicationBlueprint` 的 SDKInventory 校验。新增“模块 mock 路由类型”需要新的 SDK 能力（或由生成 registry 自带类型声明）。
- host locale `webui.host.*` 双语（`webui/src/i18n/locale/{zh-CN,en-US}.json`）；模块 locale `webui.<module>.*` 双语；强制 i18n 门禁（`pnpm lint:i18n`、Go locale 校验、coverage 校验）覆盖所有实际页面源码与已注册 locale。mock 全局标识（徽标/横幅）应放 host namespace（骨架级，无需模块 locale 即可全局可用）。

## 推断

1. **显式声明 + 单一拦截点**：`VITE_WEBUI_DATA_SOURCE=mock` 时，`contracts.requestJSON/requestText` 切换到本地 mock router（不再 `fetch`），即实现“整个 WebUI（骨架 + 全部数据）mock”——这是最小且完整覆盖所有页面的方案。
2. **mock manifest 必须生成而非手写**：`catalogRevision` 门禁使手写 fixture 无法稳定；由 Go catalog 投影生成 `webuiMockManifest`（routes/menu 全 allowed/available + 默认导航策略），与 `webuiRevision` 天然一致。
3. **模块 mock 数据模块自有**：每个声明 Entry 的模块在自己的 `binding/webui/web/mock.ts` 提供路由表（复用自身 `api.ts` 类型），Binding 契约扩展 `MockSource`（类似 Locale 的强制规则：声明 Entry ⇒ 必须声明 mock），生成器渲染 `webuiMockRegistry`（moduleID → lazy import）——符合 048 的模块所有权与“禁止宿主集中跨模块数据”的边界；mock 路由类型经新增 SDK 能力 `mock`（`@webui/sdk/mock`）提供，模块在 `Requires` 声明。
4. **宿主 mock（manifest/session/identity/logout）宿主持有**：放 `webui/src/mock/`（宿主内部），与宿主 `api.ts` 对应；mock session 固定返回管理员身份（含全部权限 + 固定 CSRF），保证 login/setup/logout 客户端流程闭环；mock 只用数据层，不改变页面逻辑。
5. **全局标识 i18n 双语**：宿主 shell（AppShell 头部/侧栏）渲染“模拟环境 / Mock environment”徽标，host locale 新增 `webui.host.mock.*` 双语键；Ops 在真实模式下保留 `source.unreachable.*` 双语键（数据源不可达横幅），mock 模式下由全局徽标统一标识。
6. **真实模式语义不回归**：默认 `server-hosted`/`separated` 下传输层行为与现状完全一致（mock 绝不在未声明时启用）；Ops 页面在真实模式下执行查询 + 可达性分级（R061-001 方案不变）。

## 适用与不适用场景

- 适用：当前仓库（单 WebUI 根、单一 HTTP 入口、Go catalog 单一来源、模块自有 Binding、强制 i18n 双语的模块化宿主）。
- 不适用：为远程模块/动态插件构建 mock 市场；mock 冒充真实状态且无标识；未来新增模块不提供 mock（若采用“Entry ⇒ MockSource 强制”规则，后续模块必须自带 mock，属于明确的全量 mock 承诺）。

## 局限与剩余未知

- 未执行真实启动与浏览器验证（mock 全链路是否零后端 boot 成功属于实施验证项）；boot 依赖（manifest/session/revision 门禁）均已代码级核实。
- mock fixture 的具体业务数据内容（账号/角色/部门样例）不在此研究范围，留待实施时按模块 `api.ts` 类型与页面用例构造。
- SDK 能力 `mock` 的引入会触碰 SDKInventory 与 vite alias；若评审认为不应新增 SDK 面，替代方案是“生成 registry 自带 `WebUIMockRoute` 类型”（模块 mock.ts 自声明同构类型），同样可行但类型一致性弱于 SDK 能力。
- 增减模块或端点后，mock 覆盖面与真实端点的对齐依赖生成门禁与人工 review；不自动等于浏览器 E2E。

## 对当前任务的影响

- 契约：`internal/webui.Binding` 增加 `MockSource`（或 `Mocks`），`validateBindings`/`bindingSourcePaths`/`ValidateSourcePathOwnership`/覆盖规则扩展；新增 SDKRequirement 能力 `mock`（SDKInventory）。
- 生成器：`webui_registry.go` 同时渲染 `webuiMockRegistry` 与 `webuiMockManifest`（catalog 投影），`generate --check` 稳定性测试扩展。
- 宿主：`contracts/requestJSON|requestText` 按声明切换 mock router；`webui/src/mock/`（宿主管辖 manifest/session/logout fixtures + router 调度器）；`AppShell` 增加全局模拟徽标（i18n 双语）。
- 模块：每个声明 Entry 的模块新增 `binding/webui/web/mock.ts`（自有路由表 + 复用 api.ts 类型）并在 Binding 声明；Ops 真实模式保留可达性分级（R061-001）。
- 配置：`VITE_WEBUI_DATA_SOURCE` 三值（默认 `server-hosted`）经 typed 解析器校验（052），`webui build` 拒绝 mock（决策 4）。
- 文档/门禁：webui 开发指南、E2E（mock project 零后端导航）、Verify-WebUI/Go 门禁扩展。