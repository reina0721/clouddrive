# Frontend 变更记录

- [117 页面切换动画偏好](117-page-transition-animations/README.md)：保留项目默认页面切换，新增 Vben 的 fade / fade-slide / fade-up / fade-down 与关闭选项，在设置与快捷偏好中配置，含 Vben 运行期证据与验证。
- [116 Vben 对标产品实施](116-vben-parity-implementation/README.md)：六类能力全部落地（演示身份、多布局/页签、偏好/水印/锁屏、表格生产力、菜单/部门/字典、Analytics 与 Workspace），含 Vben 线上实测对照、决策与验证证据。
- [115 Vben 对标需求校准](115-vben-parity-calibration/README.md)：六项源码核对、重复与冲突纠正、独立 VP 编号、候选实施清单和验证；仅文档，未实施产品功能（结论已由 116 逐项实施并修订）。

- [114 API 工作台第二轮优化](114-api-workbench-refinement/README.md)：导航边界、响应式布局、中文术语、独立历史草稿及真实浏览器验证。

- [113 API Workbench 多端 UI/UX 优化](113-api-workbench-ui-ux/README.md)：容器布局、项目抽屉、请求表单、真实执行、草稿持久化与多端交互验收。

- [112 接口调试工作台（API Workbench）](112-api-workbench/README.md)：开发中心接口调试系统（类似 ToAPI），涵盖参数/请求头/认证/伪装/Body/提取器/前后置脚本断言/集合批跑 Runner/定时任务与 IndexedDB 持久化。
- [111 个人账户常驻表单与轻量内联操作](111-account-summary-editors/README.md)：常驻资料／密码表单、轻量操作行、独立会话区段及整批验证。

本目录保存当前 `frontend/` 项目的任务级研究、需求、设计、实施与验证证据（历史账本），
不构成当前架构 authority。当前如何做以 [Frontend 文档手册](../README.md)、
[UI Element System](../ui-element-system.md)、[UI 视觉校准基线](../ui-visual-calibration.md)、
[Motion Foundation](../motion-foundation.md) 与 [Plugin Framework](../plugin-framework.md) 为准。

- [094 新前端 UI Elements 基础设施完善](094-frontend-ui-elements-infrastructure/README.md)：研究门禁已通过，完整线性计划待确认；确认后连续实施 Foundations、UI Elements、Patterns、Showcase、全部现有页面迁移和全量验证。
- [095 页面转场与动效分层](095-page-transitions-and-motion/README.md)：路由级转场（View Transitions API）、Shell 锚定、reduced-motion 豁免与验证；已完成实施与验证。
- [096 Motion Foundation 与语义动效分层](096-motion-foundation/README.md)：动效两层治理（Foundation 管怎么动、Semantic Transition 管为何/何时动）、语义 Token、配方治理、AGENTS 条款与容器目录；已完成实施与验证。
- [097 Motion Governance 体系化与 AsyncRegion 落地](097-motion-governance/README.md)：三层 Motion 模型与 Recipe/Policy/决策树、Motion Region、AsyncRegion（异步内容切换）落地与轻量页面转场；已完成实施与验证。
- [098 Universal Frontend + Admin Product Foundation](098-frontend-product-foundation/README.md)：Universal、Admin Product Surface 与 admin-web Host 三层单轨迁移，含 Form/i18n/Admin Pattern、七类 Page Archetype、Contract Registry 与自动门禁；实施与验证已完成。
- [099 Admin Shell Navigation Interaction](099-admin-shell-navigation-interaction/README.md)：修复父级菜单展开/导航语义、恢复单行 Chevron 视觉并治理 Compact Hover Flyout；实施与验证已完成。
- [100 Top Progress](100-top-progress/README.md)：全局导航进度条（Host 导航生命周期 + 结构化 Loading）；实施与验证已完成。
- [101 Admin Framework / Surface File Routes](101-admin-surface-file-routes/README.md)：Admin Framework 契约、Registry、Surface 私有边界、Reference Plugin、确定性 codegen、治理门禁与最小 Shell bridge；实施与验证已完成。
- [102 Frontend 文档体系](102-frontend-documentation-system/README.md)：前端文档入口手册、Admin Framework authority、既有文档同步、变更索引补全与 `docs:check` 结构门禁；实施与验证已完成。
- [103 导航 no-op 生命周期](103-navigation-noop-lifecycle/README.md)：同 resolved target 重复点击 no-op 短路、导航事务 begin → complete/cancel/fail 收敛、等价判断基于 pathname/search/hash；实施与验证已完成。
- [105 Overlay Trigger 交互状态视觉](105-overlay-trigger-visual-states/README.md)：共享 Overlay Trigger 语义层，pressed/hover/focus 不切换 Brand Blue，danger 语义保持；实施与验证已完成。
- [106 Plugin 架构中装配 schemas 公共 API](106-plugin-schemas-access/README.md)：plugin-framework 暴露浏览器安全 `./schemas` 与 Node `./schemas/runtime` 入口、`/plugin` schemas 命名空间，转出 schemas 公共能力（不访问内部、不改 schemas）；实施与验证已完成。
- [107 独立 Settings 插件与完整用户设置中心](107-settings-center/README.md)：移除 system-tools 偏好页、新增独立 /settings 插件（八分类即时生效、设置搜索与双层恢复默认）、配套页面标签/通知中心/本地草稿/搜索历史/收藏/最近/工作恢复/命令快捷键与 Design System 主题语义扩展；计划已确认并进入实施（SET-001~005-001、SET-007 清理完成，剩余 SET-002 视觉复核/SET-005 其余/SET-006/SET-008 全量验证）。
- [108 UI UX 审查](108-ui-ux-audit/README.md)：完成本地网站38个路由的浏览、关键交互、响应式复核（190个基础组合）与移动专项（114个组合、设置八分类、全部内容Tabs/ToggleGroup/PageTabs），记录优点、P0/P1/P2问题、原因、模式比较、统一适配策略与证据；未修改产品实现。

- [109 UI/UX 优化](109-ui-ux-optimization/README.md)：承接108与107，实施及回归进行中。

- [clouddrive 产品补齐 M0](108-ui-ux-audit/product-readiness-m0.md)：2026-10-12 续审现役源码与授权演示站，盘点路由/实际能力/组件复用、业务缺口、信息架构兼容与 M1–M7 实施计划。用户已要求继续 M1，进度见 [产品实施账本](108-ui-ux-audit/product-implementation.md)。

- [110 后台管理闭环与账户安全](110-management-completion/README.md)：首页仅最近访问，六页业务与账户安全完善；真实后端联调延后。
