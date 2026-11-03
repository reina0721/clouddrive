# 093 WebUI 上下文化组件架构与视觉责任治理

## 状态

- 任务性质：包含 WebUI 源码、样式、测试和门禁变更的系统性治理。
- 研究门禁：已通过；证据见 R093-001。
- 计划状态：待确认。
- 实施状态：未开始；本轮只形成研究与计划文档，不修改源码、样式、测试或运行状态。

## 目标

修复 091/092 完成“交互实现来源单轨”后仍存在的组件污染：保留
`HeroUI v3 / React Aria -> @webui/sdk/ui -> 业务复合组件 -> 页面` 的依赖方向，
但把“复用同一交互能力”与“所有场景复用同一完整视觉外壳”分开。

目标层级为：

```text
交互 Primitive
  -> 通用 UI Component
  -> 场景 Adapter / Variant / Pattern
  -> 业务 Composite
  -> Page
```

每层只拥有本层职责：Primitive 管行为和状态，Component 管通用 anatomy，场景层管
密度、层级和组合关系，业务 Composite 管业务结构，Page 只编排。禁止成品组件嵌套成品
组件后再靠全局 CSS 覆盖边框、圆角、宽度和间距。

## 与 090/091/092 的关系

- 090 关于“Card 默认化、重复层级、页面硬编码会造成 Demo 感”的审计继续有效。
- 092 关于“通用交互只能经统一 UI 层装配”的依赖治理继续有效。
- 091 的 TailAdmin 研究把“来源统一”进一步推导成“同类控件同高、同圆角、同外观”，
  这一视觉推导被 R093-001 取代；091 仍保留为历史证据。
- 093 不恢复原生控件或页面自研交互，不新增组件库，也不建立与 092 并行的第二套实现。

## 范围

- WebUI 宿主、全部业务模块、设置中心和 OpenAPI 工作台。
- Button、Input/Search/Select、Tabs/Radio/Toggle、Card/Surface、FilterBar、DataTable、
  Pagination、PageSection、Toolbar、Workspace 等组件与页面模式。
- Design Token、CSS 责任边界、组件组合门禁、DOM/视觉回归和迁移清理。

不改变 HTTP、数据库、权限、时区或业务 API 契约。

## 阅读顺序

1. [研究档案](research/README.md)
2. [需求](requirements/README.md)
3. [设计摘要](design/README.md)
4. [组件分层与上下文系统](design/component-layer-and-context-system.md)
5. [页面模式与视觉所有权](design/page-pattern-and-visual-ownership.md)
6. [迁移与验证](design/migration-and-validation.md)
7. [任务与证据](tasks.md)
