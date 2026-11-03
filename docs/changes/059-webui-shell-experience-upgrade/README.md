# 059 WebUI 后台骨架与交互体验升级

状态：研究门禁已通过，计划已确认（2026-08-23 用户确认），实施已完成；13 项实施任务全部通过门禁，视觉矩阵已由用户验收，提交 `b36dcc6`（未 push）。

## 范围

本变更以当前 React/Vite WebUI、module-owned 页面、generated registry、Manifest 权限投影和 `@webui/sdk/*` 边界为既有基础，参考 TailAdmin Vue 官方仓库、对应 React 实现和 `react-demo.tailadmin.com` 的真实页面观察，升级宿主后台骨架、认证外壳和公共 UI；当前真实模块页面仍由各业务模块在自己的 WebUI facet 内升级，只通过公共 SDK 获得一致的视觉和交互能力。

目标不是移植 TailAdmin、切换 Vue 或复制演示业务，而是完成当前 WebUI 已有能力的产品级收口：

- 统一 Shell 的侧栏、Header、页签、内容区、移动抽屉和 overlay 层级；
- 建立可解释、可关闭且尊重系统偏好的动效体系；
- 用几何稳定的 Shell/Page/Data skeleton 取代临时加载点；
- 补齐账号菜单、搜索、子菜单、Drawer/Dialog/Toast 的进退场与键盘交互；
- 由 Auth、Ops、IAM、Organization、Navigation 各模块继续拥有并校准自身页面的 surface、form、table、toolbar、empty/error/loading 等真实状态，根 `webui/` 不建立对应页面副本；
- 保留真实模块、权限、i18n、Session、错误与资源边界，不引入假数据、演示图表或第二套路由。

## 阅读顺序

1. [研究档案](research/README.md)
2. [需求规格](requirements.md)
3. [设计方案](design.md)
4. [任务清单](tasks.md)

## 当前结论

- 当前 WebUI 不是空壳：已有响应式侧栏、Header、breadcrumb、workspace tabs、route search、主题配置、语言、全屏、账号、Footer 和公共管理 UI。
- 当前页面所有权已经符合模块化主线：模块声明 `Binding` 并拥有 Page、locale、API adapter 与 CSS Module，composition/codegen 生成静态 lazy registry，WebUI Host 根据运行时 Manifest 装载页面；根 `webui/` 不应重新实现任何业务页面。
- 本任务将 A/B/中间通信关系固定为“模块或插件（A）→ 项目自有 SDK 契约 ← WebUI Host Adapter（B）”。普通模块只依赖 `@webui/sdk/*`，宿主只负责 registry、Router、Shell、主题、全局 overlay、凭据与共享 client。
- 当前“可插拔”是源码与构建期的静态装配：启用或移除模块后重新生成 registry/Manifest，不要求普通模块修改宿主核心。运行时下载、安装或卸载远程插件不属于现有架构，也不进入 059。
- 当前问题是细节与状态模型未收口：布局位移和侧栏宽度动画不同步，子菜单/搜索/账号菜单缺少完整进退场，loading skeleton 语义单薄，平台 CSS 难以维护，系统 `prefers-reduced-motion` 没有进入最终动效决策。
- TailAdmin 的可复用价值是布局比例、状态分离、Header 层级、卡片/表格/表单层次、移动抽屉和功能性动效；Vue/Tailwind 技术栈、品牌、Pro 页面、演示数据和资产不进入本项目。
- 本轮不引入 Tailwind CSS 或动画运行时。React 19、React Router、Lucide、项目自有 UI SDK 与 CSS design token 足以实现目标；现有真实模块只在各自 owner 内改表现与交互，不改业务契约。
- 计划会修改源码、样式、依赖声明和测试，因此必须在本报告之后获得用户明确确认才能实施。
