# R002 静态全栈业务模块方案比较

> **目标结论已被取代。** 本报告曾推荐把 web facet 迁入 `webui/src/module/<id>` 并建立前后端双 profile。用户随后明确要求 WebUI 继续由 `internal/module/<id>` 业务模块持有，因此该 owner/装配结论由 [R003](../R003-module-owned-webui-sdk-boundary/report.md) 取代。React Router lazy、Vite CSS Modules、TypeScript 边界能力和拒绝运行时微前端的官方证据仍然有效。

## 1. 研究问题

目标不是让后端动态发送 React 页面，而是让账号权限、日志审计、系统配置和运维工具等逻辑业务模块各自拥有完整 WebUI，同时保持前后端通过路由 API/HTTP 契约交互，并保证新增模块不修改宿主 Router、Shell、全局 CSS 或其他模块。

## 2. 候选模型

### A. 保留当前 Go Binding + SourcePath codegen

优点是后端 composition 只有一个模块选择点，runtime manifest 可以携带权限状态。

缺点是 Go 契约知道前端源码，Vite 跨目录编译后端模块，模块 CSS 和宿主公开契约继续扩张。它不能满足前后端边界，拒绝。

### B. 集中式独立前端

所有页面放入 `webui/src/pages`，Router 集中声明，后端只提供 API。

它能实现前后端分离，但账号、审计、系统配置等页面会重新堆进同一前端大应用，缺少前端业务 owner。它不能满足“通用业务模块化渲染”，拒绝。

### C. 静态编译的全栈业务模块

同一逻辑 ModuleID 对应两个互不导入的 facet：

- `internal/module/<id>`：后端业务、HTTP contract、operation、数据和资源；
- `webui/src/module/<id>`：前端 route、navigation、locale、API client、page、component、style 和 test。

前端 module 导出不可变 `WebModuleDefinition`。应用的前端 composition profile 显式汇总这些定义，平台编译为 React Router route tree。后端 bootstrap 只返回已启用 ModuleID、API contract version、当前主体和访问决策，浏览器再与静态 catalog 对齐。

该模型满足当前产品是单仓库、内置模块、静态发行的事实，推荐。

### D. 运行时微前端/远程模块

每个模块独立构建和部署，宿主运行时下载 remote entry，再处理依赖共享、版本协商、签名、CSP、失败隔离和跨模块通信。

当前没有第三方安装、不同团队独立发布或不停机加载模块的验收需求。引入该模型会制造第二套模块 runtime 和供应链边界，拒绝作为 048 方案。

## 3. 官方能力与方案映射

React Router 官方 `createBrowserRouter` 接收完整 RouteObject tree；`route.lazy` 可以在路径定义已知的情况下延迟加载页面实现。这与“前端模块同步贡献轻量 route metadata、页面按模块 lazy import”直接匹配，不需要后端生成 TS import。

Vite 官方支持 `.module.css` 的 CSS Modules，适合让业务 selector 留在模块作用域。Vite 也支持 `import.meta.glob`，但本仓库明确禁止自动扫描和隐式注册，因此 048 不采用 glob 自动发现模块；应用 profile 必须显式 import 模块定义。

TypeScript Project References 可以把大型 TS 程序拆成更小项目并强化逻辑边界，但会引入 declaration/build 配置。048 首阶段先用目录边界、公开 barrel、ESLint 和架构测试约束依赖；只有模块规模或构建时间出现真实问题后再评估 project references，避免先增加构建复杂度。

## 4. 推荐模块契约

前端模块定义只表达前端装配事实：

```ts
export type WebModuleDefinition = Readonly<{
  id: ModuleID;
  apiVersion: string;
  routes: readonly WebModuleRoute[];
  navigation: readonly WebModuleNavigation[];
  locales: WebModuleLocales;
}>;

export type WebModuleRoute = Readonly<{
  id: RouteID;
  path: string;
  layout: "app" | "blank";
  viewOperation?: OperationID;
  lazy: () => Promise<WebRouteModule>;
}>;
```

`lazy` import 只存在于前端模块文件。后端不知道 page component、CSS 或 locale source。

后端 bootstrap 只表达协议事实：

```json
{
  "protocolVersion": "1",
  "modules": [
    {"id": "account", "apiVersion": "v1", "state": "available"},
    {"id": "audit", "apiVersion": "v1", "state": "degraded"}
  ],
  "principal": {"subjectId": "...", "displayName": "..."},
  "access": {
    "account.user.list": "allowed",
    "audit.event.list": "denied"
  }
}
```

服务端 operation gate 仍是最终授权 authority；前端 access 只用于菜单、守卫和状态呈现。

## 5. 身份与宿主边界

完整账号与权限模块需要登录、退出、用户、角色、权限、会话和安全策略页面，但宿主不能再依赖 `WebUISession`。

平台只定义通用 `Principal`、`AccessSnapshot`、`IdentitySessionPort` 与 `refreshBootstrap()`。账号模块的 frontend facet 实现 `IdentitySessionPort`，并由 app composition 显式注入平台。这样 Shell 可以显示当前主体和触发退出，但不知道用户名密码、角色 DTO、CSRF 存储或账号 API 路径。

这不是万能容器：平台只接受启动所需的单一 typed identity port；业务页面不会运行时查询任意 service。

## 6. 样式和共享 UI 边界

- 平台 token 和项目自有 UI primitives 位于 `webui/src/platform`；第三方 UI 类型不暴露给模块。
- 业务模块使用 CSS Modules 或模块自有局部样式，不向全局注册 `.auth-*`、`.ops-*` 等 selector。
- 业务模块可以先在内部实现专属复合组件。
- 只有至少两个模块出现相同、稳定且无业务语义的模式时，才单独研究并提升为平台 UI；不能在业务页面任务中顺手改平台核心。
- 模块之间禁止源码 import；跨模块跳转只引用公开 RouteID，跨模块业务调用只经过后端 API 或 composition 明确连接的窄契约。

## 7. 适用性和局限

适用于内置业务模块、单仓库开发、静态 WebUI 构建，以及同源静态托管或前后端分离部署。

不适用于第三方二进制插件、远程模块、运行时安装卸载、多个团队完全独立发布同一 Shell。若这些需求出现，必须新增研究，不能把 048 的静态 catalog 假装成远程插件 runtime。

## 8. 历史计划影响

本报告当时建议删除 `SourcePath` 并迁出模块页面；该建议已由 R003 取代，不再进入 048 当前任务。仍保留的结论只有：先闭合平台契约与 Auth/Ops 真实流程，不用假 CRUD 验收新模块，并拒绝没有真实需求的运行时微前端。
