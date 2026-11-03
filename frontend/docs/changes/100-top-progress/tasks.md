# 任务清单：应用级顶部进度条

支撑研究：R100-001。完成条件与证据统一记录在本文件。

## 研究（已完成，门禁通过）

- [x] R100-001：核实 Next 16 导航生命周期、现有 Loading/Pending/Transition/Progress、架构归属。
      证据：`research/R100-001-top-progress/`（metadata.yaml + report.md）。

## 计划（已确认）

- [x] 建立变更文档（README/requirements/design/tasks.md）。

## 实施

- [x] IMPL-1：`global-progress-state.ts`（zustand store：pendingCount/phase/超时兜底；最小可见周期）。
- [x] IMPL-2：`global-progress-controller.ts`（begin/done/fail/cancel 稳定契约）。
- [x] IMPL-3：`global-progress-context.ts` / `global-progress-provider.tsx` 并在 `providers.tsx` 装配。
- [x] IMPL-4：包装全部导航入口（navigation-tree / app-shell / router-text-link / not-found / ui-elements replace）。
- [x] IMPL-5：RouteTransition 接入导航完成信号（pathname 提交）；Error Boundary fail 兜底。
- [x] IMPL-6：`top-progress.tsx` 并在 AppShell 挂载单例。
- [x] IMPL-7：Design Token（tokens.css progress 语义）与 Motion Recipe（motion.css grow/fade）。
- [x] IMPL-8（第四轮）：`progress-cycle`（回缩循环）→ `progress-grow`（单次延伸至 85% 后保持，
      不回缩不重载）；e2e 新增"只前进不回缩"单调性断言。

## 验证

- [x] VER-1：单测 store 状态机（快速/慢速/连续/失败/取消/超时）——12 用例通过。
- [x] VER-2：单测 TopProgress 渲染（挂载/卸载、aria-hidden、fixed 定位）——5 用例通过。
- [x] VER-3：e2e 极快导航仍显示完整周期、普通导航可感知、慢速导航像素级可见、连续导航不卡住。
- [x] VER-4：e2e 与 Page Transition 共存、暗色/窄屏/Reduced Motion、无布局位移。
- [x] VER-5：全量检查（lint/typecheck/test/foundation/architecture/dependency/build/format）通过。
- [x] VER-6（第四轮）：真实浏览器 fill 宽度序列单调递增（146 采样点、回缩 0 次），
      像素级确认"只前进不回缩"。
