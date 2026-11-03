# 103 导航 no-op 生命周期

## 范围与状态

本变更统一修复导航生命周期：同 resolved target 的重复点击视为 no-op
（不 push/replace、不重导航、不启动 Top Progress、不增长 pendingCount）；
真实导航事务具备完整 begin → complete/cancel/fail 收敛；等价判断基于最终 resolved
location（pathname + search + hash），覆盖 Shell 全部导航入口。不通过 timeout 伪完成、
不隐藏进度条、不加 Sidebar 特判。

研究门禁：已通过 `R103-001`。
计划状态：已确认，实施、验证与任务提交完成。

## 阅读顺序

1. [导航 no-op 生命周期问题研究](research/R103-001-navigation-noop-lifecycle/report.md)
2. [需求](requirements/README.md)
3. [设计](design/README.md)
4. [任务与证据](tasks.md)

## 关键决策

- 根因：click 层无条件 begin + RouteTransition 只在 pathname 变化时 complete +
  Next push/Link 无完成 promise → 同路由 no-op 点击的 pending 永不收敛。
- Core 增加 resolved location 等价判断纯函数（pathname 规范化 + search key 无序 + hash 精确）。
- Host 新增导航事务层 `navigation-lifecycle.ts`：`shouldProceedWithNavigation` 短路 +
  active 簿记 + commit/cancel/fail 收敛；navigation-progress 增加 `cancelNavigation`。
- RouteTransition 对 pathname/search/hash 任一实际变化 complete（序列化比较防误触发），
  转场标记仅 pathname 变化时设置（与 lifecycle 解耦）。
- 全部 Shell 导航入口接入短路；AppErrorBoundary 走 failRouteNavigation。
- 已知：transition.spec「无 Suspense」在 next dev 环境基线同样失败（A/B 验证与本次无关）。
