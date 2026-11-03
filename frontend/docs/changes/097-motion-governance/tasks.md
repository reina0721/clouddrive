# 097 Motion Governance 体系化与 AsyncRegion 落地 — 完成清单

研究门禁：R097-001 已通过（证据与刷新触发器见 [metadata.yaml](research/R097-001-async-content-and-governance/metadata.yaml)）。
计划状态：已确认并完成实施与验证。

## 研究与计划

- [x] `R097-001` 盘点三层模型映射、消费方（reference sceneMode）与 AsyncRegion 契约参数；证据：`research/R097-001-async-content-and-governance/{metadata.yaml,report.md}`（含轻转场回退与面包屑缺陷的完整实证记录）。
- [x] `PLN-097-001` 产出需求、设计与任务清单并提交确认；证据：`requirements/`、`design/`、本文件；状态：已确认。

## 治理体系（文档与条款）

- [x] `DOC-097-001` `docs/motion-foundation.md` 升级：三层 Motion 模型、Motion Region、Recipe 概念、两层 Policy（用户环境 + Developer Override/Inspector 规格）、Motion 决策树、Async Content 规范、克制清单、视觉层级示例、当前实现对照表。
- [x] `DOC-097-002` `frontend/AGENTS.md` §4.2 增补 Motion 决策树条目（指向权威文档 §9）。
- [x] `DOC-097-003` 同步 `frontend/README.md`（三层治理 + AsyncRegion 条款）、`docs/ui-element-system.md` §10（AsyncRegion=组合 Pattern 决策）、`docs/changes/README.md`（097 登记，下一序号 098）。
- [x] `DOC-097-004` 本变更 README 状态更新为已完成并保持一致。

## 实施

- [x] `FND-097-001` tokens.css：`--motion-distance-page` 保持 3.75rem（轻转场 1rem 尝试回退，见附注）、新增 `--motion-distance-reveal: 0.5rem`；motion.css：content.enter 配方（fade + 0.5rem rise）+ recipe 命名标注（screen.enter/screen.exit/content.enter）+ reduced-motion 覆盖；证据：diff + 构建 + 配方登记表。
- [x] `UIA-097-001` `packages/ui-adapter/src/async-region.tsx`（AsyncRegion：state/loading/error/empty/ready + label + aria-busy + content.enter 触发）+ `./async-region` 导出 + styles.css 应用层规则；完成条件：不暴露 duration/easing、无 HeroUI 依赖、typecheck 通过；证据：文件 + typecheck + e2e。
- [x] `WEB-097-001` reference 页面 sceneMode 全分支迁移到 AsyncRegion（loading→Skeleton、empty→StateSurface、offline/permission→error、partial-error→ready+alert、ready→内容）；完成条件：既有 e2e 断言（文案/grid/恢复动作）保持通过；证据：diff + e2e 40/40。

## 附带根因修复（验证中发现并修复的既有缺陷）

- [x] `FIX-097-001` ui-adapter `BreadcrumbTrail` 窄屏 EN 溢出：`visual.spec`"移动窗口…无溢出"用例暴露出 HeroUI Breadcrumbs 在 390px 视口 + 英文（`Foundation validation / UI Elements / Fields and pickers`）下第三段溢出 23px 的**既有**布局缺陷（与 097 改动无关：运行中实时切换 CSS 变量 probe 证实布局不受转场 Token 影响；该用例此前"偶发通过"是因为测量早于 i18n 重渲染）。修复：`Breadcrumbs` 容器加 `flex-wrap`（窄屏换行，桌面单行不变）；按人工确认流程更新 `ui-elements-mobile-dark-en-chromium-win32.png` 基线（旧基线为 413px 溢出状态截图，新基线 390px）。证据：probe（EN 稳定后 overflow 23→0）、溢出用例 3/3、全量 39/39。

## 测试

- [x] `TST-097-001` `apps/web/e2e/async-region.spec.ts`（① loading→ready 播放 content.enter；② reduced-motion 无位移动画；③ 快速切换无残留；④ aria-busy/region 语义与 Skeleton 结构）；证据：CI=1 全新 server 3/3 + 全量 39/39。

## 验证

- [x] `VER-097-001` `pnpm check` 全量门禁：architecture / dependency / lint / typecheck / unit / build / performance（css gzip 44,070B ≤ 48KiB）/ browser **39/39**；format:check 仅两个既有基线例外（`providers.test.tsx`、`eslint.config.mjs`，HEAD 同样失败，不属本任务）。
- [x] `VER-097-002` 语义一致性：业务代码零裸露时长/位移字面量（新配方引 Token）；`ui-async-region` 规则与配方登记表一致；FUTURE 区无幻影组件；evidence: grep + 文档对照。
- [x] `COM-097-001` 审阅完整 diff、仅提交本任务文件、Conventional Commits；证据：`3a06172 feat(frontend): add async region content transitions and motion governance`（22 个文件，含 FIX-097-001 面包屑修复与视觉基线更新；用户既有 webui/ 等 26 个改动保持未暂存）。

## 未来任务（登记触发条件，本变更不实施）

- [ ] `FUTURE-097-001` ViewportReveal + InView primitive（reveal-once、Region 边界、Above-fold 默认 off）：触发=真实 below-fold 长内容页/仪表盘出现。
- [ ] `FUTURE-097-002` Motion Inspector（Mode System/Full/Reduced/Off + 分项开关 + Slow Motion 1×/2×/4×，注入点 AppShell/MotionPolicy）：触发=≥2 个 Motion 类别组件共存。
- [ ] `FUTURE-097-003` Presence primitive（exit 主持/双渲染）：触发=AsyncRegion 需要旧层淡出或通用 mount/unmount 动画用例。
- [ ] `FUTURE-097-004` ContentSwapTransition（同路由内容切换 crossfade）：触发=Tabs/筛选联动真实需求。
- [ ] `FUTURE-097-005` 图片 ImageReady（reserved layout/placeholder/decode/crossfade）：触发=真实图片资源组件出现。
- [ ] `FUTURE-097-006` 沿用 096：Disclosure/Accordion、/motion 验证页、共享层下沉评估。
- [ ] `FUTURE-097-007` 轻量页面转场（`--motion-distance-page` 1rem）：本机溢出用例的运行时序稳定（或跑通 CI 环境）后单独评估，避免与超预算用例耦合。
- [ ] `FUTURE-097-008` 溢出用例确定性化：`visual.spec` 溢出断言可等待 i18n 重渲染完成（EN 文案出现）后再测量，消除套件时序耦合（当前靠布局修复保证任意时序不溢出）。
