# VP-04 集合查询与表格生产力

原 Task 117。状态：未实施；D-04 待选择子项。建议优先评估。

## 已具备与检查入口

[DataTable](../../../../packages/ui-adapter/src/data-table.tsx) 有两档间距、排序、单/多选、列宽与 sticky header；[Collection](../../../../packages/surface-foundation/src/collection.tsx) 提供工具栏和查询槽位；[resource-list](../../../../surfaces/plugins/page-archetypes/src/resource-list-page.tsx) 有列配置及 JSON 导出组合。[users](../../../../surfaces/plugins/users/src/users-page.tsx) 与 [audit](../../../../surfaces/plugins/audit/src/audit-page.tsx) 已有真实查询/分页，不能替换为静态 Demo。

## 可拆分增量与执行顺序

1. VP-04A：选择 users/audit 的真实查询字段与展开规则，先组合 CollectionQuery/Disclosure；保留 Next query params、搜索/重置和翻页归一，不能机械规定“前三项”。仅当两场景都需要稳定契约时扩展 QueryFilter Pattern。
2. VP-04B：盘点 archetype 私有列设置与数据保存语义，提取必要的纯列模型和呈现 Pattern；原示例与业务一起消费新实现。不能跨 Plugin 导入其私有 store，也不因抽取就搬整份业务进 Foundation。
3. VP-04C：若选择导出，明确当前页/全部匹配/选中行、可见列、权限和敏感字段；Feature 提供明确序列化数据，Host/正式 Browser Adapter 下载。CSV 验证引号、换行、Unicode/BOM 和公式型内容策略；JSON 不序列化 ReactNode。失败有反馈，不宣称仅有分页数据时已导出全部。
4. VP-04D：第三档表格间距、固定列、树形展开分别评估真实多消费者。全局 compact/standard/comfortable 偏好目前不等于 DataTable 三档视觉契约，不能无意改变旧表默认值；树形需要先选择正确 HeroUI collection 语义。
5. Dialog 最大化属于独立 Overlay 需求，不能作为表格任务顺带修改所有 Dialog 默认行为；无真实消费者时不新增。

## 重复建设与边界

工具栏、过滤、持久化和文件下载不进入 DataTable。排序 UI 与列顺序区分；用户查询真相继续归现有服务/URL，Loading 与 Pending 分开。提取已有能力要保持列宽/显隐/顺序/排序独立合并、记忆关闭语义与旧存储兼容。

## 后续验收（尚未执行）

- [ ] users/audit 选定查询组合可通过 URL 恢复、清空、提交和分页，刷新/错误/空/权限不足都有真实呈现。
- [ ] 列设置有必需标识列约束、显隐/列序/宽度/重置与旧记录兼容；原 archetype 同源迁移，未选消费者默认不变。
- [ ] 获选导出范围/字段/权限与实际文件一致；CSV 边界及失败覆盖，禁止依赖基础表格读取 Host API。
- [ ] 覆盖列设置、data-display、table-density、用户/审计关键流程；公共 Pattern 至少两个业务场景及 Showcase 同源。

本任务完成还须执行 [公共能力与质量门禁](../design/README.md) 和 [执行协议](../design/execution-protocol.md)；上列清单不替代完整 pnpm check。
