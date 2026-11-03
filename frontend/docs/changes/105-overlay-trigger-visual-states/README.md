# 105 Overlay Trigger 交互状态视觉

## 范围与状态

本变更在 ui-adapter 公共层统一治理 Overlay Trigger 按钮（DialogSurface / ConfirmDialog /
DestructiveConfirmDialog / DrawerSurface / CommandMenu 的触发按钮）在 pressed / hover /
focus 状态下被染成 Brand Blue 的问题。Trigger 语义 = 只负责打开浮层，打开前后始终保持
自身 Button semantic appearance；交互反馈存在但不切换语义色。不动普通业务 Action 与
Dialog 内部确认/取消按钮。

研究门禁：已通过 `R105-001`。
计划状态：已确认，实施、验证与任务提交完成。

## 阅读顺序

1. [Overlay Trigger 染 Brand Blue 根因研究](research/R105-001-overlay-trigger-blue-states/report.md)
2. [需求](requirements/README.md)
3. [设计](design/README.md)
4. [任务与证据](tasks.md)

## 关键决策

- 根因：HeroUI `buttonVariants` 默认 `variant="primary"`，未显式传 variant 的 HeroButton
  都带 `button--primary`（→ `--accent`，HeroUI 默认主题蓝）；项目 `.ui-overlay-trigger`
  只覆盖 idle/hover，未治理 pressed/focus-visible。
- 共享层修复：新增 `OverlayTriggerAction`（底层 HeroButton `variant="ghost"` + 项目 tv
  语义色）；default 中性、danger 保持 danger；pressed/hover 同语义深浅反馈；focus-visible
  保留项目 ring。
- 复合 Trigger（Popover/Tooltip/Dropdown）共用 `.ui-overlay-trigger`，补显式三态中性。
- Dialog 内部确认/取消按钮与普通 `Action` 不改。
