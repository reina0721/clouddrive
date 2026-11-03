# R105-001 Overlay Trigger 按钮 pressed/hover/focus 被染 Brand Blue 根因

## 1. 研究问题

DialogSurface / ConfirmDialog / DestructiveConfirmDialog / DrawerSurface / CommandMenu 的
触发按钮（打开 Dialog/Drawer/Command 的载体）在点击后出现 Brand Blue 覆盖。
定位：是哪个状态（pressed / hover / focus-visible）导致、根因在哪一层、正确修复点是什么。

## 2. 已核实事实（逐层）

- **HeroUI Button 默认 variant**：`@heroui/styles` `buttonVariants`（tailwind-variants）
  `defaultVariants: { size: "md", variant: "primary" }`。任何未显式传 `variant` 的
  `HeroButton` 都渲染 `class="button button--md button--primary ..."`。
- **HeroUI button 状态色**：`.button[data-pressed="true"]` 与 `&:active` 用
  `var(--button-bg-pressed)`；`.button:hover` 用 `var(--button-bg-hover)`；
  `focus-visible` 走 `@apply status-focused`（= `focus-ring` = `ring-2 ring-focus`，是 ring
  不是填充）。`.button--primary` 设 `--button-bg = var(--accent)`、
  `--button-bg-hover/pressed = var(--accent-hover)`。
- **HeroUI 默认主题 accent 是蓝**：`variables.css` `--accent: oklch(0.6204 0.195 253.83)`
  （hue 253.83 ≈ 蓝）；项目 `design-system` 未重映射 `--accent`（只映射了项目自己的
  `--ds-brand` 紫）。
- **项目触发按钮现状**：overlays.tsx 的 DialogSurface/ConfirmDialog/DrawerSurface、
  command-menu.tsx 的 CommandMenu 都用裸 `<HeroButton className="ui-overlay-trigger">`
  （无 variant）→ 隐含 `button--primary`。`.ui-overlay-trigger`（ui-adapter/styles.css）
  用 `bg-surface`（白）与 `hover:bg-surface-muted` 覆盖 idle/hover，但**没有显式治理
  pressed / focus-visible**，依赖层叠竞争（Tailwind utility 是否压过 `.button` 的
  `background-color: var(--button-bg)`）。
- **复合 trigger 不染蓝**：`Dropdown.Trigger`/`Popover.Trigger`/`Tooltip.Trigger`
  （MenuButton/PopoverCard/TooltipAction）不是 HeroButton，是 `.dropdown__trigger` /
  `.popover__trigger` + `ui-overlay-trigger`；无 `button--primary`，pressed 仅 `scale(0.97)`，
  focus-visible 仅 ring。
- **项目先例**：`Action`（ui-adapter/action.tsx）渲染 `HeroButton variant="ghost"` + tv
  语义色（secondary/danger 等），ghost variant 的 `--button-bg*` 透明/中性，不引入 accent
  蓝 —— 正是“不受 HeroUI primary 默认污染”的正确模式。
- **运行态观测不一致**（两构建）：一个构建 mouse down 即露 accent 蓝填充；另一个构建
  idle/pressed/hover 均白，Dialog 关闭后（鼠标仍悬停 + focus restore）露
  `rgb(242,244,248)` 冷灰 hover。两者都源于同根因：trigger 携带 `button--primary` 且
  交互态未显式中性化。

## 3. 根因判定

1. 共享 Trigger 使用了 HeroUI 默认 `variant="primary"`（`buttonVariants` 默认值），
   把 `--accent`（蓝）注入 pressed/hover 状态变量。
2. 项目 `.ui-overlay-trigger` 只覆盖常态与 hover，未统一覆盖 pressed / focus-visible
   状态，使蓝可能在任何一次层叠竞争中露出。
3. 修复正确层 = ui-adapter 的 Overlay Trigger 共享语义（底层显式非 primary variant +
   项目语义三态色），先例是 `Action`；而不是页面级 CSS 或全局重映射 `--accent`。

## 4. 对 105 的强制影响

1. 新增共享 `OverlayTriggerAction`（底层 HeroButton `variant="ghost"` + tv 语义色），
   Dialog/Drawer/Confirm/Destructive/Command 全部改用；default 中性、danger 保持 danger。
2. `.ui-overlay-trigger`（复合 trigger 用）显式补 pressed/hover/focus-visible 中性态。
3. 保留 hover 与 focus-visible ring（项目 `--color-focus-ring`），不删除可访问性反馈。
4. 不动 Modal/AlertDialog 内部确认/取消按钮与普通 `Action`。
5. Showcase/e2e 覆盖五类 trigger 的 idle/hover/pressed/focus-visible/focus-restored。

## 5. 局限与刷新

本审计不做全局 `--accent` 重映射评估（影响面超出本问题）；不评估非 HeroUI 场景。
HeroUI Button 默认 variant、`--accent` 主题或 ui-overlay-trigger/Action 样式变化时，
应定向复核并更新本记录。
