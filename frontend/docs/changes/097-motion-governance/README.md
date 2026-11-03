# 097 Motion Governance 体系化与 AsyncRegion 落地（motion-governance）

## 范围与状态

把动效治理从"怎么动/为何动"提升为 **Policy + Recipe + Semantic Component** 三层体系：权威文档固化三层 Motion 模型（Screen Transition / Viewport Reveal / Async Content Transition）、Motion Region、Recipe 概念、两层 Policy（用户环境 + Developer Override）与 Motion 决策树；并按 096 登记的触发条件（reference `sceneMode` 迁移）**落地 `AsyncRegion`**——真正解决"数据 Ready 但内容突然出现"的异步内容切换问题。页面转场轻量化尝试（1rem）因本地环境溢出用例时序问题**回退**为 3.75rem（回退亦是单点 Token 变更，见 tasks 附注）。

状态：**已完成**（研究门禁通过，计划经用户确认后实施并完成全部验证；附带修复既有窄屏面包屑溢出缺陷与基线更新，见 tasks FIX-097-001）。

## 阅读顺序

1. [研究档案 R097-001](research/R097-001-async-content-and-governance/report.md)：三层模型映射、消费方盘点与契约参数证据。
2. [需求](requirements/README.md)：动效治理与异步内容切换的可验收行为。
3. [设计](design/README.md)：治理体系、AsyncRegion 契约、reference 迁移、验证方案。
4. [tasks.md](tasks.md)：唯一完成清单（含未来任务触发条件）。

## 关键决策摘要

- 三层 Motion 模型与 Motion Region / Recipe / 两层 Policy 概念全部固化进 `docs/motion-foundation.md`（Motion 主题唯一权威），AGENTS §4.2 增补 Motion 决策树条目。
- `AsyncRegion`（ui-adapter 组合型 Pattern）：state=loading/error/empty/ready，ready 内容进入播放 content.enter，不暴露 duration/easing，不做 exit 主持；消费方 = reference `sceneMode` 全分支迁移。
- `--motion-distance-page` 保持 3.75rem（轻转场 1rem 尝试回退，回退证据见 tasks 附注）；新增 `--motion-distance-reveal` 与 content.enter 配方（含 reduced-motion 覆盖）。
- 明确不做：ViewportReveal/InView、Motion Inspector、ContentSwap、Presence、图片 ImageReady（登记触发条件，用例先行）。

## 终态同步

- `docs/motion-foundation.md`：升级为完整 Motion Governance 规范。
- `frontend/AGENTS.md` §4.2：决策树条目。
- `frontend/README.md`、`docs/ui-element-system.md`、`docs/changes/README.md` 同步。
