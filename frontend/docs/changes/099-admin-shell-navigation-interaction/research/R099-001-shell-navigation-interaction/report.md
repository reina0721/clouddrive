# R099-001 Admin Shell Navigation 交互根因

## 1. 研究问题

核实五张截图对应的真实 DOM/状态所有权，并判断修复应进入 Universal Element、Admin Pattern 还是 Host。

## 2. 已核实事实

- `ExpandedNode` 对 Branch 使用 `active || expandedIds.has(node.id)`。只要当前叶子属于该 Branch，`active` 永远为 `true`；点击 Toggle 只修改 `expandedIds`，无法覆盖活跃祖先，因此无法收拢。
- Branch 标题通过 `router.renderLink({ href: node.defaultHref })` 建模为导航，Chevron 又由独立 `IconAction` 管理。点击父级文本必然进入默认子路由，形成两个并列点击目标和图 1～2 的方形描边按钮。
- 当前 E2E 明确断言点击 `UI Elements` Link 后进入 `/ui-elements/actions-selection`，测试把缺陷固化成了契约。
- `NavigationFlyout` 在 Hover 打开后无条件把焦点移入 Dialog，同时 Trigger/Content 的 mouse enter/leave、Popover 自身和 focus-visible 都能改变 open。指针打开与键盘打开没有所有权区分，Portal 边界切换时可能连续关闭和重开。
- `NavigationFlyout` 只有 `admin-foundation/shell-navigation` 一个调用方，但其 Overlay/Focus 实现仍属于产品中立的 UI Adapter；父级菜单形态与展开策略属于 Admin Surface。

## 3. 推断与分类

- 父级菜单是 Disclosure Trigger，不是默认子级导航。整行点击只负责展开/收拢；真正导航只发生在叶子 Link。
- 活跃状态与展开状态是正交语义：活跃表示后代命中当前位置，展开表示用户当前是否查看子级。应使用显式用户 override，而不是用 active 强制覆盖。
- 图 3～4 要求一个整行视觉所有者：图标、标题和内联 Chevron 共用 active/hover surface，不保留独立边框方块。
- Hover 打开不能主动抢焦点。指针在 Trigger 与 Flyout Content 之间移动时应视为同一交互区域；键盘/点击继续由 Popover 的公开 Focus/Escape 契约管理。

## 4. 对 099 的强制影响

1. Branch 父级改为单个语义 Button，拥有 `aria-expanded`、`aria-controls`，不调用 Router Port。
2. 展开计算改为 `userOverride ?? active`；用户可以收拢活跃父级，再次点击恢复展开，URL 始终不变。
3. Compact Flyout 分离 Pointer 与 Keyboard 开启路径，Hover 不转移焦点，Trigger/Content 共用延迟关闭所有权。
4. 删除当前“父级跳默认子级”的测试，增加 URL 不变、活跃父级可收拢、Hover 单次挂载、Escape Focus Restore 和视觉快照。

## 5. 局限与刷新

本研究不改变 NavigationNode 数据结构中的 `defaultHref`；它仍可供 Command Navigation、根路径重定向或其它明确导航入口使用，只是不再由 Sidebar Branch Trigger 消费。若 HeroUI Popover API 或 Sidebar 信息架构变化，需要定向刷新本研究。
