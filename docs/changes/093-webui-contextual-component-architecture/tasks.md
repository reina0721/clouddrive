# 093 任务与证据

## 研究与计划

- [x] R093-001 审计七张截图、当前组件/CSS/页面组合、092 边界和外部主源；依赖：无；
  完成条件：事实、推断、目标设计和限制分离；证据：`research/R093-001-contextual-component-pollution-audit/`。
- [x] PLAN-093-001 完成需求、分层、页面模式、迁移和验证计划；依赖：R093-001；
  完成条件：本目录固定产物齐全且状态为待确认；证据：`requirements/`、`design/`、本文件。
- [x] CONFIRM-093-001 用户在 093 计划报告后明确确认当前计划；依赖：PLAN-093-001；
  完成条件：当前会话消息“确认 093 计划”；证据：用户 2026-08-29 确认消息。
- [x] BASELINE-093-001 实施入口增量基线检查；依赖：CONFIRM-093-001；完成条件：记录
  revision、Git 状态、相关漂移和触发器判断；证据：实施入口 revision `ce7b5d5`，用户既有
  修改仅为 `docs/changes/README.md` 修改及两个文档删除，均未与 093 源码范围重叠，研究
  快照后的相关 WebUI 实现未发生漂移。

## 组件架构与 Token

- [ ] ARCH-093-001 建立 Primitive/Component/Context Pattern 分层和导入边界；依赖：
  BASELINE-093-001；完成条件：公共导出和依赖图单轨，页面不能穿透；证据：类型检查、lint fixture。
- [ ] TOKEN-093-001 建立 context/surface/hierarchy token；依赖：ARCH-093-001；完成条件：
  form/filter/toolbar/inline/table/dialog/workbench 有受控差异，无自由页面拼装；证据：token 测试和样式审阅。
- [ ] FORM-093-001 拆分 Control、FieldFrame、Form 与 Filter adapters；依赖：ARCH-093-001、
  TOKEN-093-001；完成条件：Label/Error 单 owner，Filter 不再嵌完整 FormField；证据：组件测试。
- [ ] ACTION-093-001 建立 page/section/toolbar/inline/row/icon/toggle/danger 动作层级；依赖：
  TOKEN-093-001；完成条件：Button 不再固定全场景同一尺寸，页面不靠内部 CSS 改造；证据：组件与键盘测试。

## 页面模式迁移

- [ ] LIST-093-001 建立单 Surface 的 ResourceIndex/ListSurface 并迁移全部列表；依赖：
  FORM-093-001、ACTION-093-001；完成条件：Filter、Bulk、Table、Empty、Pagination 连续且只有一个 owner；证据：DOM fixture 与页面测试。
- [ ] SETTINGS-093-001 迁移语言、主题和设置 choice/picker；依赖：ACTION-093-001；
  完成条件：控件选择符合任务矩阵，旧 setting selector 删除；证据：设置 E2E。
- [ ] ORG-093-001 建立 DirectoryWorkspace 并迁移组织页；依赖：FORM-093-001；完成条件：
  搜索无双壳，目录/详情/编辑层级唯一；证据：部门和分配 E2E/截图。
- [ ] OAPI-093-001 建立 WorkbenchShell adapters 并迁移 OpenAPI；依赖：FORM-093-001、
  ACTION-093-001；完成条件：工作台唯一外壳，wide/390 信息层级与功能保持；证据：OpenAPI E2E/截图。
- [ ] HOST-093-001 迁移 RouteSearch、ThemeDrawer、Header 和宿主动作；依赖：ARCH-093-001；
  完成条件：宿主消费受控场景入口，焦点与快捷键语义保持；证据：宿主测试/E2E。

## 清理、门禁与验证

- [ ] CLEAN-093-001 删除旧 API、重复/失效 selector、模块 anatomy 覆盖和补偿规则；依赖：
  全部迁移任务；完成条件：旧符号和禁止规则零引用，无兼容分支；证据：源码/CSS 扫描。
- [ ] GATE-093-001 扩展分层、视觉 owner 和 CSS 补偿门禁；依赖：ARCH-093-001；完成条件：
  正反 fixture 覆盖合法场景差异与非法嵌套；证据：门禁测试。
- [ ] VERIFY-093-001 完成组件、DOM 和页面测试；依赖：迁移与 CLEAN；完成条件：计划场景均有自动化证据；证据：待补。
- [ ] VERIFY-093-002 生成并人工复核视觉矩阵；依赖：VERIFY-093-001；完成条件：代表页覆盖
  light/dark、comfortable/compact、1440/1024/390，逐图记录；证据：待补。
- [ ] VERIFY-093-003 运行 WebUI、Playwright、Go 和 diff 完整门禁；依赖：VERIFY-093-002；
  完成条件：通过或如实记录阻断失败；证据：待补。
- [ ] DOC-093-001 同步当前 WebUI authority 和变更导航；依赖：验证通过；完成条件：当前设计
  只描述 093 单轨结果；`docs/changes/README.md` 的用户改动按逐 hunk 保护；证据：待补。
- [ ] GIT-093-001 精确暂存并创建 Conventional Commit，不推送、不混入用户改动；依赖：
  VERIFY-093-003、DOC-093-001；完成条件：提交范围审阅通过；证据：待补。
