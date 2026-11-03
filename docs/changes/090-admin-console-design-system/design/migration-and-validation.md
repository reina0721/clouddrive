# 迁移与验证设计

## 1. 单轨迁移原则

不在现有页面上长期叠加一套 `new-*` class 或 `V2` 组件。每个阶段先建立目标能力，再迁移全部调用方并删除旧入口、旧 Token、旧依赖和失效截图。Git 保存历史，不在仓库中保留 legacy 副本。

## 2. 实施阶段

### Phase 0：确认与增量基线

- 用户确认当前 090 计划后才开始。
- 记录确认时 revision 与 Git 状态，重点检查 087 是否已提交或相关路径是否漂移。
- 只在命中 R090 refresh trigger 时定向复核，不重做全仓研究。

### Phase 1：基础单轨化

- 清理 HeroUI v2 Theme/Toast 和 lockfile 旧链；建立 v3 provider/toast/theme 路径。
- 把 Token 拆为 primitive/semantic/component/theme/density，并增加硬编码门禁。
- 拆分巨型 UI 实现，保持受控公共出口；迁移后删除旧实现。

### Phase 2：Shell 与 PageFrame

- 实现新 Sidebar/Header/WorkspaceRail/ContentViewport。
- 建立六种 PageFrame，统一滚动、gutter、max-width、loading/error boundary。
- 优先修复 OpenAPI 宿主单例页签和 compact 工作台骨架。

### Phase 3：模式组件

- ResourceIndex、QueryToolbar、DataGrid/RecordList、SelectionBar；
- EntityDetail、FormPage/SettingsForm、BatchOperation；
- 统一 Feedback matrix、Dialog/Drawer/Toast 边界。

### Phase 4：页面族迁移

按风险与复用价值推进：

1. 账户列表作为 ResourceIndex 标杆；
2. 角色/权限、会话、Token；
3. 审计；
4. 组织 Tree 与任职；
5. 设置；
6. Dashboard/系统状态；
7. OpenAPI workbench 完整交互。

每迁移一个页面族即删除其旧布局/样式和重复状态逻辑，不等最后统一清理。

### Phase 5：后端 P0 与完整详情

前后端可交错实施：先完成通用错误/批量结果与高价值投影，再启用账户、角色、审计等完整详情。P1/P2 按实际产品价值建立后续任务，不阻塞无依赖的 P0 视觉体系。

## 3. 验证矩阵

### 静态与单元验证

- TypeScript strict、lint、format、Token/hardcode 扫描；
- primitives 的 variant 与 a11y 单测；
- query schema、URL round-trip、debounce、cache invalidation；
- form field/server error、dirty/conflict；
- batch partial failure 与权限矩阵。

### 组件与集成验证

- ResourceIndex 所有状态矩阵；
- Dialog/Drawer focus trap、Escape、pending 保护；
- Table/Tree 键盘和读屏公告；
- 后端 query/detail/preview/execute 的契约与错误链；
- 敏感字段不进入 UI、日志与截图。

### 多模态视觉验证

为每个页面族建立真实运行截图，而非只看 DOM：

- 1440×900、1280×800、1024×768、768×1024、390×844；
- 亮色、暗色、normal、compact；
- loading、empty、no-results、error、partial failure、长文本和高数据密度；
- 使用图像对比检查层级、对齐、裁切、溢出和非预期视觉漂移；重要页面再人工视觉复核。

不得把截图像素一致本身当作体验正确；视觉基线只在交互、内容和可访问性都通过后更新。

### E2E 关键流程

- 搜索/筛选/URL 恢复/分页；
- 账户批量状态变更含部分失败；
- 角色权限差异预览与保存冲突；
- Token 一次性 secret 流程；
- 审计筛选、事件详情与关联事件；
- 设置 dirty/保存/离开保护；
- OpenAPI 手机分段发送请求并查看响应。

## 4. 性能门槛

- 以真实典型数据量记录首屏、交互和长列表基线；不在没有测量时承诺具体毫秒值。
- 查询输入不能因请求阻塞；后台刷新不清空内容。
- 大表格先测量 DOM/渲染成本，再决定 pagination、windowing 或 virtualization。
- 图标、图表和重型工作台模块按路由/功能拆包，避免所有页面加载其依赖。

## 5. 完成条件

- 所有 P0 页面使用统一 Shell、PageFrame 和模式组件；
- HeroUI v2 与旧 UI/Token 路径无残留调用；
- 主要页面在验证矩阵所有断点无核心裁切和水平页面溢出；
- 完整状态、键盘操作、权限和部分失败具备自动化证据；
- P0 后端依赖已实现，未实现的 P1/P2 明确记录而不伪装；
- 权威 WebUI 文档、OpenAPI 和截图基线与真实实现一致。

## 6. 回退与风险

- 每个阶段保持可构建、可测试，但不建立运行时旧版回退开关。
- 主要风险是 087 与 Shell 路径重叠、页面迁移跨度大、表格能力低估和后端投影范围扩张。
- 通过分页面族切片、增量基线检查、真实 DataGrid spike 和 P0/P1/P2 边界控制风险；若 spike 推翻组件技术选择，返回研究并重新确认，而不是叠加第二套表格实现。
