# 086 唯一 Design Token 系统与公共框架几何稳定化

## 状态

**已确认，实施完成（round 2–3）。**

顶部标签栏（085）与公共框架暴露了样式体系的结构性问题：宿主与业务 CSS 大量散落
magic values、重复语义值、页面级覆盖与 HeroUI 默认值混用，light/dark/preset/density
切换缺少统一 token 管道，公共 Shell 在不同路由下几何不稳定。本变更建立了唯一的
Design Token 系统（primitive → semantic → component 三级），AppShell 由根布局唯一
渲染、业务路由只渲染 ContentViewport，逐组件清扫裸 px/hex/!important 与死规则，
并新增 geometry e2e 断言跨路由 Shell 逐像素稳定。

## 实施摘要

1. **三级 token**：`styles.css` `:root` 重构为 primitive（scale/spacing/typography
   补齐 10/11/15px、radius 补齐 4/5/7/12px、size primitives、色板）→ semantic
   （页面语义色，引用 primitive）→ component（header/sidebar/workspace-tabs/menu/
   form/switch/checkbox 命名空间）；preset 单源 `--prim-primary*`，`--on-accent` 语义。
2. **density 单一管道**：`--density-factor`（compact=0.86）推导 `--workspace-tabs-height`
   `--shell-header-height` `--control-*` `--table-row-*`，删除散点覆盖选择器。
3. **ContentViewport**：业务内容唯一滚动/宽度容器（融合 ScrollExperience +
   `data-page-width` 生产端）；fallback 普通路由与 mounted panel 共用，双 padding 删除；
   固定框架 `flex: 0 0 auto` 修复 flex 收缩导致的跨路由几何漂移（topbar 37→64px）。
4. **模块迁移**：7 个模块 CSS 全部 token 化（openapi/ops/iam/settings/organization/
   navigation/auth）；host 合并 IAM scope 类；ops 数据可视化色单处声明为模块局部变量。
5. **守卫**：style-rules 扩展 L2（裸 token 等价色/mono 栈）、L4（宿主组件类主体重定）、
   L5（!important/未知 token，模块局部变量豁免）；lint-architecture 全仓库通过。
6. **验证**：mock e2e 10/10（含「086 shell geometry is pixel-stable…」5 路由逐像素断言、
   compact/default 只经 factor、ContentViewport 无双滚动副本）；Vitest 234、Go build/test、
   generate --check、typecheck、ESLint、build 全绿；dev e2e 15/7 = 纯净 HEAD 基线一致
   （后端未启动的环境性失败，与 086 无关）。

## 研究结论（摘要）

见 [R086-001](research/R086-001-current-style-audit/report.md)：styles.css 3363 行
token/规则混排；Shell/Tabs/Sidebar 约 105 处裸 px；8 处 !important；若干裸 hex；
`--shell-tabs-height: 42px` 等为准裸值 token；`data-page-width` 无生产端；density 散点
覆盖；模块 CSS 大量 `:global` 与裸值；fallback/panel 双 padding 复制。

## 阅读顺序

1. [研究档案](research/R086-001-current-style-audit/report.md)
2. [需求](requirements.md)
3. [设计](design.md)
4. [任务与确认状态](tasks.md)（含 round 2–3 实施证据）