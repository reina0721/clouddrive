# R092-001 全站交互组件来源刷新

## 研究问题与方法

基于 091 实施后的当前源码，扫描宿主和全部模块的原生交互标签、手写交互 role、HeroUI/RAC 直接导入与 `@webui/sdk/ui` 使用点；同时核对已安装包的类型声明，不以历史文档的“已完成”替代代码事实。

## 当前事实

- 截图左侧 `SearchInput` 直接渲染原生 search input，右侧 `Field` 使用 HeroUI TextField/Input；这是同页两套输入实现的直接原因。
- FilterBar 文本与 datetime-local、确认输入、DataTable 行选择仍直接使用原生 input。
- ThemeDrawer Tabs/模式选择、RouteSearch combobox/listbox、共享 TreeView、多个 Shell 动作仍手写原生 button 与 ARIA 状态机。
- OpenAPI 工作台同时存在模块直连 HeroUI、原生 file input、原生 details/summary 和手写 Tree/Command Palette。
- 当前依赖已经提供 SearchField、NumberField、DatePicker/DateField/TimeField、FileTrigger、RadioGroup、ToggleButtonGroup、Tabs、ComboBox、Tree 与 Disclosure；无需增加第二套组件库或自研通用交互。
- 091 的“保留”结论与本次用户明确选择的“全站严格单轨”范围冲突；本任务应建立新变更证据，不改写 091 历史。

## 推断与结论

问题根因不是 token 不足，而是页面、宿主、共享 UI 层与模块各自选择交互底座。应把第三方组件装配收束到统一 UI 层，业务代码只组合项目语义组件；源码门禁必须阻止原生交互和模块直连组件库再次出现。

研究分类结论：保留 HeroUI v3/RAC；重构 `@webui/sdk/ui` 为唯一通用交互入口；替换现有原生/自绘交互；退役失效样式和手写键盘状态机；不新增依赖、不改变后端契约。

## 局限与刷新条件

本研究不评价独立 `frontend/`，也不改变浏览器最终 DOM 中由成熟组件生成的 hidden input。HeroUI/RAC 升级或公共 UI 契约变化时需定向刷新。

## 对任务的影响

092 必须覆盖宿主、全部模块和 OpenAPI 工作台，并增加可执行的源码门禁与反向 fixture；只修部门页或只统一视觉不满足验收。
