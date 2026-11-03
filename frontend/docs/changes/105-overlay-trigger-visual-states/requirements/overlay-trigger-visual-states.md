# Overlay Trigger 交互状态视觉需求

## 客户目标

DialogSurface / ConfirmDialog / DestructiveConfirmDialog / DrawerSurface / CommandMenu 的
触发按钮（打开浮层的载体）在 pressed / hover / focus 状态下不切换成 Brand Blue；
Trigger 打开浮层前后始终保持自身的 Button semantic appearance。

## 使用场景与可验收行为

### 场景 A：Default Trigger（Dialog / Drawer / Command / 普通确认）

- idle：中性白底 + 边框（原外观）。
- hover / pressed：中性深浅反馈（surface-muted），**不出现 Brand Blue 填充或文字反色**。
- focus-visible（键盘）：保留清晰焦点反馈（ring），不被删除。
- Dialog 关闭后 focus restore 到 Trigger：Trigger 不残留蓝色。

### 场景 B：Destructive Trigger（危险确认）

- idle / hover / pressed 全程保持 danger 语义（danger 文字 + danger-soft 反馈），
  **任何状态都不切换成 Brand Blue**。

### 场景 C：mouse/touch 长按

- 长按 Trigger 不出现突兀的蓝色填充、反色或错误 semantic tone。

### 场景 D：其它按钮不受影响

- 普通业务 `Action` 按钮 pressed 行为不变。
- Dialog/AlertDialog 内部确认/取消按钮不变（它们不是 Overlay Trigger）。

## 范围

- 治理 ui-adapter 共享层：Overlay Trigger 语义按钮（Dialog/Drawer/Confirm/Destructive/
  Command 复用）+ 复合 Trigger（Popover/Tooltip/Dropdown Trigger）的交互态样式。
- 保留 hover 与 keyboard focus-visible 可访问性反馈。

## 非目标

- 不重映射全局 `--accent`。
- 不加页面级 CSS；不在 Dialog/Drawer/Command 各自页面特判。
- 不修改普通业务 Button / Action 的 pressed 行为。
