# Admin Shell Navigation 修复设计

## 1. 职责边界

- `packages/admin-foundation/shell-navigation`：拥有 Branch Trigger、active/expanded 正交状态、整行 Admin 视觉和 Sidebar DOM Contract。
- `packages/ui-adapter/navigation-flyout`：拥有产品中立的 Popover、Pointer/Keyboard 开关、Focus Restore 和 Trigger/Content Hover Corridor。
- `apps/admin-web`：继续只注入 Router Link、当前位置、翻译和图标；不承载展开状态算法。

## 2. 展开侧栏 Contract

Branch 不再调用 `router.renderLink`，而渲染一个整行 `button[type=button]`：

- `aria-expanded` 表达当前展开状态；
- `aria-controls` 指向条件渲染的子级 `ul`；
- 图标、Label 与私有内联 Chevron 共享 active/hover 背景；
- Chevron 只引用既有 Motion Token，展开时旋转，不创建独立 IconAction surface。

展开状态使用 `ReadonlyMap<branchId, boolean>` 保存用户 override：

```text
expanded = userOverride.get(branchId) ?? activeAncestor
click    = userOverride.set(branchId, !expanded)
```

因此首次进入子页面时父级自动展开；用户收拢后 active 视觉保留但子级隐藏；再次点击恢复。父级点击不产生 Router 调用。

## 3. Compact Flyout Contract

- Pointer Enter Trigger：仅在关闭时打开，标记 pointer modality，不移动焦点。
- Pointer Leave Trigger：启动一次关闭计时；进入 Content 立即取消。
- Pointer Leave Content：启动同一关闭计时；计时到期且 Trigger/Content 都不在指针内才关闭。
- Keyboard Focus/Enter/Space 与 Click：交给 HeroUI Popover 公开契约；Escape 关闭并恢复 Trigger。
- 删除“任何 open 都强制 focus Dialog”的 Effect，避免 Hover 打开改变焦点和触发 Popover 二次生命周期。
- 计时器在卸载时清理；重复 `open=true/false` 不再次通知所有者。

## 4. 文件影响

- 修改 `packages/admin-foundation/src/shell-navigation.tsx` 与必要的 Admin 样式。
- 修改 `packages/ui-adapter/src/navigation-flyout.tsx`，不扩展 vendor props。
- 更新 `apps/admin-web/e2e/navigation.spec.ts` 与受影响的视觉快照。
- 同步 `docs/admin-foundation.md`；公共导出不变，Contract Registry 不新增 owner。

## 5. 验证

- Playwright：活跃父级收拢/展开、URL 不变、叶子导航、移动导航、Compact Hover 单次挂载、Hover Corridor、Click/Escape Focus Restore。
- Axe 与 DOM：Button、`aria-expanded`、`aria-controls`、无嵌套交互元素。
- 视觉：图 3～4 对应 active-expanded、idle-collapsed，以及 Compact Flyout。
- 回归：`pnpm check` 全绿，不放宽视觉或性能预算。
