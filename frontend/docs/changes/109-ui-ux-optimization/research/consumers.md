# 公共消费者与影响边界

## TabsView

- surfaces/plugins/page-archetypes/routes/create-edit/page.tsx (1)
- surfaces/plugins/page-archetypes/src/workbench-detail.tsx (1)
- surfaces/plugins/ui-elements/src/navigation-elements-page.tsx (6)
- surfaces/plugins/ui-elements/src/status-async-page.tsx (1)
- surfaces/plugins/ui-elements/src/surfaces-page.tsx (1)

## ToggleGroup

- surfaces/plugins/motion/routes/page.tsx (1)
- surfaces/plugins/motion/src/motion-inspector.tsx (3)
- surfaces/plugins/ui-elements/src/actions-selection-page.tsx (2)
- surfaces/plugins/ui-elements/src/data-elements-page.tsx (1)

默认 card、Drawer right、无回调表格与全部 Tabs 视觉 Variant 保持各自契约；紧凑 settings 仅选择 row/rows composition，手机数据列适配仅在没有显式列布局时生效。

## Form Foundation 提交入口

- surfaces/plugins/reference-resources/src/resource-form.tsx：异步 Schema 校验、实体保存与导航。
- surfaces/plugins/page-archetypes/routes/create-edit/page.tsx：本地延迟保存示例。

两者继续通过 RHF 管理字段状态和首错；即时提交锁覆盖原生提交入口，卸载门控只
阻止未完成校验继续调用业务回调，不假装取消已经开始的业务操作。本地示例的
定时器由 Plugin 私有 Browser Adapter 清理。公开 API 不增加 vendor 或平台参数。

## Drawer（五个生产消费者）

- apps/web/src/shell/app-shell.tsx：新增左侧手机导航，桌面仍使用相同导航内容。
- apps/web/src/shell/notification-center.tsx：保留既有右侧通知流程。
- surfaces/plugins/settings/src/settings-layout-shell.tsx：分类与字段搜索入口。
- surfaces/plugins/page-archetypes/src/resource-list-page.tsx：同源选中详情。
- surfaces/plugins/ui-elements/src/overlay-elements-page.tsx：正式能力与打开态 Showcase。

placement 默认 right 保留；navigation 只由实际导航消费者 opt-in。关闭、焦点和
滚动隔离继续归 HeroUI；工作台只延后发起打开，不自建 Focus/Overlay 机制。

## Dialog 与确认

生产调用方包括 Host leave-confirm-dialog、Settings restore-defaults、Reference
resource-form、工作台 resource-list-page/column-settings-dialog，以及 UI Overlay
Showcase。普通 Dialog 的短高度与 Confirm 的异步保护共享 Adapter 修复；
危险确认继续消费正式 Confirm 组合。保留各自内容和动作，不给页面透传 vendor props。

## DataTable 与 SearchBox

DataTable 两个生产消费者为工作台 resource-list-page 与 ui-elements/data-elements-page；
DOM 测试为 apps/web/src/test/ui-element-data-display.test.tsx。列宽为 opt-in，不启用
该回调时保留普通 Table 路径。

SearchBox 生产调用方为 Settings settings-layout-shell、工作台 resource-list-page、
UI form-elements-page 和 surfaces-page。公共 shrink 契约一致；Enter/auto 的业务
应用规则仍由调用方管理。

## Field、Panel 与页面组合

字段消费者集中在 Settings、Reference 表单、Archetype 表单、UI Elements 与
Showcase Controls。公共修复为内容起始对齐和文字方向；Settings 紧凑行是显式
组合，不改变所有 Radio 默认高度。TextField/TextArea 的 ref/onBlur 桥接保证正式
Form Foundation reset、dirty 与首错机制可用。

Panel 的默认值不变；首页统计、工作台详情等具体内容面选择既有 outlined/embedded。
Header/Section/Page 仍是权威骨架，页面不引入独立 CSS 或第二套表单/浮层状态。
