# 092 WebUI 交互组件单轨治理

## 状态

- 研究门禁：已通过，证据见 R092-001。
- 计划状态：已确认；确认依据为用户在 092 计划报告后的消息“PLEASE IMPLEMENT THIS PLAN”。
- 实施状态：实施中。

## 目标

把截图暴露的“同一页面同类控件走两套实现”扩展为全站治理：宿主、业务模块和 OpenAPI 工作台的通用交互统一经 `HeroUI v3 / React Aria -> @webui/sdk/ui -> 业务复合组件 -> 页面` 装配。页面不再直接实现输入、按钮、选择、弹层、Tabs、Tree、Disclosure 等成熟交互。

091 仍作为历史证据保留；本变更刷新其实施后仍存在的 SearchInput、FilterBar input、DataTable selection、ThemeDrawer Tabs、RouteSearch、Tree 与 OpenAPI 专用交互等缺口。

## 阅读顺序

1. [研究档案](research/README.md)
2. [需求](requirements/README.md)
3. [设计](design/README.md)
4. [任务与证据](tasks.md)
