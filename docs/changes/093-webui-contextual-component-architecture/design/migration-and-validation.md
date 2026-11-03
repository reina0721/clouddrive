# 迁移与验证

## 1. 实施入口

确认后记录当前 revision 和 Git 状态，只比较 R093-001 快照后的相关路径与
`refresh_triggers`。未命中触发器时直接实施，不重做全仓研究。当前用户已有文档修改和
删除继续保留；重叠文件逐 hunk 审阅。

## 2. 迁移批次

采用模式垂直迁移，不先发布全局 Token 再逐页补洞：

1. 建立 layer/context/surface-owner 契约、受控 token 和测试 fixture。
2. 拆分 Control 与 FieldFrame，迁移 Form 和 FilterBar。
3. 建立 ResourceIndex ListSurface，迁移 DataTable、Bulk、Empty、Pagination 及全部列表页。
4. 建立 action hierarchy、inline picker 和 settings choice pattern，迁移宿主与设置。
5. 建立 DirectoryWorkspace，迁移 Organization。
6. 建立 WorkbenchShell adapters，迁移 OpenAPI。
7. 删除旧 API、重复 selector、模块全局覆盖和补偿规则，同步当前 authority。

每批必须完成调用方迁移和旧实现删除，不保留兼容 props 或 silent fallback。

## 3. 门禁设计

扩展 architecture/style lint 与正反 fixture：

- 保留 092 的第三方直连、原生交互和手写复合 role 禁止项。
- UI 分层只能向下依赖；页面不能导入 Primitive 内部或样式实现。
- 公共 Component 禁止外部 margin、页面宽度和业务布局；模块 CSS 禁止覆盖平台/第三方
  anatomy selector。
- 禁止公共去壳补偿模式：对公共组件使用负 margin、取消边框/圆角/阴影、强权重和
  `!important`，必要例外进入有 owner、原因和删除触发器的集中 allowlist。
- render/DOM fixture 标记 `data-ui-layer`、`data-ui-pattern`、`data-surface-owner`，断言同一
  pattern 内不出现非法 owner 嵌套；允许的不同层级组合需显式 fixture。
- 检测失效公共 selector：生产 CSS 的平台选择器必须至少被组件、契约 fixture 或集中
  allowlist 引用。

静态规则不尝试从类名猜全部视觉正确性；非法嵌套由渲染结构测试，最终外观由视觉证据
负责。

## 4. 组件与模式测试

- Control/Form：Label/Help/Error 唯一性、受控值、disabled/error/focus、日期时间往返。
- Filter：不同字段类型的共同 filter anatomy、advanced panel、active filter 和清除。
- Actions：page/section/toolbar/inline/row/danger 层级、键盘和 hit target。
- List：standalone/embedded Table、empty/loading/error、selection/indeterminate、bulk、
  pagination 和 inline page-size。
- Settings：Radio/Segmented/Picker 选择和键盘操作。
- Directory/Workbench：Pane surface owner、Tabs/Tree/Disclosure、焦点恢复、滚动和 compact。

## 5. E2E 与视觉矩阵

使用 mock 数据源覆盖至少：部门、账户、角色、API Token、审计、语言、主题抽屉、路由
搜索、OpenAPI 工作台/上传/CommandPalette。每类 pattern 选择代表页，不以单张部门截图
代替全站验收。

矩阵包含 light/dark、comfortable/compact、1440/1024/390px。验收记录两类结果：

- 一致项：focus、disabled、error、selected、危险语义、键盘和对比度；
- 受控差异项：form/filter/inline/workbench 的高度、圆角、padding、Surface 和强调层级。

每张截图人工复核重复边框、嵌套 Card、空白占用、标签错位、弹层比例、横向溢出和
可点击目标；不能只检查 document width 或测试通过数量。

## 6. 完整验证

- `./scripts/Verify-WebUI.ps1`
- 完整 Playwright mock 与 dev 场景；环境性失败与产品失败分开记录
- `go build ./...`
- `go test ./...`
- `git diff --check`
- 旧 API、旧 selector、补偿规则和模块全局覆盖零残留扫描

验证通过后精确暂存 093 文件并创建 Conventional Commit，不推送。实施提交不能混入
当前已有的 `docs/changes/README.md` 修改或文档删除。
