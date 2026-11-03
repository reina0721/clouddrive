# 094 设计摘要

## 关键决策

1. 保留当前 `Semantic Token + HeroUI/React Aria Primitive -> UI Adapter -> Pattern -> Feature -> Host/Page` 单轨，不引入第二套 UI Library；HeroUI 直接依赖及其 compound parts 的 Tailwind styling 只在 Adapter 内互补，Tailwind 语义 utility 则可服务整个前端，不是先后覆盖关系。
2. `Panel` 只保留为 Layout Surface；需要 Header/Content/Footer 和独立内容语义时使用 Card Anatomy，避免“Panel 名义上什么都能装”。
3. DataTable 继续是 Element；Collection Toolbar、Filter、Pagination、Bulk Action 和请求状态由 Pattern 拥有。
4. Feedback Provider 显式装配 Toast Region；业务消费项目通知契约，不直接调用 HeroUI 全局 API。
5. Link 与 Router 分层：UI Element 管文本导航视觉与 anchor 语义，Web Host Adapter 管 SPA Router；Action 不再承担导航。
6. Avatar、Breadcrumb、Pagination、Spinner、Radio/Toggle、Toast 等复用 HeroUI 3.2.4 底层；项目不重写 Accessibility、Focus、Overlay 和 Keyboard。
7. Carousel/Image Grid/Ribbon/Video 当前完成为 Feature Composition 裁决，不建立零调用方组件。
8. 确认后按 `tasks.md` 单线连续实施；阶段验证失败就在当前阶段修复，不把后续阶段降级为“以后再做”。
9. HeroUI 拥有交互语义、可访问性、复合状态和 Overlay 生命周期；Tailwind 在整个前端拥有项目 Token 映射、布局、响应式、主题、密度与视觉组合。禁止在 Adapter 外用 Tailwind selector 修补 HeroUI 内部 DOM，也禁止向上透传 HeroUI props/slot 逃避项目契约。

详细设计见 [组件契约与分层](component-contracts.md)、[迁移与验证](migration-and-validation.md) 和 [原始目标完成追踪](completion-traceability.md)。支撑研究：R094-001、R094-002、R094-003。
