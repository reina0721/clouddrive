# 067 研究档案

## 研究范围

本变更需要回答三个核心问题：

1. 组织管理及其下级模块（部门/岗位/分配）在 WebUI 页面中的「报错」到底是什么、分布在哪些文件、根因是什么？
2. 「参照 react-demo.tailadmin.com 重构全部业务模块页面布局骨架」在现有 token/CSS Module/模块边界约束下应该采用哪种布局原语方案，改动哪些文件？
3. 滚动体验（Lenis 阻尼平滑滚动、弹入响应、边缘阻尼/橡皮筋、磁吸吸附、显式滚动场景劫持、页面滚动条稳定插槽）与派生配置设置采用哪种承载结构：引入哪些成熟第三方、在哪里封装、如何与既有 reduced-motion 决策和 059「不引入动画库」边界共存？

## 检索方式

- `metadata.yaml` 的关键字段：`question`、`topics`、`keywords`、`applicable_scenarios`、`non_applicable_scenarios`、`refresh_triggers`。
- 复用本项目早期档案：`docs/research/README.md`、`docs/changes/{048,053,056,059,060,061,062,063,064,065,066}/research/`。
- 外部样本（TailAdmin）只作为布局与交互参考，不作为依赖候选；Lenis 候选需要按 `docs/architecture/technology-selection.md` 的决策原则逐项对比后再结论。

## 记录索引

| ID | 研究问题 | 结论摘要 |
| --- | --- | --- |
| [R067-001](R067-001-layout-skeleton-reference/report.md) | 组织模块报错事实、TailAdmin 布局骨架与现有页面结构差距 | 报错根因是 AssignmentsPage 使用了未定义的 `webui.organization.assignments.saved/conflict/revision` 翻译键（locale 中只有无 `assignments.` 前缀的键），消费端渲染「翻译资源缺失」占位；另有创建/归档操作未捕获 Promise 拒绝导致无反馈。布局差距为：页面级缺少统一「区块卡片 + 统计行 + 表格卡片」骨架，各模块重复实现 `toolbar/admin-grid/admin-card/admin-meta` 等近似样式。 |
| [R067-002](R067-002-scroll-motion-technology/report.md) | 滚动与动效能力的技术选型与承载边界（Lenis vs 自研；弹入响应 vs 动画库） | 引入 `lenis`（1.3.x，MIT，维护活跃）作为阻尼平滑滚动的成熟第三方并在 `webui/src/scroll/` 自研窄边界封装；弹入响应采用自研 `IntersectionObserver + CSS transition`（不引入动画库，符合 059 边界）；边缘阻尼/磁吸/stab 槽/劫持在平台源内实现并由 `data-experience-*` 派生配置驱动；全部能力尊重 reduced-motion。 |

## 状态

研究门禁结论：关键事实均有代码、测试、依赖 registry 与文档证据；未发现与「静态插拔 + 平台样式 authority」主线的冲突证据。研究门禁通过，进入计划阶段。