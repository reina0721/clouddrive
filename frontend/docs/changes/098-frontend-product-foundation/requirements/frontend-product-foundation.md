# Frontend Product Foundation 需求

## 1. 客户目标

未来新增普通后台业务时，开发者只需理解业务语义并组合现有 Layout、Element、Form、State、Motion 与 Admin Pattern，不再重新设计前端底层规则。

## 2. 使用场景

- CRUD 列表、筛选、排序、分页、多选与批量操作。
- 实体详情、主从视图、设置、创建/编辑表单和审核/操作流程。
- Loading、Empty、Error、Partial、Readonly、Denied、Pending 与恢复动作。
- Desktop、Tablet、Mobile、Dark、Compact、英文扩张、键盘和辅助技术。

## 3. 可验收行为

- Universal、Admin Surface 与 Runtime Host 的职责和依赖方向可由自动门禁验证。
- 七类 Admin Page Archetype 均有可运行确定性场景，且不依赖后端或假 API。
- Foundation 的每个公开 Contract 都有分类、owner、Showcase/Reference 和测试证据。
- 新能力必须先尝试 Element、Variant、Composition、Pattern 和 Feature Component，页面特例不能直接扩展全局 Foundation。
- 普通页面不直接依赖 HeroUI、RHF、i18next、Next 私有实现或硬编码视觉参数。

## 4. 约束与非目标

- 不实现 HTTP、API DTO、Query Cache、Session、权限计算、租户、后端任务或真实业务 Feature。
- 不发布 package、不制作 template/starter、不设计跨项目版本兼容。
- 不预建 Product/未来 Runtime 空包，也不保留旧路径兼容层。
