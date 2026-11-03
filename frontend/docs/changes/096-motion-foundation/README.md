# 096 Motion Foundation 与语义动效分层（motion-foundation）

## 范围与状态

把"动效"管理升级为两层模型：**Motion Foundation 管"怎么动"**（design-system：用途语义 Token、配方单文件、Reduced Motion Policy），**Semantic Transition 管"为什么动、什么时候动"**（语义容器目录：Screen/AsyncContent/Disclosure/Feedback/ContentSwap，按真实用例逐步落地）。同时落实治理红线：禁止万能动画容器、业务层不得硬编码动画参数、动画层与空间层分离。

状态：**已完成**（研究门禁通过，计划经用户确认后实施并完成全部验证）。

## 阅读顺序

1. [研究档案 R096-001](research/R096-001-current-motion-assets/report.md)：当前动效资产盘点、架构指导解析与事实证据。
2. [需求](requirements/README.md)：动效治理的客户可验收行为。
3. [设计](design/README.md)：Token 语义化、配方治理、容器目录、AGENTS 条款全文。
4. [tasks.md](tasks.md)：唯一完成清单（含未来任务触发条件）。

## 关键决策摘要

- 立即落地：tokens.css 用途语义 Token（数值不变，视觉基线零变化）、motion.css 分节与 Token 引用、退役无调用方的 `motion.ts`、`PageTransition` 归属调整为 Layout 层、AGENTS 4.2 条款与 `docs/motion-foundation.md` 权威文档。
- 明确不做：不新建任何动画容器/原语的实例化（Presence/Transition/Disclosure 等均登记触发条件，用例先行）；Overlay 动效维持 HeroUI/Adapter 契约；不建万能动画容器。
- 已核实：HeroUI 3.2.4 提供 `disclosure`/`accordion`/`disclosure-group`（折叠能力优先复用，不自研 Collapse）。
- 未来任务登记：ui-adapter Motion Primitive、Disclosure/Accordion、AsyncContentTransition、`/motion` 验证页、共享层下沉评估。

## 终态同步

- `frontend/AGENTS.md` §4.2 Motion 分层与治理条款。
- `docs/motion-foundation.md`：Motion 主题唯一权威文档。
- `frontend/README.md`、`docs/ui-element-system.md`、`docs/changes/README.md` 同步。
