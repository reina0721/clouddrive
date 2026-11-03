# 059 设计方案

## 1. 设计原则

- 借鉴 TailAdmin 的结构比例与功能性动效，不复制模板。
- 先稳定宿主状态和 token，再校准像素；业务页面只通过公共 primitive 获得统一外观。
- 动画用于解释空间关系、打开来源和状态切换，不用于制造热闹。
- 现有 route/menu/access/i18n/module owner 是约束，不因视觉升级旁路。

## 2. 模块、SDK 与宿主关系

```text
模块或插件 A                                      WebUI Host B
┌────────────────────────────┐                 ┌────────────────────────────┐
│ Binding / Page / locale    │                 │ Registry loader / Router   │
│ 业务状态 / API adapter     │                 │ Shell / theme / overlay    │
│ 模块 CSS / module tests    │                 │ credentials / shared client│
└──────────────┬─────────────┘                 └──────────────┬─────────────┘
               │ 只 import 项目自有契约                         │ 实现 adapter
               └──────────────→ @webui/sdk/* ←─────────────────┘
                                runtime/navigation/http/
                                i18n/query/ui/feedback
```

### 2.1 A：模块或插件 owner

每个业务模块在 `internal/module/<id>/binding/webui/` 声明 `Binding`，并在自己的 `web/` facet 中拥有 Page、业务状态、API adapter、locale、CSS Module 和页面测试。模块可以组合 SDK primitive，但不能让根 WebUI 代替它实现业务页面，也不能跨模块导入实现。

### 2.2 中间通信：项目自有 SDK 契约

`@webui/sdk/*` 是模块与宿主之间唯一的浏览器通信边界，按 runtime、navigation、http、i18n、query、ui、feedback 等能力分包。契约只暴露项目需要的类型、错误与生命周期语义，模块通过静态 import 使用；不提供运行时 `resolve/get`、万能容器或第三方类型透传。

059 只增强当前视觉任务真实需要的 UI、feedback、motion 与 skeleton 能力。若现有 SDK 无法表达真实需求，先记录调用方和缺口，再更新公共契约、主版本、Host adapter 与 contract test；不得由某个模块直接导入 Host internal 绕过门禁。

### 2.3 B：WebUI Host adapter

根 `webui/src` 负责通用装载和全局资源：generated registry、Manifest route/access 投影、Router、Shell、主题、全局 overlay、HTTP 凭据、共享 query client 与 SDK adapter。Host 不拥有 IAM、Organization、Navigation、Ops 等业务页面，不解释业务 DTO，不以 ModuleID 特判页面行为。

generated registry 是唯一允许出现模块 SourcePath import 的构建产物；手写平台源码保持模块 import 为零。

### 2.4 当前可插拔语义

当前架构是源码与构建期静态可插拔：composition 汇总模块 `Binding`，校验 SourcePath owner 和 SDK major requirement，generator 产生静态 lazy entry/locale import，运行时 Manifest 再按 activation、delivery、access 与 availability 决定可见和可加载内容。

```text
Module Binding
  -> composition/catalog 校验
  -> generated lazy registry
  -> runtime Manifest 投影
  -> Host lazy load
  -> module-owned Page
```

普通模块使用现有 SDK 时，除 composition 的唯一 module list 和 generated artifact 外，不修改 Host、SDK 或 generator source。移除/禁用模块后重新生成，其 entry、route、menu 与 locale 同轨消失。

运行时下载远程 bundle、热安装/卸载或多前端独立发布不是当前已实现能力；它们涉及签名、SDK 版本协商、CSP、隔离、权限和资源 owner，若成为目标必须另立变更研究，不能借 059 暗中引入。

### 2.5 性能边界

构建期生成静态 `import()`，不是把模块页面源码复制进根 WebUI，也不是在浏览器运行时扫描或注册插件。静态路径让 Vite 在 production build 中为业务页面生成 async chunk；Host 只在 Manifest route 通过 access/availability gate 后解析对应 loader，模块 locale 同样按需加载。

059 不把所有模块页面改成 eager import，不新增运行时 plugin loader，也不为了统一 skeleton 预取不可访问模块。验证同时检查 build chunk graph 与冷浏览器 network：初始 Shell 只加载宿主所需资源，首次进入业务 route 才加载该模块的页面/locale，disabled/removed 模块不进入 registry 和构建图。若未来需要受控 prefetch，必须基于真实导航频率、网络条件和权限门禁单独研究，不能默认预取全部模块。

## 3. 目标宿主组件结构

```text
webui/src/
├─ components/
│  ├─ shell/
│  │  ├─ AppSidebar.tsx
│  │  ├─ AppHeader.tsx
│  │  ├─ WorkspaceTabs.tsx
│  │  ├─ AccountMenu.tsx
│  │  ├─ SidebarMenu.tsx
│  │  └─ ShellSkeleton.tsx
│  ├─ AppShell.tsx
│  ├─ RouteSearch.tsx
│  └─ ThemeDrawer.tsx
├─ ui/index.tsx
├─ theme.ts
└─ styles.css
```

`AppShell` 保留现有公开 props，只负责把 manifest/principal/logout 转成宿主 view model，并协调 sidebar、overlay、visited tabs 与 route content。拆分组件接收 typed props/callback，不读取业务模块、Router singleton 或隐藏全局状态。

## 4. Shell 布局

平台 token 提供：

- `--shell-sidebar-expanded`、`--shell-sidebar-collapsed`；
- `--shell-header-height`、`--shell-tabs-height`、`--shell-content-max`；
- `--space-*`、`--radius-*`、`--shadow-*`、`--z-*`；
- `--motion-quick`、`--motion-standard`、`--motion-layout` 与两条 easing。

Desktop 用一个 `--shell-sidebar-current` 同时驱动 Sidebar inline-size 和 workspace inline offset，二者应用相同 `var(--motion-layout)`。初始目标比例以 264px/80px、64px Header、44px tabs 为校准起点；最终值只允许在同轮多视口截图中调整，并记录在任务证据中。

Mobile 断点保持当前 720px，避免在本任务偷偷改变产品断点；drawer 使用 `translateX(-100%)`，打开时锁定 document scroll、显示 backdrop、设置 inert/focus trap，关闭后恢复触发按钮。若实施证据证明断点需要调整，属于设计实质变化并重新确认。

## 5. 导航与 Header

### 5.1 Sidebar

- 保留 ManifestMenu 递归树和 ancestor 自动展开。
- 子菜单容器常驻 DOM，通过 grid row + opacity 表达 open/closed；closed subtree 使用 inert/aria-hidden，避免隐藏链接进入焦点顺序。
- collapsed 时保留 icon、active indicator 和 tooltip/可访问名称；不基于 module owner 虚构 MENU/OTHERS 标题。
- active/hover/focus 使用语义 background、inset indicator 和 120ms feedback，不用位置抖动。

### 5.2 Header

- 左侧：sidebar trigger、mobile trigger、breadcrumb。
- 中部/右侧：route search 为主要工具；全屏、语言、theme quick toggle、theme settings、account 按优先级折叠。
- tablet/mobile 不直接删除能力；低优先级操作进入 account/utility popover 或 icon-only 形态，并保持 aria-label。
- AccountMenu 取代 `<details>`，复用统一 popover dismiss/focus 模型；不增加用户资料或通知等不存在的入口。

## 6. Motion 状态机

公共 overlay 使用四态：

```text
closed -> entering -> open -> exiting -> closed
```

实现可以由 mounted + phase state 和 transition end/受控 timeout 完成；phase timeout 必须来自 motion token 的同一 typed 常量，不能在多个组件散落数字。RouteSearch、AccountMenu、Toast 需要保留 exiting DOM；Drawer/Dialog 保留现有 mounted/inert 思路并统一 phase class。

默认时长：quick 120ms、standard 180ms、layout 240ms。reduced motion 下统一降为近零；代码不得等待完整动画才执行安全语义，例如 backdrop/inert/scroll lock 在 entering 前建立，在 exiting 完成后释放。

页面内容只做轻量 opacity/translate enter，路径变化通过 wrapper phase 触发，不用 `key` 强制重建 Outlet，避免丢失模块内部状态。

## 7. reduced motion

`theme.ts` 增加 effective motion 计算：

```text
effectiveReduceMotion = theme.reduceMotion || systemPrefersReducedMotion
```

监听 `matchMedia('(prefers-reduced-motion: reduce)')`，与 color scheme 一样在系统变化时重新应用。显式开关表示“始终减少”，关闭表示“跟随系统”，相应文案必须更新，避免承诺关闭系统偏好。

## 8. Loading skeleton

分三层：

- `ShellSkeleton`：manifest/initial assembly 时显示中性 sidebar/header/content geometry，不出现业务值；错误仍进入 StartupState。
- `PageSkeleton`：route locale/lazy entry 时保留 PageHeader、三张 summary surface 和主体 surface 的通用几何；不猜测具体模块数据。
- `Skeleton`/DataTable loading：公共 primitive 支持 text/block/avatar/row 组合，现有 `lines` 用法单轨迁移，不保留旧 pulse 外观。

skeleton 使用 background-position shimmer 或 opacity wave，但 reduced motion 下为静态占位。所有 loading region 具有 aria-busy/可访问 label，完成后由真实内容替换。

## 9. Styling authority

`.scaffold/layout.json` 继续声明单一 platform styles 文件；不通过拆成未扫描的 CSS 文件绕过 architecture rule。`styles.css` 原地格式化并按以下顺序组织：

1. design token 与 theme preset；
2. reset/base/focus ring；
3. Shell/Sidebar/Header/Tabs/Footer；
4. overlay/popover/dialog/drawer/toast/search；
5. public UI primitives；
6. loading/motion；
7. responsive；
8. reduced-motion override。

业务 selector 仍禁止进入该文件。各模块在自己的 CSS Module 和 Page owner 内把当前真实页面映射到统一 surface/form/table/detail 层次；根 WebUI 不建立业务 selector 或页面副本，不改变业务状态与操作。

## 10. 依赖结论

- 保留 React、React Router、i18next、TanStack Query、React Hook Form、Zod、Lucide。
- 不新增 Tailwind、PostCSS、Framer Motion、popover library 或另一套 design system。
- 确认零 import 后删除 `@heroui/react`，更新 pnpm lock；不保留 alias 或兼容层。

## 11. 文件影响

计划修改：

- `webui/src/App.tsx`
- `webui/src/components/AppShell.tsx`
- `webui/src/components/RouteSearch.tsx`
- `webui/src/components/ThemeDrawer.tsx`
- `webui/src/components/shell/*`（新增）
- `webui/src/ui/index.tsx`
- `webui/src/theme.ts`
- `webui/src/styles.css`
- `webui/src/i18n/locale/{zh-CN,en-US}.json`
- 对应 `webui/src/*.test.ts(x)` 与 `webui/e2e/webui.spec.ts`
- `internal/module/{iam,organization,navigation,ops}/binding/webui/web/*.{tsx,module.css}` 中与既有页面表现直接相关的文件；每项修改仍由对应模块 owner 持有，只消费公共 SDK/token，不迁入根 `webui/`
- `webui/package.json`、`webui/pnpm-lock.yaml`
- `webui/README.md`、`docs/development/webui.md`
- 本变更文档与 `documentation-impact.yaml`

不计划修改 Go、module Binding、module API、业务 DTO/operation、generated registry、database、config 或 deployment 文件。也不在根 `webui/` 新建 Auth/Ops/IAM/Organization/Navigation 业务页面。若实现必须改变这些范围，先回到研究阶段。

## 12. 验证设计

- 纯函数/组件测试：menu tree、tabs、motion preference、overlay phase、focus target、skeleton markup、collapsed/mobile isolation。
- architecture/i18n：现有 lint 全量运行，确认 platform 不导入 module、module 不导入 platform internal、模块之间不跨 owner、文案覆盖完整；generated registry 是唯一 import 汇合点。
- pluggability：以 fixture 或现有 module registration 验证“模块声明 → registry → Manifest → lazy page”链路，并验证 disabled/removed 模块不再投影 entry、route、menu 与 locale；普通模块接入不修改 Host/SDK/generator source。
- performance：审阅 production build chunk graph，并用冷浏览器 network 记录验证初始 Shell、首次模块 route 与后续切换的资源请求；禁止用 skeleton 或预加载掩盖 eager bundle 回归。
- E2E：sidebar 同步尺寸、submenu、mobile scroll lock/focus、search/account/theme、reduced motion、route loading、logout 与已有模块 route/access。
- visual：固定 1440×1000、1024×768、390×844，light/dark，覆盖需求矩阵并人工查看截图；不只以测试命令退出码替代视觉结论。

## 13. 失败与回退语义

- motion/visual enhancement 不得吞掉 route、locale、logout 或 manifest 错误；原 error boundary 和状态页继续决定结果。
- overlay transition 失败时必须能立即关闭并恢复 focus/scroll，不允许无限等待 transition event。
- localStorage 中旧 ThemePreferences 继续由当前 legacy reader 迁入新默认；不新增永久双轨 schema。若字段语义改变，读入后统一写回当前形态。
