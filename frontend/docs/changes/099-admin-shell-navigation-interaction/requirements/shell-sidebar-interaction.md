# Shell 侧边栏父级菜单与 Hover 行为

## 客户目标

Admin Shell 父级菜单应像图 3～4 一样是单一、清晰、可预测的展开控件；侧栏收窄后，Hover Flyout 必须稳定呈现，不能闪烁或重复触发。

## 可验收行为

- 展开侧栏中，父级菜单整行只有一个视觉表面，Chevron 位于行尾且没有独立方形边框。
- 父级有选中子级时保持 active 视觉，但仍可点击收拢；再次点击恢复展开。
- 点击父级只切换展开状态，不改变当前 URL，也不跳转默认子级。
- 叶子菜单仍负责导航，选中态、移动侧栏关闭和 View Transition 行为不变。
- Compact Sidebar 中，指针停留在父级 Trigger 上只打开一次 Flyout；移入 Flyout 不关闭，移出完整交互区后才关闭。
- Hover 打开不抢夺键盘焦点；键盘或点击打开后可用 Escape 关闭并恢复 Trigger 焦点。
- Light/Dark、桌面/移动、active/idle、expanded/collapsed 与 reduced motion 均保持现有 Token 和可访问性契约。

## 非目标

- 不删除 `defaultHref` 数据，不调整路由树、Command Menu、业务页面或权限逻辑。
- 不新增全局 Token、公共 Button Variant、业务菜单配置或后端协议。
