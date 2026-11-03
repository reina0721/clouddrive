# 071 设置中心页内侧边栏形态（第二类菜单层级） — 设计方案

> 支撑研究：[R071-001](research/R071-001-in-page-nav-gap/report.md)；需求：[requirements.md](requirements.md)

## 1. 目标

以参考站 (shadcn-admin settings) 的「页内侧边栏」为第二类菜单层级形态落地：平台提供 `SectionNav` 原语，settings 四分区在页面内部以垂直导航切换；全局菜单树（070）保留，两类并存。

## 2. SectionNav（SDK 原语，@webui/sdk/ui）

```tsx
export type SectionNavItem = { id: string; label: ReactNode; icon?: ReactNode; href?: string };
export function SectionNav({ items, activeId, onSelect, className, ariaLabel }: {
  items: ReadonlyArray<SectionNavItem>; activeId?: string;
  onSelect?: (id: string) => void; className?: string; ariaLabel?: string;
})
```

- 结构：`<nav class="section-nav" aria-label auto>` → `<ul role="list">` → 每项 `<li><a/或<button/>>`（href 存在用 Link/a 语义；否则 button）；当前项 `aria-current="page"` + `.section-nav-item.active`。
- 键盘：上下移动焦点（保持 focus-visible），Enter/空格触发；焦点不被自动吸附（切换由点击/回调）。
- 响应式：`.section-nav` 桌面垂直（固定 208px），≤720px 水平滚动条（flex row overflow-x auto）——组件自身 class + 平台 CSS 提供。
- 样式：Card 语言（surface/divider、hover/active primary-soft）；`SectionNav` 仅供布局容器，业务内容在右侧。

## 3. settings 接入

```
internal/module/settings/binding/webui/web/
  SectionNavLayout.tsx（共享：左侧 <SectionNav items=[四分区：href=/settings/{profile|account|appearance|notifications}] activeId=当前路由 /> + <div class="settings-inner">{children}</div>）
  ProfilePage.tsx / AccountPage.tsx / AppearancePage.tsx / NotificationsPage.tsx（用 SectionNavLayout 包内容，保留 PageHeader+PageSection+逻辑）
  settings.module.css（.settings-inner 布局：flex；.section-nav 平台类放 styles.css）
```

- 当前路由判定：`useLocation().pathname` 前缀 `/settings/xxx`。
- 全局菜单树（host.center→settings.center→四子页）不修改。

## 4. 平台样式（styles.css public UI 分区）

```css
.section-nav { width: 208px; flex: 0 0 auto; display: flex; flex-direction: column; gap: 4px; }
.section-nav-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius: var(--radius-md); color: var(--text-secondary); font-size:13px; cursor:pointer; text-align:left; width:100%; outline:none; }
.section-nav-item:hover { background: var(--surface-muted); color: var(--text); }
.section-nav-item.active, .section-nav-item[aria-current="page"] { color: var(--primary); background: var(--primary-soft); font-weight:600; }
.section-nav-item:focus-visible { outline:2px solid var(--primary); outline-offset:1px; }
@media (max-width:720px){ .section-nav{ width:100%; flex-direction:row; overflow-x:auto; } .section-nav-item{ flex:0 0 auto; white-space:nowrap; } }
.settings-inner { display:flex; gap:var(--section-gap); align-items:flex-start; }  /* 模块布局可放模块 CSS */
@media (max-width:720px){ .settings-inner{ flex-direction:column; } }
```

## 5. 模块页面骨架（每页）

```tsx
export default function ProfilePage() {
  ...现有逻辑...
  return <SectionNavLayout activeId="profile">
    <PageHeader .../>
    <div className="page-sections">...</div>
  </SectionNavLayout>;
}
```
SectionNavLayout 内：`<div className="page-sections section-nav-row">`（页内布局：SectionNav + 内容）。PageHeader 保持页面内。

## 6. 文件影响

| 区域 | 文件 |
| --- | --- |
| SDK | webui/src/ui/index.tsx（SectionNav + SectionNavItem）+ 单测 ui.test.ts |
| 模块 | internal/module/settings/binding/webui/web/{SectionNavLayout.tsx 新增, Profile/Account/Appearance/NotificationsPage.tsx, settings.module.css} |
| 样式 | webui/src/styles.css（.section-nav*/.section-nav-row 平台类） |
| e2e | webui/e2e/webui.spec.ts（页内导航点击与高亮断言 + 截图 071-settings-*.png） |
| 文档 | docs/development/webui.md（两类层级规范）、071 changelog、webui/README.md |

## 7. 验证

- `pnpm typecheck/lint(i18n+architecture)/lint:modules/vitest/build`；`pnpm generate:check` 一致（无 Go 变更）。
- Playwright：新增页内导航用例；既有 18 用例保持绿。
- 截图 071-settings-profile/account/notifications + 移动视口（页内导航横向折叠）。

## 8. 待确认决策

1. SectionNav 作为平台原语进 `@webui/sdk/ui`（推荐）；
2. settings 四分区以子路由 + 页内导航（推荐，深链保留），全局菜单树并存；
3. 键鼠语义按 navlist/aria-current 实现（推荐）；
4. 移动端页内导航转横向滚动条（推荐）。