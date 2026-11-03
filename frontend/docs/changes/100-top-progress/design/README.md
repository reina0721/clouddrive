# 设计：应用级顶部进度条

## 关键决策

1. 生命周期由 Host 包装导航入口统一提供；完成信号来自 RouteTransition 的 pathname 提交。
2. Global Pending State 使用 Host 内 zustand 模块单例；业务通过稳定 Contract 接入。
3. 最小可见周期：每次 begin 立即渲染，归零无条件 completing，保证完整视觉周期；
   真实 Navigation 完成后页面立即渲染，进度条只继续自己的视觉动画，不阻塞交互。
4. 只前进不回缩：fill 单次延伸至 85% 后保持（`progress-grow` + forwards），
   慢速导航下停留 85% 表达 Pending，完成时补满 100% 并淡出。

## 模块边界

```text
apps/admin-web/src/host/
  global-progress-state.ts        Global Progress State（zustand 单例）
  global-progress-controller.ts   Global Pending Contract
  global-progress-context.ts       Context + hook
  global-progress-provider.tsx    Provider 注入共享 Controller
  navigation-progress.ts          Host 导航生命周期接线
  top-progress.tsx                视觉组件（fixed 顶部、trickle/complete）
packages/design-system/src/
  tokens.css                      progress 语义 Token
  motion.css                      progress-grow / progress-fade-out 关键帧
```

## 视觉阶段

| 阶段       | 触发         | 视觉                       |
| ---------- | ------------ | -------------------------- |
| enter      | begin        | fill 从 0 宽度出现         |
| active     | pending      | fill 单次延伸至 85% 后保持 |
| completing | 计数归零     | fill 补满 100% → 容器淡出  |
| exit       | 淡出动画结束 | 卸载，store 回 idle        |
