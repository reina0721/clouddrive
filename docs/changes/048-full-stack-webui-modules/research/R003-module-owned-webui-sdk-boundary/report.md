# R003 业务模块自有 WebUI 与 SDK 适配边界

## 1. 用户决策

用户明确修订 048：WebUI 页面不由根 `webui/` 持有，继续由业务模块持有；体系必须通用化，普通新模块不得修改 WebUI 核心。只有新模块提出了现有 WebUI 契约无法表达的新能力或新技术时，才应建立适配 SDK interface。

这项决策取代 R002 中“把 web facet 迁入 `webui/src/module/<id>`”的目标结论，但不改变 R001 对宿主 Auth Session、业务 CSS 和公共契约不足的代码事实。

## 2. 当前事实复核

### 2.1 已经正确的 owner

Auth/Ops 的页面、API、locale 和测试已经位于各自 `internal/module/<id>/binding/webui/web`。Binding 也由模块拥有，Composition 只聚合 `Binding()`。

这使页面和模块 operation/error/API 可以在同一业务边界内演进。把它们迁入根 `webui` 会建立第二个业务 owner，违背当前模块收口规则。

### 2.2 当前不通用的部分

- `webui/src/contracts` 直接公开 `WebUISession`、`completeAuthentication`；
- `App.tsx` 和 `api.ts` 直接知道 Auth session/logout；
- `webui/src/styles.css` 包含 Auth/Ops/diagnostics/metrics 业务 selector；
- 公共 UI 以单文件实现扩张，缺少 public SDK 与 private platform 的清晰分层；
- 模块能 import `@webui/contracts`/`@webui/ui`，但没有自动门禁阻止导入更多 platform internal；
- 没有明确规则判断新技术应留模块还是升级为宿主 SDK。

因此根因不是“页面放在业务模块”，而是宿主公开契约和适配边界不足。

## 3. SourcePath 判断

当前 Go Binding 的 SourcePath 用于 codegen 产生静态 lazy import，runtime manifest 已经剥离路径。用户要求模块继续持有 WebUI 后，SourcePath 是连接模块 Binding 与前端构建的合理元数据，无需删除。

它需要加固：

- 必须落在声明 ModuleID 的 `binding/webui/web` 下；
- 限制相对路径、扩展名、普通文件和 reparse point；
- 不进入浏览器 manifest、日志或诊断；
- generator 只能通用转换，不能出现模块特判。

## 4. 普通模块与 core 变更边界

普通模块是“现有 SDK 足以表达”的模块。其变更范围应固定为：

```text
internal/module/<id>/**
internal/composition 的唯一 module list 增加一项
generated registry（由生成器产生）
```

以下文件零修改：

```text
webui/src/platform/**
webui/src/sdk/**
webui/src/App.tsx / Router / Shell
webui/src platform global CSS
registry generator source
其他业务模块
```

generated registry 的机械变化不是 core design 修改；generator 源码变化才是。

## 5. SDK contract/adapter 模型

业务模块只依赖 `@webui/sdk/*` 的项目自有接口。platform 实现这些接口并管理第三方技术、全局实例和资源。

SDK 必须按职责分包，而不是一个 HostServices：

- runtime：Principal、Access、HostRuntime；
- navigation：RouteID 导航，不暴露 Router；
- HTTP：凭据、取消、错误 envelope；
- i18n：module namespace hook；
- query：统一 client、取消、retry/invalidation 语义；
- UI：项目自有 primitives；
- feedback：overlay、toast、dialog、drawer。

模块通过静态 import 使用 SDK，不允许运行时 `resolve/get`。

## 6. 新技术归属判定

### 6.1 module-local

满足以下全部条件时留模块：

- 只服务该模块；
- 不需要 Router/Shell/global overlay/theme/global credentials；
- 不创建跨模块共享 client、worker 或全局事件源；
- 第三方类型能完全封装在模块 Adapter 内。

例如 Audit 专属语法高亮、配置 diff formatter、单一页面图表投影。

### 6.2 host-level SDK capability

满足任一条件时进入独立 SDK 研究：

- 需要宿主生命周期、Router blocker 或 Shell 状态；
- 需要统一凭据、重连、可见性或全局单例；
- 需要跨模块一致的 overlay、主题、无障碍或任务状态；
- 两个以上模块存在相同、稳定且无业务语义的需求；
- 新技术的资源 owner 必须是 WebUI platform。

此时先定义 project-owned interface，再由 platform adapter 接第三方技术。adapter 不得包含提出需求的 ModuleID 或业务 DTO。

## 7. 新 SDK capability 门禁

一项合格的 SDK capability 至少需要：

1. 真实调用方与现有 SDK 缺口证据；
2. interface、主版本和项目自有类型；
3. 构造、取消、错误、资源/global instance owner；
4. platform adapter 与第三方边界；
5. contract tests、architecture tests 与一个 adoption test；
6. 破坏性变化的单轨迁移计划；
7. 用户对 public SDK/依赖/宿主边界变化的确认。

业务模块任务不能跳过这些步骤直接编辑 core。

## 8. 账号、审计和系统模块的适用方式

- Account 持有全部账号权限页面和业务 DTO；宿主只通过 identity SDK 看通用 Principal/Access。
- Audit 持有事件查询、详情、导出、locale 和样式；模块独有语法处理留模块，全局下载中心另立 SDK。
- Ops 持有 diagnostics/metrics 页面和样式；宿主只提供通用 UI/query/feedback。
- System Settings 持有配置流程；模块内校验不改 core，需要全局离开确认时才新增 navigation blocker SDK。
- Maintenance action 按 owner 分模块；长任务若需要 Shell 全局进度，再研究 task-progress SDK。

## 9. 推断与结论

### 事实

当前业务模块已持有页面，宿主仍泄漏业务契约和样式。

### 用户决策

保留业务模块 WebUI owner；普通新模块 core 零修改；真实新宿主能力才建立 SDK adapter interface。

### 目标设计

保留 Binding/SourcePath/codegen 的静态装配主线，新增 public SDK/private platform 分层、模块 CSS 隔离、SourcePath owner 校验和 capability 升级门禁。

## 10. 局限与刷新条件

本研究没有冻结首批 SDK 的逐个函数签名；该内容必须在实施 Checkpoint A 基于现有调用方完成，不能在文档中虚构已实现 API。

如果出现第三方远程模块、运行时安装或多个独立 WebUI 发布单元，需要重新研究，不能把本方案的静态 Binding/registry 当成插件 runtime。

## 11. 对 048 的影响

048 必须撤销页面迁往 `webui/src/module`、删除 SourcePath、前后端双 profile 和 bootstrap compatibility 的原计划。新计划围绕 SDK 分层、模块样式收口、宿主去业务化、Binding/codegen 加固和普通模块 core 零 Diff 证明实施。
