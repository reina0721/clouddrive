# 导航 no-op 生命周期设计

设计由 `R103-001` 支撑。本变更在 Host 内新增统一导航事务层并改造全部导航入口。

## 1. Resolved location 等价语义（packages/core）

新增纯函数（Core 层，无 DOM/React，与既有 `isNavigationHrefActive` 同族）：

- `parseResolvedHref(href) -> { pathname, search, hash }`：纯字符串解析，search/hash 不含前导分隔符。
- `normalizePathnameForComparison`：长度 > 1 时去尾斜杠（保留根 `/`）。
- `normalizeSearchForComparison`：key 无序、重复 key 内值有序、编码后比较（`''` 与 `'?'` 等价）。
- `isResolvedNavigationEqual(a, b)`：pathname（规范化）+ search（归一化）+ hash（精确）全等判定。

决策理由：放 Core 是因为等价判断是纯规则且跨 Host/未来调用方稳定；
与 `isNavigationHrefActive`（Sidebar 高亮用 pathname-only）语义不同，二者并存不冲突。

## 2. Host 导航事务层（apps/admin-web/src/host/navigation-lifecycle.ts）

模块级单例（与 navigation-progress.ts 同模式），在 navigation-progress 原语之上做簿记：

- 状态：`lastCommittedHref`（唯一“当前 resolved location”事实源，由 RouteTransition 维护）、
  `activeTargetHref`（活跃事务目标）。
- `shouldProceedWithNavigation(targetHref, label) -> boolean`：目标与 lastCommittedHref 等价
  → false（no-op：调用方不得 push/replace/begin）；不等价 → `beginNavigation(label)` + 记录
  active，返回 true。基线未建立（首帧前）视为真实导航（防御）。
- `completeRouteNavigation(resolvedHref)`：更新基线；有活跃事务则 `completeNavigation()` 并清空；
  无活跃事务（后退/前进/外部导航）只更新基线，不产生 pending。
- `cancelRouteNavigation()` / `failRouteNavigation()`：有活跃事务才取消/失败并清空，幂等。
- `commitResolvedHref` / `getCurrentResolvedHref` / `hasActiveNavigation` / `resetNavigationLifecycle`。

不重复实现 pendingCount：begin/end 语义仍由 navigation-progress 的模块 handle 保证
（其内部对新导航先结束旧 handle，连续导航不叠加）。navigation-progress 增加显式
`cancelNavigation()`（与 complete/fail 同构）。

## 3. commit 观测完整化（route-transition.tsx）

- 用 `usePathname()` + `useSearchParams()` + 客户端 effect 内 `window.location.hash`
  构造 resolved href。
- 首次挂载建立基线；之后**序列化 resolved href 实际变化**（pathname/search/hash 任一）
  才触发：先 `completeRouteNavigation`，再（仅 pathname 变化时）设置
  `data-route-enter`/`data-route-kind` 转场标记。
- 防误触发：useSearchParams 对象身份不稳定，因此比较序列化后的 resolved href，
  渲染级重复执行不触发任何信号。
- 关键分离：**转场标记与生命周期 complete 解耦**——search/hash-only 变化也 complete
  （修复 pending 遗留），但不重放页面进入动画。

## 4. 入口短路矩阵

| 入口                                            | 短路行为                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Sidebar Leaf renderLink（navigation-tree.tsx）  | no-op → preventDefault + onNavigate（移动端/抽屉/Flyout 关闭副作用保留）；真实 → markForwardRouteIntent |
| CommandMenu onAction（app-shell）               | no-op → 关菜单直接 return；真实 → push                                                                  |
| MenuButton onAction（app-shell）                | 同上                                                                                                    |
| Plugin Link renderLink（admin-navigation-port） | no-op → preventDefault + onNavigate                                                                     |
| Plugin navigate/replace                         | no-op → 直接 return，不 push/replace                                                                    |
| RouterTextLink                                  | no-op → return；真实 → push                                                                             |
| not-found / ui-elements 索引 redirect           | 统一 helper；基线未建立时不短路                                                                         |

所有入口不再自行无条件 `beginNavigation`，统一走 `shouldProceedWithNavigation`。

## 5. 错误与失败语义

- AppErrorBoundary 改调 `failRouteNavigation()`（有活跃事务才 fail，幂等）。
- cancel/fail 与 complete 都只对“确有活跃事务”生效，无活跃事务时是安全 no-op。
- 15s 超时兜底保留在 store 层作为异常最后防线，不承担导航语义。

## 6. 文件影响

新建：`packages/core/src/navigation-lifecycle.test.ts`；
`apps/admin-web/src/host/navigation-lifecycle.ts`；
`apps/admin-web/src/test/navigation-lifecycle.test.ts`；
`apps/admin-web/e2e/navigation-noop.spec.ts`。

修改：`packages/core/src/navigation.ts`、`packages/core/src/index.ts`；
`apps/admin-web/src/host/navigation-progress.ts`（加 cancelNavigation）；
`apps/admin-web/src/host/route-transition.tsx`；`apps/admin-web/src/host/error-boundary.tsx`；
`apps/admin-web/src/shell/navigation-tree.tsx`、`apps/admin-web/src/shell/app-shell.tsx`；
`apps/admin-web/src/host/admin-navigation-port.tsx`、`apps/admin-web/src/host/router-text-link.tsx`；
`apps/admin-web/src/app/not-found.tsx`、`apps/admin-web/src/app/ui-elements/page.tsx`。

## 7. 验证方案

- 单元（Core 11 用例：解析/等价/规范化；Host 13 用例：no-op 短路/commit 收敛/cancel/fail/
  连续导航/活跃事务不被 no-op 打断）。
- Playwright navigation-noop.spec.ts 6 用例：同路由 no-op（URL/转场/Progress/RSC）、
  A→B 收敛、快速连点 A→B→C 收敛、移动端抽屉、Compact Flyout。
- 回归：top-progress.spec（14 全绿）、navigation.spec、reference-resources.spec。
- 已知环境问题：transition.spec「无 Suspense」在 next dev 环境基线同样失败（A/B 已验证），
  与本次变更无关；按全量验证（build 后）判定。
- 门禁：architecture/foundation/dependency/codegen/lint/typecheck/format/docs 全绿。
