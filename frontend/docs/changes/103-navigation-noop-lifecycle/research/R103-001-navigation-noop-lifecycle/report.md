# R103-001 Admin Shell 重复点击当前 Route 的导航生命周期问题

## 1. 研究问题

复现现象：用户已在某 Route，再次点击 Sidebar 当前菜单项 → 出现不必要重导航/重载，
Top Progress 启动后一直停在 loading。研究整条链路
Sidebar → Route Target → Host Navigation Port → Next Router → Global Progress
在哪一层、因什么机制产生，正确修复点是什么。

## 2. 已核实事实（链路逐层）

- **Sidebar（click 层）**：`apps/admin-web/src/shell/navigation-tree.tsx` 的
  `renderLink` onClick 无条件执行 `markForwardRouteIntent(); beginNavigation(label)`，
  然后交给 Next `<Link>` 默认导航。同一模式的入口还有 `app-shell.tsx`
  （CommandMenu `onAction`、MenuButton `onAction`）、`admin-navigation-port.tsx`
  （renderLink/navigate/replace）、`router-text-link.tsx`、`not-found.tsx`、
  `ui-elements/page.tsx`（redirect）。
- **Global Progress（begin）**：`navigation-progress.ts` 用模块级单一
  `currentNavigationEnd` handle；`beginNavigation()` 若已有旧 handle 先 end 旧的再
  登记新的（连续导航“接管”）。每次 begin 都会把 store `pendingCount +1` 并置 pending。
- **Next Router**：`router.push/replace` 与 `<Link>` 默认导航**不返回完成 promise**
  （App Router 客户端实现返回 void）；同 URL 点击不会重跑页面数据获取
  （官方 use-router/link 文档核实），即**没有真实 commit 事件可等待**。
- **commit 观测（唯一完成信号）**：`route-transition.tsx` 只在 `usePathname()`
  **pathname 变化**时调 `completeNavigation()`；`previousPathnameRef === pathname`
  直接 return。同 pathname（同 URL 自导航、search-only、hash-only）一律不 complete。
- **Global Progress（end）**：`completeNavigation()`/`failNavigation()` 调
  `currentNavigationEnd?.()` 并置 null；handle 内部把 `pendingCount -1`，
  归零进 completing，Top Progress 退出动画后 idle。

## 3. 根因判定

1. no-op 判断缺失：入口只比较“用户意图”，没有任何一层比较
   “最终 resolved target” 与 “当前实际 resolved location”；等价时仍 begin。
2. commit 观测不完整：complete 只认 pathname 变化；同 URL / search-only / hash-only
   导航在 Next 下**无 pathname commit**，complete 信号永不产生。
3. 事务簿记缺失：begin 之后没有任何“若未 commit 则 cancel/fail”的主动收敛路径
   （15s 超时兜底是最后防线，不是导航语义的一部分）。

三者叠加：同路由点击 → begin（pending+1）→ 无 commit → 无 cancel →
pendingCount 卡 1 → Top Progress 停在 loading 直到 15s 超时兜底。

## 4. 推断与修复方向

- 修复必须落在**统一导航事务层**（Host 内、所有入口共享），而不是 Progress 表象或
  Sidebar 特判：
  1. 入口在真实导航提交前先做 **no-op 短路**：`final resolved target` 与
     `当前 resolved location` 等价 → 不 begin、不 push/replace、不启动 progress。
  2. **commit 观测完整化**：RouteTransition 对 pathname/search/hash 任一变化都 complete
     （转场动画标记可与 lifecycle 解耦，仅 pathname 变化播放滑动）。
  3. 每个真实导航事务具备 begin → complete/cancel/fail 收敛；连续导航“新 begin
     取消旧”只在确有旧活跃事务时发生；被中断导航不遗留 pending。
- 等价判断是纯字符串/URL 语义，符合 Core 分层（与现有 `isNavigationHrefActive` 同族）。
- 仓库红线：不能用 timeout 伪装完成、不能隐藏进度条；15s 兜底保留但只是异常防线。

## 5. 对 103 的强制影响

1. Core 增加 resolved-href 解析与等价判断纯函数（pathname 规范化 + search key 无序 +
   hash 精确），可独立单测。
2. Host 增加导航事务层：`shouldProceedWithNavigation(targetHref, label)` 短路 +
   active 事务簿记 + `completeRouteNavigation(resolvedHref)` / cancel / fail 收敛。
3. RouteTransition 改为对 pathname/search/hash 任一变化触发 commit；转场标记仅
   pathname 变化时设置。
4. 全部 Shell 导航入口接入短路（Sidebar Leaf、CommandMenu、MenuButton、Plugin
   renderLink/navigate/replace、RouterTextLink、redirect 页），行为统一且幂等。
5. 单元 + Playwright 覆盖：同路由 no-op；A→B 正常；cancel/fail 收敛；现有
   transition/top-progress/navigation/reference-resources e2e 回归不破坏。

## 6. 局限与刷新

本审计不判断浏览器后退/前进与外部导航的转场视觉；不评估非静态 Host。
Next 导航契约、RouteTransition 或 Global Progress 实现变化时应定向复核并更新本记录。
