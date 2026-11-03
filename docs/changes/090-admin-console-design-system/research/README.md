# 090 研究索引

本目录记录本方案的事实基线。研究报告区分“当前已实现事实”“从证据得到的推断”和“目标设计”，避免把设计目标描述成现有能力。

| 研究 ID | 主题 | 主要结论 |
| --- | --- | --- |
| R090-001 | [当前 Web UI 系统审计](R090-001-current-webui-system-audit/report.md) | 问题来自壳层、层级、密度、模式复用和响应式的系统性不一致，而非单点样式 |
| R090-002 | [TailAdmin 与参考图布局研究](R090-002-tailadmin-layout-study/report.md) | 舒适感来自稳定骨架、有限容器、清晰主次和低干扰工具区；只吸收原则，不复制视觉 |
| R090-003 | [后端能力缺口](R090-003-backend-capability-gap/report.md) | 当前 CRUD 基础可支撑首轮迁移，但详情、关联、审计、统计和异步批处理契约不足 |
| R090-004 | [前端基础技术复核](R090-004-frontend-foundation-reassessment/report.md) | 推荐清理 v2/v3 混用，保留 React 技术栈并以 HeroUI v3 原语 + 项目模式组件单轨演进 |

## 基线说明

- 代码快照：`47d2d9a`（`fix(webui): restore explicit workspace eligibility`）。
- 复核日期：2026-08-28。
- 研究开始时 087 尚在工作区，收尾时已提交为当前 HEAD；已定向复核 AppShell、WorkspaceRegistry 与变更记录，结论仍成立：普通路由走单一 Outlet，OpenAPI 保留显式 singleton，宿主仍会在存在 workspace 时渲染 42px 标签栏。
- 当前本地 Web 服务未运行；视觉结论来自仓库测试截图、用户提供的参考图和静态代码证据。运行态交互、真实数据密度和性能仍需在确认后的实施验证中补齐。

## 复用关系

本研究复用并定向刷新 082、084、085、086、087 的 Web UI 架构、体验、工作区和 Token 研究。当前代码、截图或依赖与旧快照冲突时，以本目录记录的当前证据为准。
