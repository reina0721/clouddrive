# R062-002 「骨架 + 注入点」承载架构与候选对比

## 研究问题

把当前注入面升级为「分区骨架 + 类型化注入点 + 统一交互/权限契约」时应采用哪种承载路径：

- A. 继续扩展现有自研静态插拔机制（module Binding → generated registry → Manifest 投影 → 宿主懒加载）；
- B. 引入微前端运行时（single-spa / qiankun / Module Federation）；
- C. 引入无头交互组件库（Radix UI / Headless UI / shadcn 模式）或 CSS 体系（Tailwind）；
- 混合：自研机制为主体，借用成熟模式的交互契约与 APG 对齐。

同时评估「类型化注入点」与「万能 Contribution / Service Locator」的冲突，以及轻量接入、性能、安全、质量链兼容性。

## 方法与范围

- 内部证据：048/056/059/061 已确认决策、`technology-selection.md` 决策原则、生成器与宿主实现（见 metadata 快照）。
- 外部证据：WAI-ARIA APG 与 Radix/Headless UI 官方文档的交互模式；single-spa/qiankun/Module Federation 官方文档的能力边界。外部来源只作模式/能力对比，不核验版本号（不引入依赖，无需版本证据）。
- 判断标准：功能覆盖、承载架构适配成本、安全/资源语义、质量链与门禁兼容、退出成本（对齐 `technology-selection.md` 决策原则 1–6）。

## 候选对比

### A. 继续扩展自研静态插拔机制（推荐并单轨）

- 能力覆盖：现有链路已覆盖「声明 → 校验 → 生成 lazy registry → manifest 门禁 → 宿主装载」。注入点只是在该链路上增加类型化 facet（zone 字段 + 对应 registry/manifest 分区），每类 zone 是窄契约（`HeaderAction`/`SidebarPanel`/`PageHeaderItem`/`WorkspaceTabAction`/`FooterStatusItem`），继续满足 053「不建万能 Contribution」与 3.1「禁止万能容器」红线。
- 架构适配：与 048「业务模块持有 WebUI、宿主只装装配线」、059「静态可插拔语义、生成 registry 是唯一 import 汇合点」完全一致；普通模块接入不改 Host/SDK/generator（SDK 主版本升级除外）。
- 安全/资源：构建期静态 `import()` 让 Vite 生成 async chunk；zone 贡献不进入初始 Shell bundle，冷加载验证沿用 059 性能边界；无运行时代码执行面新增。
- 质量链：`lint:architecture`（module↔host 边界）、`generate:check`（快照）、i18n 覆盖、反向 fixture、E2E/视觉矩阵均可扩展到 zone。
- 成本：自研部分集中在契约/生成器/宿主分区 adapter/SDK zone 能力与交互原语，约等于一次 Platform 能力变更（与 048/059/061 同级）。

### B. 微前端运行时（不引入）

- single-spa / qiankun / Module Federation 解决「运行时安装/卸载远程模块、多前端独立发布、跨技术栈集成」。本项目 048 明确否决「目录扫描、运行时远程模块、Module Federation」；056 门禁「数据库动态页面、外链/iframe、远程模块……必须重新研究」；059 明确「运行时下载远程 bundle、热安装/卸载或多前端独立发布不是当前已实现能力」。引入它们将被迫同时处理签名、SDK 版本协商、CSP、运行时隔离、权限与资源 owner，而用户需求（源码级插拔、声明式注入、统一交互契约）全部可由 A 满足。
- 结论：为未立项的运行时插件目标抢先引入框架是「以流行度代替收益」，违反 3.2 红线；且新增依赖的替换成本远高于 A。

### C. 无头组件库 / CSS 体系（不引入，模式可参考）

- Radix / Headless UI 的通用价值是 dialog/menu/toolbar/button 的 state、disabled、focus 与键盘模式；宿主 059 已自行收口这些细节（overlay 四态、focus trap、roving tabs、reduced motion）。引入库需要重新封装、审计与测试既有行为，收益只是「少维护一些模式代码」，而本项目已通过自研原语 + APG 对齐取得同样行为。
- Tailwind 已在 059 明确否决（保留 CSS design token + CSS Modules）。
- 结论：交互行为契约按 WAI-ARIA APG 的 button/toolbar/dialog/menu 模式对齐（协议参考，非依赖），自研原语继续单轨。

### 混合结论

- 承载架构：A（保留并演进自研静态插拔机制）。
- 交互契约：自研原语 + APG 对齐（模式参考 C，不引入依赖）。
- 图标：宿主受控 IconID 目录（复用现有 Lucide，映射集中声明），服务端校验取值。
- 动作权限：Manifest 投影 action 级 access（沿用现有 route access 判定语义），SDK 提供 `useActionAccess` / `ActionTrigger` 呈现控件；服务端授权模型（IAM Casbin Core RBAC）完全不动。

## 事实与推断的区分

**事实**：048/056/059 已确认的静态插拔决策；生成器/registry/Manifest 链路实现；`webui.Binding` 为 typed struct 且校验完备；SDK capability 主版本协商存在；宿主/模块 import 边界有 `lint:architecture` 守护；现有 UI 原语覆盖主要页面形态但不覆盖状态链与动作权限。

**推断**：
- 用户需求中的「插拔式集成」指源码/构建期静态插拔（用户未要求运行时插件；用户消息的示例全部是静态声明：菜单注册、路由映射、操作入口植入）。
- 分区注入点数量可控（五类 zone + 已有 route），typed facets 不会退化成万能容器。
- 动作级权限投影只影响呈现，不改变服务端授权（与既有文档陈述一致）。

## 适用与不适用场景

- 适用：本轮「骨架 + 注入点」体系；未来若出现真实的多前端独立发布/远程模块目标，再按 B 重新研究（触发条件写入 metadata refresh_triggers）。
- 不适用：把本结论当作「永远不引入微前端」的绝对承诺；把模式参考当作「允许引入依赖」。

## 局限与剩余未知

- 未做原型性能测量，但静态 lazy import 的 chunk 行为已在 059 验证过同一机制（zone 复用同一条 import()）。
- Zone 呈现细节（顶栏折叠策略、侧边栏面板在 collapsed/mobile 的表现）依赖实施期真实模块样例校准，属于已验证任务范围。

## 对本任务的影响

- 研究门禁：可形成「在 A 上扩展，不引入 B/C 依赖」的计划；计划将把「类型化 zone 集合」「受控图标目录」「动作权限投影」「自研交互状态链原语」列为设计决策，并列出待确认决策供用户审批。