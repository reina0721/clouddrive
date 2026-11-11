# Plugin Framework 与 Surface File Routes / Sidebar Navigation

本主题的当前唯一 authority。实现证据与决策历史见
[前端架构](frontend-foundation.md)；本文件只描述当前有效设计与使用方式。

> **最高架构判定标准**：这是一个被拆成很多可自动装配业务块的 Next.js 项目，而不是
> Plugin Framework 寄宿着 Next。「没有 Plugin 化时原本是 Next 负责的（页面、Layout、
> Loading、Error、Not Found、params、searchParams、Server/Client、metadata、路由
> 生命周期），Plugin 化之后也不重新实现。」Framework 只补充 Next 不知道的 **Plugin
> 管理信息**（自动发现、pluginId/mount、稳定 routeId、Navigation、Permission
> metadata、冲突/拓扑诊断、Host 部署能力、ownership、ADD/REMOVE 自动收敛）。

## 1. 分层与所有权

```text
packages/plugin-framework      契约层：Plugin Contract、Route Target、Registry、
                              Diagnostics、Host Port / Host Capability、
                              Navigation Resolution（Group → Parent → Child）
surfaces (private)      Surface 实现：plugins/*（业务 + plugins/navigation-groups.ts
                              Group Alias 公共契约）+ src/（shell、icon vocabulary、
                              composition）+ generated/*（codegen 产物）
apps/web                Runtime Host：Next Router、Shell 装配、Host Navigation/Locale
                              Port、i18n 聚合、Registry 派生导航消费
```

- **唯一真实 Router 与 Route Lifecycle authority 是 Next.js App Router。** Framework
  不读取 pathname、不维护 history、不创建导航栈、不复制 Next Route Runtime，也不
  重新实现 layout/template/loading/error/not-found 等 Next 生命周期。
- `packages/surface-foundation` 与 `packages/plugin-framework` 职责不同：
  foundation 拥有可复用产品视觉/Pattern/Shell 表现；framework 拥有契约与纯模型
  （Registry、Navigation Resolution、Host Capability、Route Target），不依赖 React Router/Next。
- `surfaces`（`@clouddrive/surface`）是 private workspace，只为 dependency
  ownership、module resolution、typecheck 与 test 服务。具体 Plugin 不是 Package，
  也不是 Surface 公共 API。

### Surface 对 Host 只开放

- `@clouddrive/surface/shell`
- `@clouddrive/surface/preferences-model`、`/identity`、`/identity/runtime`（当前产品共享偏好、身份目录、角色授权、通知及只读审计模型与语义 Port/hook，Web 注入实现；不含 HTTP、Storage、Session 或后端授权实现）
- `@clouddrive/surface/icon-presentation`、`/icon-components`
- `@clouddrive/surface/generated/composition`
- `@clouddrive/surface/generated/catalog`
- `@clouddrive/surface/plugin-routes/*`（Generated Adapter 的 (A) 层公共 shim）

禁止公开或直接导入：`@clouddrive/surface/plugins/*`、对应相对路径、
以及其它能够绕过 generated shim 的 Plugin internals。具体 Route Catalog、
业务 Route IDs 与 generated module shims 全部位于 `surfaces/generated/`，
不得生成到 `packages/plugin-framework`（Framework 只定义可扩展 Catalog protocol，
由 Surface generated catalog 提供当前 Product Surface 的具体类型扩展）。

## 2. 运行时上下文

```text
Host Ports = application runtime context（Composition Root 在 Root Provider 中一次性安装）
```

- `web` Composition Root 一次性安装：Host Navigation Port、Route Target resolver、
  Host Locale Port（Plugin 经 `usePluginLocale` 读写）、当前 Surface Registry。
- Host Navigation Port 使用 Next Link/Router 执行真实导航。
- Generated Adapter（Host 侧，见 §4）**只做 module re-export**：不安装 Host Port、
  不创建 Registry、不发布运行时 route context、不重复执行应用级 Composition。
- Shell 消费 Registry resolved model（Group → Parent → Child + href），active 状态由
  `leaf.href` 与 Next `usePathname()` 匹配（真实 Next Router，无第二套匹配器）。

## 3. Plugin Navigation API 与 Sidebar Navigation Contribution

Plugin 导航方式（按正常 Next 开发方式）：

- 普通静态导航可直接用 `next/link` / `next/navigation`（`useRouter`/`usePathname`/
  `useSearchParams`）——Plugin route 模块在受控 Next 白名单内。
- 跨 Plugin 稳定引用 / 需参数校验时用 Route Target：
  - `@clouddrive/plugin-framework/target`（纯模块，Server/Client 均可 import）：
    `route()`、`RouteTarget`、`encodeSegment`、`resolveTargetHref`。
  - `@clouddrive/plugin-framework/plugin`（client）：`RouteLink`、
    `usePluginNavigation`、`usePluginLocale`、`PluginLocaleProvider`。

```ts
route('users.detail', { id });
```

行为：`route()` 只创建 symbolic target；`RouteLink` / imperative navigation 委托
Root Provider 中的 Host Navigation Port。Route Target 是项目**增强能力**（symbolic
route、跨 Plugin 稳定引用），不是替代 Next 原生导航的强制方式——不为维护它而禁止
Plugin 正常使用 Next Link/Router。

### Plugin Schema 能力接入

`@clouddrive/schemas` 的公共能力经 Plugin Framework 两个独立入口暴露，Plugin
只消费公开符号，不访问 schemas 内部实现（`packages/schemas/src/**` 一律禁止）：

- **`@clouddrive/plugin-framework/schemas`（浏览器安全）**：显式转出
  `FoundationSchema`、`SchemaIssue`（类型）与 `getSchemaIssues`（值）。该入口
  **不含 Node Runtime**（schemas 根入口对 zod 仅 type import），浏览器与 Server
  Component 均可消费。
- **`@clouddrive/plugin-framework/schemas/runtime`（Node 装配方）**：显式接入
  `@clouddrive/schemas/runtime` 已公开的 Runtime 工厂（`createSchemaRuntime`）、
  契约（`SchemaRuntime` / `SchemaRuntimeOptions` / `SchemaSourceDescriptor`）与
  错误类型（`SchemaRuntimeError` / `SourceNotFoundError`）。Runtime 实例沿用原有
  公开方法（listSources/readSource/validate/applyPatch/generate/checkFreshness/
  watch/close），**创建与关闭由装配方负责**（Node 环境）；标注为内部用途的
  `SOURCE_PATHS` 不公开。该入口依赖 schemas/runtime 自身的 Node 环境要求，**不得**
  被浏览器入口 import。
- **`@clouddrive/plugin-framework/plugin` 的 `schemas` 命名空间**：Plugin 页面可
  直接消费浏览器安全值能力（与直接 import `/schemas` 等价）：

```ts
import { schemas } from '@clouddrive/plugin-framework/plugin';
import type { FoundationSchema, SchemaIssue } from '@clouddrive/plugin-framework/plugin';

const issues = schemas.getSchemaIssues(error); // SchemaIssue[]
```

函数引用、参数、返回值与错误语义与 `@clouddrive/schemas` 原导出完全一致（转出
同一模块引用，不做二次封装）。本轮只完成公共能力装配与暴露；浏览器到 Node 的
Runtime 调用链**未打通**（无服务/协议/Adapter），Runtime 仍保留其 Node 运行环境
要求。

### Sidebar Navigation Contribution（Group → Parent → Child）

**Sidebar 固定模型**：

```text
Group → Parent → Child
- Group   = 侧边栏分组/分隔区域（不是 Route、不是父菜单）
- Parent  = Group 下一级菜单
- Child   = Parent 下子菜单
- groupId            只决定 Node 属于哪个 Group
- Route Tree ≠ Sidebar Tree（不用文件层级替代显式 Navigation hierarchy）
```

**Group Alias（plugins 范围公共 IA）**：`surfaces/plugins/navigation-groups.ts`
集中声明 `management`（身份与访问）/ `system`（个人入口）/ `development`（开发中心）（每项 `{groupId, labelKey, order?}`）。参考资源与图标工具归开发中心；其 URL 与 navigationId 不变。
普通 Plugin **不定义 Group**，只在自身 Contribution 的 `groupId` **选择**既有 Alias；
新增 Group Alias 属 plugins 范围公共 IA Contract 变更，不是单个 Plugin 私有声明。
Shell 不写死 Group。多个 Plugin 可选同一 Group，各自维护自己的 Parent→Child 树。

**Plugin Navigation Contribution**：每 Plugin 根目录 `plugin.navigation.ts`：

```ts
import type { NavigationContribution } from '@clouddrive/plugin-framework/navigation';
export const navigationContribution = {
  parents: [
    {
      navigationId: 'system-tools.root', // 必须 `${pluginId}.` namespace
      labelKey: 'systemTools.nav.root',
      groupId: 'system', // 选择 Group Alias
      iconId: 'settings', // 可选受控 icon vocabulary
      // 有 routeId → Parent 可导航；无 routeId → 纯 Disclosure（点击只展开/收起）
      children: [
        {
          navigationId: 'system-tools.root.icons',
          labelKey: '…',
          routeId: 'system-tools.icons',
          order: 0,
        },
        {
          navigationId: 'system-tools.root.tools',
          labelKey: '…',
          routeId: 'system-tools.tools',
          order: 1,
        },
      ],
    },
  ],
} as const satisfies NavigationContribution;
```

约束：

- `navigationId` 必须 `${pluginId}.` namespace（Parent/Child 均如此）。
- Parent/Child 层级用内嵌 `children` 表达；**无 parentNavigationId / 跨 Plugin parent
  概念**；Child 天然属于声明它的 Parent / Plugin / Group（不声明 groupId）。
- Child 必须带 `routeId`；Parent 可带 `routeId`（可导航）或无（纯 Disclosure）。
- **Sidebar 可见 Node 的 routeId 必须静态可解析**（无 runtime params）；动态 `[id]`
  Route 不得直接作为普通 Sidebar target（报 `NAVIGATION_DYNAMIC_TARGET_UNSUPPORTED`）。
- Parent 无 routeId 且无 children → `NAVIGATION_NODE_ORPHAN`。
- `navigation.iconId`（可选）是 Navigation Contribution 的 **semantic presentation
  metadata**（不是 Plugin capability / 能力协商）：合法集合由 Product Surface icon
  vocabulary（`surfaces/src/navigation-icon.ts`，受控、不动态化）治理；
  iconId → Lucide 组件的**唯一映射**在 `surfaces/src/navigation-icon-components.ts`
  （`@clouddrive/surface/icon-components`）；Shell resolver 与 Icon 展示页
  消费同一映射。**Plugin 代码不直接 import lucide-react**（Icon 大全页经
  `@clouddrive/surface/icon-presentation` 的 `NavigationIcon` 消费语义 id）。

Plugin route 模块允许（受控白名单）：import `next/link`、`next/navigation`
（useRouter/usePathname/useSearchParams/redirect/notFound 中 static-export 允许者）
及类型导入。禁止：Browser history、全局 location、直接 import lucide-react（图标经
surface icon API 消费语义 id）；`packages/*` 与 `surfaces/src` 仍禁 `next/*`。

## 4. File Routes 与 Route Identity

Plugin `routes/` 是一棵**真实的 Next App Router 子树**：page/layout/template/loading/
error/not-found 均为可选 Next convention（按需存在，可只含 page.tsx），采用 default
export（与 Next 一致——开发者写 Plugin routes 的方式与原生 Next app/ 一致，未来可
整体拷入）。公共 Layout/UI/Foundation/表单/组件从共享 packages 复用，Plugin 不重复
实现；Plugin 可像正常 app/ 一样 colocate components/services/lib/schema/styles 等
普通实现文件。

```text
surfaces/plugins/users/            ← 目录名可任意；不承担身份/URL 语义
├── plugin.ts                 export const pluginDefinition = { pluginId, mount } satisfies …
├── plugin.navigation.ts      （可选）Sidebar Navigation Contribution（Parent/Child）
├── i18n.ts                   （可选）export const pluginI18nResources
└── routes/                   ← 一棵真实 Next App Router 子树
    ├── layout.tsx template.tsx loading.tsx error.tsx not-found.tsx page.tsx
    ├── create/page.tsx
    ├── [id]/page.tsx (+ layout/loading/error 可选, edit/page.tsx)
    ├── settings/page.tsx
    └── components/ lib/ schemas.ts  …  ← colocate 普通实现文件，Framework 完全忽略
```

规则：

- **Plugin 目录名与 `pluginId` 解耦**：目录名只承担磁盘路径，身份/URL/routeId 一律取
  `plugin.ts` 的 `pluginId` + `mount` 声明。URL 只由 `mount + routes/ 文件树` 决定。
- **`routes/` 的 authority 是 Next App Router 本身**，不是 Framework 维护的固定文件
  白名单。Plugin 只声明「这棵 Next 子树从哪里开始」（plugin.ts 的 mount）；根以下完全
  按正常 Next App Router 开发，业务 Route 只由目录 + Next special files 表达。
- **不存在第二套 Route Contract**：不引入 route.meta.ts / plugin.route.ts /
  route.config.ts 或任何逐 Route 显式声明文件；不要求 page.tsx 配 Framework 契约。
  Route 的存在/层级/动态 segment/layout/loading/error/metadata/params/searchParams
  全部由 Next 原生规则决定。
- Framework/Generator 只区分三类文件：
  - 普通 colocated 文件（components/services/lib/schemas/styles/tests/_private 等）→
    Framework 完全忽略，不增加 Plugin 语义；
  - 当前支持的 Next convention（page/layout/template/loading/error/not-found）→ 机械装配；
  - Next 有语义但当前 Host 尚不支持的 convention（route.ts/default.tsx 等）→
    明确 Host Capability 诊断（UNSUPPORTED_NEXT_CONVENTION），不静默忽略。
  - 以后扩展 route.ts、default.tsx、metadata file conventions 或其它 Next 能力 =
    扩大 Host capability，不是修改 Plugin Route Contract。
- **Route identity 由 Framework 从 pluginId + Next 文件树确定性派生**（page 决定当前
  Framework 所索引的可渲染 Page Route）：`FileRouteDescriptor` 只是 Navigation
  target 校验、Route Target、冲突诊断需要的 Page Route 索引，不是 Next 完整 Route
  Tree 的平行模型；Next 完整 Route Tree 由 Next 文件系统本身拥有与解释。
- 路由段语义（catch-all/parallel/route group）本期由 Host capability 治理；动态
  `[id]` 段 Framework Contract 合法，但当前 Static Export Host 的部署能力见 §7。

### Sidebar 与 Route 的关系

- `plugin.navigation.ts` 只描述 Shell Navigation（Group → Parent → Child），**不定义
  Route**；Navigation 可以引用 Route（routeId → 静态 href），Route 不依赖 Navigation。
- Route 没有 Navigation 是**正常情况**（隐藏/直达页），registry 不为此诊断；只保留
  Navigation → 不存在 Route 的反向校验（`UNKNOWN_NAVIGATION_ROUTE_TARGET` /
  `NAVIGATION_DYNAMIC_TARGET_UNSUPPORTED` / `NAVIGATION_NODE_ORPHAN`，见
  navigation-resolution）。
- Shell 的 active 状态由 `leaf.href` 与 Next `usePathname()` 匹配（真实 Next Router），
  不依赖 route 级 activeNavigationId 模型。

## 5. Generator 与 Registry 管线

```text
Discovery → Framework Contract Validation → Static Framework Descriptors
→ Surface Route Catalog（aliases + contributions 序列化）
→ Registry Resolution（Group Alias 聚合 + Parent/Child 拓扑 + routeId→href + 校验）
→ Resolved Navigation（Group → Parent → Child）+ routeId→descriptor 索引 → Shell
→ Generated Adapter（surface 公共 shim + Host Next adapter，仅 re-export）
```

- **Generator（`tooling/plugin-codegen`）只负责**：Plugin/File Route discovery、
  读取 `plugin.navigation.ts` 与 `navigation-groups.ts`、static descriptors
  （pluginId + Next 文件树派生）、Surface Route Catalog（含 aliases + contributions）、
  i18n index、Surface generated module shims、Host capability analysis 后的 Next
  re-export adapter。Generator 不生成 resolved Navigation model（只序列化静态声明并做
  Alias/icon gate），不重新实现 Next 生命周期，不平行建模 Next Route Tree。
- **Generated Adapter 是纯薄接线，两层各一行 re-export**：
  - (A) `surfaces/generated/plugin-routes/<dirName>/<rel>/<kind>.ts` —— surface
    公共 shim（因 `plugins/*` 是 private，Host 只能经 exports wildcard 公共 subpath
    访问）；内容 `export { default } from '<源>'`。
  - (B) `apps/web/src/app/(app)/<mount>/<rel>/<kind>.tsx` —— Host Next adapter，只
    re-export (A)：`export { default } from '@clouddrive/surface/plugin-routes/…'`。
  - 例外（116 起）：静态 `page` 的 (B) 生成 **Host 侧按需加载外壳**——
    `'use client'` + `next/dynamic(() => import('(A)'), { loading })`，loading 为
    无文案占位。原因：产物预算以单 Route HTML 引用的 JS 计算，若页面实现静态
    re-export，任何页面的依赖都会被提升进所有 Route 的公共 chunk；外壳让每个 Route
    首屏只保留 Shell，页面模块作为独立 chunk 拉取。带 `generateStaticParams` 的动态
    `page` 仍保持 `re-export + generateStaticParams` 转发（构建期枚举需要 Server Module），
    `layout`/`loading`/`error`/`not-found` 也保持 re-export。下一节性能证据记录该决策。
  - 两层都不出现：params 拦截、Context 包装、children 包装、生命周期逻辑、第二套匹配器。

  Host 对公开分享 `/share` 明确选择 `(file-shares)` 组，而非 `(app)` 或带登录品牌框架的 `(public)` 组；该位置由 Host generator 决定，Plugin Contract 不增加认证字段。此路由的手写 Host layout 只注入独立 PublicFilesPort，其他插件仍受 `(app)` 的 ProtectedGate 保护。

- **Registry（`packages/plugin-framework`，运行时）只保留真实需要的结构**：
  `navigation-resolution.ts` 单一 authority 解析 Group Alias + Parent/Child →
  `registry.navigation`（Group → Parent → Child，含 href）；`registry.routes` 是
  routeId → descriptor 的纯索引（Route Target 解析与冲突诊断用）；冲突/拓扑诊断
  汇总为 `registry.diagnostics`。不做 canonical/active/breadcrumb/command/permission
  展示模型（无运行时消费者，不为"未来可能使用"维护）。
- Shell 只消费 Registry resolved model（`convertRegistryToShellNavigation` 把
  group→parent→child 映射为 Shell NavigationGroup[]；Branch=Parent、Leaf=Child/单节点）。

## 6. 确定性 Codegen Bootstrap（preflighted deterministic reconciliation）

- `pnpm codegen:plugins` 生成；`pnpm codegen:plugins:check` 复核（freshness 纳入 `pnpm check`）。
- **开发期自动发现**：`pnpm dev` 并行运行
  `node tooling/plugin-codegen/watch.mjs`（监听 `surfaces/plugins/**`，防抖后自动
  reconcile）+ `next dev`。新增/删除 Plugin、Route 或 Next special file 后**无需手动
  运行 codegen**——watch 完成 reconcile，Next dev 自动感知 `apps/web/src/app`
  变化。`node tooling/plugin-codegen/dev.mjs` 是两者编排入口（任一退出即收尾另一）。
- **构建链自动生成**：根 `pnpm build` 前置 `codegen:plugins`（确定性、失败即停），
  再 `pnpm -r build`；`pnpm check` 内含 `codegen:plugins:check` freshness，CI 拒绝漂移。
- Generator 采用 **preflighted deterministic reconciliation**：先完成全部
  semantic validation、Host capability validation、Group Alias / icon vocabulary gate，
  并在内存中渲染完整 expected artifact plan（catalog / composition / i18n index /
  surface shim / Host adapter，含最终 content），再做物理 ownership preflight；
  全部通过后才执行 mutation：比较文本，保持内容未变文件的 inode/mtime；
  变化文件使用 `write-file-atomic` 通过临时文件 + rename 发布，再删除 stale owned
  artifacts、清理空目录。普通 Plugin 实现变更若未改变生成内容，不会重写全部 Route。
  `write-file-atomic@7` 的 `.ts[x].<uint32>` 临时路径不参与残留清理与 freshness 扫描，
  避免两个本地开发进程删除彼此正在写入的文件。
  保证：deterministic failure before mutation / no partial output for preflight failures。
- Generator Ownership Boundary：只有带固定 `GENERATED_HEADER`（首行严格匹配
  `// @generated by tooling/plugin-codegen …`）的 Host artifact 归 plugin-codegen
  所有。期望 Host artifact 已存在但不属于本 Generator → `Host artifact ownership
collision`（deterministic fail，不覆盖）；stale 删除只针对 owned artifact。
  手写 App Router 页面（无 marker）既不被覆盖也不被删除。
- Freshness 在内存中重建期望文本并逐文件比较，检测：缺失文件、内容漂移、
  已删除 Route 的残留、不应存在的 Host entry（通用 ownership marker 扫描，
  无具体插件特判）、手工修改 generated 文件、物理 ownership collision。
- 原子发布保证单个模块的读者看到完整旧版或新版；不保证整批模块的一致快照。
  本工具不提供 mutation 开始后的整批 transaction commit/rollback。

## 7. Host Deployment Mode（static / static-enumerated / server）

**Mode 属于 Host（apps/web）构建与部署配置，不属于 Plugin Contract**。Plugin
routes/ 永远按正常 Next App Router 开发；Mode 只决定「当前 Host 能部署哪些 Next
能力」，不反向改变 Plugin 开发模型——**同一 Plugin 源码在不同 Mode 下无需改写法**。
Mode 1 → 2 → 3 是部署能力递增，不是三套 Plugin Route Contract。

固定管线：

```text
Discovery → Framework Contract Validation → Framework Descriptors
→ Host Capability Analysis（按 Mode 预检诊断）→ Host Route Generation
→ Next build（最终能力判断与生成 authority）
```

| Mode                | output                        | 动态 `[param]`                      | generateStaticParams      | request-time (headers/cookies/redirect) |
| ------------------- | ----------------------------- | ----------------------------------- | ------------------------- | --------------------------------------- |
| `static`（默认）    | `export`                      | 不支持（`HOST_MODE_CANNOT_DEPLOY`） | 不需要                    | 不支持                                  |
| `static-enumerated` | `export`                      | 支持                                | **必须**（Next 原生枚举） | 不支持                                  |
| `server`            | 无 export（真实 Next Server） | 支持                                | 不需要（运行时数据）      | 按 Next 原生规则开放                    |

配置：`apps/web/.env` 设 `WEB_DEPLOYMENT_MODE=static | static-enumerated | server`
（Next 原生加载；codegen/watch 读同一文件；缺省 static）。该键是唯一正式入口，
不读取旧配置名或提供兼容映射。

能力预检与诊断（Framework/Generator 不建立第二套路由解释器；Next build 是 authority）：

- **static** 下出现动态 `[param]` Route → `HOST_MODE_CANNOT_DEPLOY`，措辞为「当前
  Host Deployment Mode = static 无法承载该 Next 能力」，并给出升级路径
  （static-enumerated / server）——**不是**「Plugin Route 非法」。
- **static-enumerated** 下动态 page 未自带 `generateStaticParams` →
  `DYNAMIC_ROUTE_REQUIRES_GENERATE_STATIC_PARAMS`（指明具体 page）。放行时 codegen
  在 surface shim 与 Host adapter 两层转发 `generateStaticParams`，Next 静态产出
  `/xxx/<param>.html`；未枚举的新参数不可访问，需重新 build。
- **server** 放行动态（运行时数据由 Next Server 处理；不做 GS(SP) 要求）；request-time
  能力由 Next 原生判定。

```text
Framework Contract Validity ≠ Current Host Deployability
```

当前 Host 只有在能承载全部可达生产 Route 时才能通过发布门禁。
隔离 Framework fixtures 可包含动态 Route，不进入真实 Surface Host capability inventory；
Reference Plugin 使用固定路径完成浏览器验证。

### 示例

```env
# apps/web/.env（复制自 .env.example）
WEB_DEPLOYMENT_MODE=static-enumerated
```

```tsx
// surfaces/plugins/<id>/routes/[id]/page.tsx —— Server Component（不写 'use client'，
// generateStaticParams 是 server-only 导出；交互部分拆 client 子组件）
export default function ItemPage() {
  /* … */
}
export function generateStaticParams() {
  return [{ id: 'a' }, { id: 'b' }]; // 构建期枚举；实体变化需重新 build
}
```

## 8. Legacy 与 Gates

- Registry 维护 routeId → descriptor 纯索引（含 pattern/paramNames）供 Route Target
  解析与冲突诊断；不派生 canonical hierarchy / breadcrumb / command / permission
  展示模型（无运行时消费者）。
- Legacy inventory（后续 Migration Phase）精确冻结 Route、Navigation 与 ownership；
  Plugin/Legacy 的 path、shape、ownership 或 navigation target 冲突均失败，
  不允许隐式覆盖。
- Architecture Gates 覆盖：Surface private export boundary；Host/Package 直接导入
  Plugin internals；Plugin 对 Framework subpath 的限制；Plugin 到 Shell/Host/Browser
  的非法依赖；Next 白名单位置限定（`next/*` 只允许 web 与 Plugin route 模块）；
  mount/path 冲突；Route/Navigation namespace；跨 Plugin topology reference；
  Navigation → 不存在 Route 的反向校验；catalog/descriptor/shim/adapter freshness；
  Static Host capability 在 Host adapter generation 前执行；
  **Contribution groupId 必须命中 Group Alias**（`plugins/navigation-groups.ts` 公共
  IA，未知 Alias 报 `UNKNOWN_NAVIGATION_GROUP` 并硬失败，禁止 silent drop）；
  **navigationId 必须 `${pluginId}.` namespace**（`NAVIGATION_NAMESPACE_VIOLATION`）；
  **Sidebar 可见 Node routeId 必须静态可解析**（`UNKNOWN_NAVIGATION_ROUTE_TARGET` /
  `NAVIGATION_DYNAMIC_TARGET_UNSUPPORTED`）；**orphan Parent**
  （`NAVIGATION_NODE_ORPHAN`）；**navigation.iconId 必须命中 icon vocabulary**
  （`navigation-icon.ts` 单一 authority，未知报 `UNKNOWN_NAVIGATION_ICON`，
  禁止静默 fallback）；**Next 有语义但当前不装配的 convention**
  （route.ts/default.tsx → `UNSUPPORTED_NEXT_CONVENTION`，Host capability 诊断）；
  **Host artifact ownership collision**（期望 Host entry 已存在且不属于
  plugin-codegen → deterministic fail，mutation 前 preflight 拦截）。

## 9. 参考验证

- `reference-resources`：Group `reference` 下单一可导航 Parent（`routeId` → 列表
  Route，`iconId: 'resource'`）；create/detail/edit 是直达 Route（不在 Sidebar，
  正常访问），Route identity 由 pluginId + 文件树派生；Link / imperative navigation
  使用 Route Target API；Root Provider 只安装一次 Host Navigation Port。
- `system-tools`：Group `system` 下 leaf Parent `system-tools.root`，routeId 指向
  Icon 大全（`icons`，经 `NavigationIcon` 渲染受控 vocabulary）。原偏好设置
  （`preferences`）已迁出为独立 `settings` 插件（
  单轨清理：不保留旧入口/旧路由别名）。
- Shell 不再按 navigationId/pluginId 手工映射业务图标（统一 iconId → 唯一
  components map resolver）；Sidebar 只渲染 Registry resolved model。

## 10. 本阶段范围与后续阶段

**架构目标（最终收敛方向）**：每个 Plugin = 一个自描述、可完全自动增删的 Next.js
业务子应用（目录名任意，pluginId/mount/Sidebar/i18n 由 Plugin 根声明；`routes/` 是
尽可能完整的 Next App Router 子树）。Built-in 只保留 Runtime Essential（删掉所有业务
Plugin 后 Shell 仍能启动/导航/处理异常所必须：404/Error/Loading/Permission
fallback/Shell bootstrap/Plugin unavailable fallback）；Surface/Product Module
（Preferences、Icon Catalog、Foundation Showcase、Reference Resources、UI Elements、
未来业务）统一走 Plugin Contract，可独立安装/删除/演进。当前 Host 静态 foundation
展示页（page-patterns/page-archetypes/foundations/motion/states/overview）是
**过渡**：其依赖 Host-private 能力，需先经稳定 Contract/Port 解耦，再整理为
官方 Reference Plugin；不保留 "Legacy static business/reference pages + Plugin
pages" 长期双轨。Preferences 已完成迁移（system-tools）、UI Elements 已完成迁移
（ui-elements，Host 手写页/Shell 静态分支已清除，URL `/ui-elements/*` 由 codegen
自动生成的 Host adapter 保持）。

本主题当前实现范围包括：Framework、Navigation Resolution、Group Alias 公共契约、
Surface private boundary、reference-resources + system-tools + ui-elements、generator
（Next 子树扫描：colocated 忽略 / 当前 convention 装配 / Host capability 诊断 +
两层薄 re-export adapter）、watch/dev 自动 reconcile、Registry（routeId→descriptor
索引 + resolved navigation + diagnostics）、gates、icon presentation、next/* 受控
白名单（Web Host 与 Plugin route 模块）。以下内容
**尚未实现**：其余 foundation 展示页插件化迁移、完整 Command/Permission 呈现、统一
Breadcrumb UI（route.meta 与 breadcrumb/command/permission 展示模型已删除，未来按
真实 UI 需求重新设计）等（见上文过渡方向）。本文不把这些延期内容描述为已实现。

## 11. 使用入口

- 新增 Plugin 与 File Route：先读本文件 §4 与 §5，再按
  [Foundation 扩展治理](foundation-extension-governance.md) 走顺序；
  目录级约束见 `surfaces/AGENTS.md`。
- 修改 Framework 契约/Registry：见 `packages/plugin-framework/AGENTS.md`；
  公共导出登记在 `tooling/foundation-contracts.json`。

### Route Target 定位信息

RouteTarget 的 query 和 fragment 为可选结构化定位信息；Registry 负责编码解析，Host 委托 Next 执行导航及关闭浮层后的字段焦点交接。query 不参与页面标签 pathname 身份，实体 id 可作为已解析目标保留于通知、收藏、最近访问和标签恢复。Plugin 不读取 Host pathname/history，不自行接管 Router。

## Navigation Administration Port（116）

菜单管理需要"业务呈现覆盖真正作用于侧栏"，但 Host 不得 import Plugin 内部实现、Plugin 也不得
自建导航真相。因此新增 Host Port：

- 契约：`@clouddrive/plugin-framework/navigation-admin`，导出 `NavigationAdminPort`、
  `NavigationAdminOverride/Patch/Result/Snapshot`、`NavigationAdminProvider` 与
  `useNavigationAdminPort()`。
- 能力：`getSnapshot/subscribe`（引用稳定，供 selector 订阅）、`update(navigationId, patch,
expectedVersion)`、`resetPresentation`、`clear`、`clearAll`、`recover`（清除损坏记录后重新水合）。
- 写入语义：标题 1–40 字符；排序 0–999 整数；权限码为小写点分；每次写入自增 `version`，
  版本不匹配返回 `conflict` 且不覆盖；损坏记录拒绝静默覆盖。
- Host 实现：`apps/web/src/state/use-navigation-admin-store.ts`（key
  `clouddrive.navigation-admin` v1，localStorage）+ `apps/web/src/host/navigation-admin-port.tsx`。
- 应用：`useProductNavigation` 在权限过滤前后应用 hidden/order/permission；标题覆盖经
  `useNavigationLabelOverrides` 同时作用于侧栏、页签标题与命令面板。
- Backend 从服务端 `/navigation` 加载呈现覆盖，mock 使用上述本地实现。Host 通过
  `@clouddrive/surface/shell/runtime` 的 `ShellNavigationViewProvider` 提供最终只读呈现快照；
  `useShellNavigationView()` 返回 `groups/labels/status/onReload`。管理概览按任务组合已可见的
  navigation id，不另抄 URL、权限表或菜单覆盖。加载中、读取失败和没有入口分别呈现；
  重试更新原有身份与菜单来源。Provider 不拥有路由、持久化或后端授权；独立运行时入口
  随管理 Shell 按需装载，避免将 React 上下文传递到登录与文件工作区的初始依赖。
- Backend 管理概览 `/workspace` 不依赖待办权限；待办区域分别要求 `todos:read/write`。
  分享、任务、节点与存储管理入口分别使用对应原生读取权限。Backend 隐藏会重复回到文件的
  静态根概览；mock 的概览保留。
- 边界：覆盖只改变**入口呈现**，不放宽任何真实权限；路由与组件仍来自部署期 Registry；
  直接 URL 访问仍由数据服务授权。

## 文件离线任务Port（129）

`files/routes/downloads/page.tsx`声明`/home/downloads`插件页面，Host路由壳由plugin-codegen生成。`surfaces/src/files/downloads.ts`定义独立DownloadsPort与Zod契约，HostFilesRuntime显式提供账号绑定的实现。Host负责网络、私有链接复制和可见性轮询，页面只消费任务语义；卸载或账号失效清理订阅，不恢复旧账号的timer。布局复用Page/PageHeader/Section/StateSurface，已知总量复用ProgressMeter，未知总量保留真实字节而不绘制虚假百分比。
