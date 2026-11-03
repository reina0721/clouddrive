# Overlay Trigger 交互状态设计

设计由 `R105-001` 支撑。本变更在 ui-adapter 公共层统一治理 Overlay Trigger 的交互态视觉。

## 1. 共享 Overlay Trigger 语义

新增 `packages/ui-adapter/src/overlay-trigger.tsx` 导出 `OverlayTriggerAction`：

- 底层 `HeroButton` 显式 `variant="ghost"`（HeroUI buttonVariants 默认 variant="primary"
  会注入 `button--primary` → `--button-bg* = --accent`（蓝）；ghost 的 `--button-bg*`
  透明/中性，杜绝 Brand Blue 注入）。
- 语义色由本项目 `tv` 定义：
  - `tone="default"`：`border border-border bg-surface text-ink hover:bg-surface-muted
data-[hovered=true]:bg-surface-muted data-[pressed=true]:bg-surface-muted
focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2`
  - `tone="danger"`：`border border-danger/30 bg-surface text-danger hover:bg-danger-soft
data-[hovered=true]:bg-danger-soft data-[pressed=true]:bg-danger-soft
focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2`
- pressed/hover 用同语义深浅反馈（surface-muted / danger-soft），不换语义色；
  focus-visible 保留项目 ring（可访问性反馈不删除）。

## 2. 各 Overlay 组件改用共享 Trigger

- `DialogSurface` / `DrawerSurface`：`<OverlayTriggerAction onPress={...}>{triggerLabel}</...>`
- `ConfirmDialog`：`tone={tone === 'danger' ? 'danger' : 'default'}`；
  `DestructiveConfirmDialog` 经 tone=danger 得到 danger trigger。
- `CommandMenu`：`<OverlayTriggerAction>`（default）。
- Dialog/AlertDialog **内部**确认/取消按钮保持 HeroButton/CloseTrigger 不变
  （不是 Overlay Trigger；不改普通动作按钮 pressed 行为）。
- Drawer/Command 的 trigger 无 onPress（RAC DialogTrigger 自动接线第一个交互子元素）：
  `OverlayTriggerAction` 的 `onPress` 为可选，底层仍是 HeroButton，RAC 语义保留。

## 3. 复合 Trigger（Popover/Tooltip/Dropdown）

`Popover.Trigger`/`Tooltip.Trigger`/`Dropdown.Trigger`（MenuButton/PopoverCard/
TooltipAction）不是 HeroButton，无 `button--primary`；它们共用 `.ui-overlay-trigger`。
`styles.css` 的 `.ui-overlay-trigger` 补显式交互态：

- hover / `data-[hovered=true]` → `surface-muted`
- active / `data-[pressed=true]` → `surface-muted`（保持中性，不切语义主色）
- focus-visible / `data-[focus-visible=true]` → 项目 focus ring（box-shadow 双环）

## 4. 明确不改

- 普通 `Action` pressed 行为；Modal/AlertDialog 内部按钮。
- 全局 `--accent` 重映射。
- 页面级 CSS 特判。

## 5. 文件影响

新建：`packages/ui-adapter/src/overlay-trigger.tsx`；
`apps/admin-web/src/test/overlay-trigger.test.tsx`。

修改：`packages/ui-adapter/src/overlays.tsx`（5 处 trigger）；
`packages/ui-adapter/src/command-menu.tsx`（trigger）；
`packages/ui-adapter/src/styles.css`（`.ui-overlay-trigger` 三态）；
`packages/ui-adapter/package.json`（`./overlay-trigger` 导出）；
`apps/admin-web/e2e/overlays.spec.ts`（新增 2 条 trigger 状态用例）。

## 6. 验证方案

- 单元：OverlayTriggerAction 语义（ghost 无 primary、default 中性、danger 语义、
  pressed 映射、focus ring 保留、透传）。
- Playwright：五类 trigger idle/hover/pressed/focus-restored 中性 + danger pressed 语义；
  overlays.spec 全量回归（含焦点锁/Escape/危险确认/9 张视觉基线）。
- 门禁全绿：foundation/architecture/dependency/codegen/lint/typecheck/format/docs/build/performance。
- 视觉基线若因语义修复出现合理像素变化，人工确认后更新并在 tasks.md 记录。
