# R003 模块、SDK 与 WebUI Host 可插拔边界

## 1. 研究问题

本研究回答两个问题：当前业务页面究竟由谁实现和装载；059 如何升级 Shell、公共 UI 与现有页面体验，同时保持“模块或插件 A + SDK 契约 + WebUI Host B”的可插拔关系。

## 2. 当前实现事实

### 2.1 页面已经由业务模块拥有

IAM、Organization、Navigation、Ops 的 `Binding()` 都在各自 `internal/module/<id>/binding/webui/` 中声明 Entry、Route、Navigation、Locale 与 SDKRequirement；对应 Page、API adapter、locale 和 CSS Module 位于同一模块的 `web/` facet。根 `webui/` 没有这些业务页面的实现 owner。

`.scaffold/layout.json` 把模块 WebUI facet 固定为 `binding/webui/web`，把根平台源码固定为 `webui/src`，并把 `webui/src/generated/webui-registry.ts` 声明为 registry output。

### 2.2 装载链路是静态 registry 加运行时 Manifest

generated registry 为每个 Entry 和 locale 生成指向模块 facet 的 lazy import。`webui/src/App.tsx` 把 entry loader 转成 React `lazy` component，`ManifestPage` 再根据 runtime Manifest 的 route、access、availability 与 delivery state 决定呈现或装载。

因此真实链路是：

```text
模块 Binding/SourcePath
  -> composition/catalog 校验
  -> generated lazy registry
  -> runtime Manifest route/access 投影
  -> WebUI Host lazy load
  -> 模块自有 Page
```

根 WebUI 如果再写一份 IAM/Ops 等页面，会产生第二 owner、第二注册路径和同步负担，违背现有单轨设计。

### 2.3 SDK 是中间通信契约

模块页面当前通过 `@webui/sdk/runtime`、`http`、`i18n`、`query`、`ui` 等项目自有入口获取宿主能力。`Binding.Requires` 声明 capability major，`BuildApplicationCatalog` 校验 composition inventory 是否提供同一 major。

`webui/scripts/lint-architecture.mjs` 进一步禁止：

- 模块导入 WebUI platform/components/pages internal；
- 模块直接导入 TanStack Query 而绕过 SDK；
- 模块跨越到其他业务模块实现；
- 非 SDK、非 generated 的根平台源码导入 `internal/module/`。

这说明正确关系不是 Host 调用模块私有实现，也不是模块查询一个运行时万能容器，而是双方依赖项目自有的窄 SDK 契约。

## 3. A、契约、B 的责任

| 边界 | 拥有内容 | 禁止内容 |
| --- | --- | --- |
| 模块或插件 A | Binding、Page、业务状态、API adapter、locale、模块 CSS、页面测试 | Host internal、其他模块实现、第二套 Router/query client、全局资源 |
| SDK 中间契约 | runtime/navigation/http/i18n/query/ui/feedback 的项目自有类型、错误、取消和版本语义 | 业务 DTO、ModuleID 特判、第三方 API 原样透传、service locator |
| WebUI Host B | registry loader、Router、Shell、主题、全局 overlay、凭据、共享 client、SDK adapter | IAM/Ops 等业务页面、业务 API/DTO、模块专属状态、手写 module import |

059 中的 Shell、Theme、RouteSearch、全局 motion/overlay 和 Shell/Page skeleton 属于 Host/SDK；IAM、Organization、Navigation、Ops 的页面布局与局部状态仍属于各模块。公共视觉变化通过 token 与 UI SDK 向模块传播，模块专属排版只在其 CSS Module 中调整。

## 4. 可插拔的当前语义

当前系统提供的是源码与构建期静态可插拔、运行时按路由懒加载，而不是浏览器运行时插件系统：

- 新模块声明自身 Binding/facet，并在 composition 的唯一 module list 注册；
- 通用 generator 机械生成 registry，不按模块写特判；
- activation、delivery、access 与 availability 决定最终 Catalog/Manifest；
- 禁用或移除模块并重新生成后，其 Entry、Route、Menu 和 Locale 不再进入产物；
- 现有 SDK 足够时，普通模块不修改 Host、SDK 或 generator source。

生成命令并不把页面源码复制到根 `webui/`；generated registry 的机械 diff 只保存静态 `import()` 路径，是装配结果，不是 Host 业务耦合。Vite 因此仍可把业务页面拆成 async chunk，Host 在 route 门禁通过后才触发 loader。

## 5. 不应在 059 中扩大为 runtime plugin

运行时下载远程 bundle、热安装/卸载、Module Federation 或多个独立 WebUI 发布单元需要新增信任和资源边界，包括签名与来源、SDK 版本协商、CSP、代码隔离、权限投影、失败恢复、缓存更新和共享 singleton owner。当前 Binding/registry 没有承诺这些能力。

用户当前提出的模块化要求可以由既有静态装配主线满足。若后续明确需要 runtime plugin，应另立研究和计划，不能把静态 SourcePath/registry 描述成已经支持远程插件。

## 6. 对 059 的影响

- 根 `webui/` 只重构 Host Shell、公共 SDK/adapter、token、motion、overlay 和通用 skeleton。
- 业务页面调整由各模块在自身 facet 内实施，根 WebUI 不新增页面副本或业务 selector。
- 059 增加 architecture/pluggability 验收：Host 手写 module import 为零、ModuleID 特判为零、普通模块 core 零修改、disabled/removed 模块不进入 registry/Manifest。
- 059 增加 performance 验收：production chunk graph 保持模块页面异步分块，冷启动不加载未访问或无权模块，首次访问 route 时才加载对应页面与 locale。
- 若视觉需求暴露真实 SDK 缺口，先以实际调用方定义项目自有能力并更新 major、adapter 和 contract test；不得由模块穿透 Host internal。

## 7. 事实、推断与结论

### 事实

模块已经拥有页面和 Binding；registry 生成模块 lazy import；Host 按 Manifest 装载；模块只通过 SDK 使用宿主能力；architecture scan 已执行双向 import 门禁。

### 推断

“WebUI 还要实现对应页面”的表述会让人误解为根平台拥有第二套页面。059 必须把它改为“模块 owner 内的视觉校准”。

### 结论

保留并加固当前模块/SDK/Host 三段式边界，不迁移页面 owner，不建立第二套业务页面。059 的可插拔验收以静态 Binding/codegen/Manifest 链路为准，runtime remote plugin 明确列为非目标。

## 8. 局限与刷新条件

本研究没有设计 remote plugin runtime，也没有新增 SDK 函数签名。Binding、SDK major、generator、Host import 规则或独立发布目标发生变化时必须刷新研究。
