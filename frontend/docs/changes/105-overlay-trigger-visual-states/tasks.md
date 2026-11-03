# 105 Overlay Trigger 交互状态视觉 — 完成清单

研究门禁：`R105-001` 已通过。
计划状态：已确认，实施、验证与任务提交完成。

## 研究与计划

- [x] `R105-001` 审计 Overlay Trigger pressed/hover/focus 被染 Brand Blue 的根因
      （HeroUI buttonVariants 默认 primary、--accent 蓝、项目先例 Action ghost）；
      证据：research/R105-001-*/metadata.yaml + report.md。
- [x] `PLN-105-001` 完成需求、设计与任务并获得用户确认；
      证据：本变更 requirements/design/tasks 与确认消息。

## 共享 Trigger 语义层

- [x] `TRIGGER-105-001` 新建 `packages/ui-adapter/src/overlay-trigger.tsx`：
      `OverlayTriggerAction`（HeroButton variant="ghost" + tv 语义色；default 中性 / danger
      危险；pressed/hover 同语义深浅反馈；focus-visible 保留 ring）；
      证据：文件 + typecheck。
- [x] `TRIGGER-105-002` `overlays.tsx` 5 处 trigger 换 OverlayTriggerAction
      （DialogSurface / ConfirmDialog（tone 映射）/ DestructiveConfirmDialog /
      DrawerSurface）；内部确认/取消按钮保持 HeroButton/CloseTrigger 不变；
      证据：文件 diff + overlays e2e 回归。
- [x] `TRIGGER-105-003` `command-menu.tsx` trigger 换 OverlayTriggerAction；
      证据：文件 diff + Command e2e 回归。
- [x] `TRIGGER-105-004` `styles.css` `.ui-overlay-trigger` 补显式 hover/pressed/
      focus-visible 中性态（复合 Popover/Tooltip/Dropdown Trigger 共用）；
      证据：文件 diff + overlays e2e 回归。
- [x] `TRIGGER-105-005` `package.json` 增加 `./overlay-trigger` 导出；
      证据：package.json diff。

## 测试

- [x] `TEST-105-001` 单测 `apps/admin-web/src/test/overlay-trigger.test.tsx`（5 用例：
      ghost 无 primary、default 中性、danger 语义、pressed 映射、focus ring 保留、透传）；
      证据：64 tests passed（含新增 5）。
- [x] `TEST-105-002` Playwright `overlays.spec.ts` 新增 2 条：
      「Overlay Trigger 交互状态不切换成 Brand Primary」（五类 trigger 语义 + Dialog
      idle/pressed/focus-restored 中性）、「危险确认 Trigger 在 pressed 状态保持 danger
      语义」；证据：overlays.spec 16 passed（含既有焦点锁/Escape/危险确认/9 张视觉基线）。

## 验证与提交

- [x] `VER-105-001` lint / format / typecheck（ui-adapter + admin-web）/ unit 全绿；
      证据：命令输出。
- [x] `VER-105-002` gates：foundation / architecture / dependency / codegen / docs 全绿；
      build + performance 预算通过（验证阶段执行）。
- [x] `VER-105-003` 视觉基线无新增漂移（overlays.spec 既有截图全过）；
      已知历史问题（A/B stash 复核 HEAD 同样复现，与 105 无关，未擅自处理）：
      admin-foundation `universal-motion-desktop`（1440x900 vs 1466）、
      visual.spec `ui-elements-family-status-async`（101/102 已记录）、
      admin-foundation 七类 Archetype Axe color-contrast（resource-list success chip
      #e8f7ef/#15804b 4.49 < 4.5，资源状态徽章，非 Overlay Trigger 相关）。
- [x] `COM-105-001` 精确暂存并创建 Conventional Commit，不推送；
      证据：任务提交仅包含 105 文件，提交前后均复核 staged Diff。
