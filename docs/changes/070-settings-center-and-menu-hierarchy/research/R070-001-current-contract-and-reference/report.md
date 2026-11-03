# R070-001 当前菜单层级契约与参考站差距；WebUI 自带页面归属现状

## 研究问题

用户要求实现 shadcn-admin 式设置中心（Settings：Profile/Account/Appearance/Notifications 四分区），并评估/升级 WebUI 菜单层级，使「WebUI 自带页面 ↔ 业务模块页面」可双向互为上下级。回答现状契约约束、宿主页面归属、参考形态与升级点。

## 证据

### 1. Navigation/Route 的 owner 约束（internal/webui/contract.go）

- `validateBindings`（契约快照 d9b151f）：
  - `Navigation.RouteID` 必须引用**同模块** route：`owner, exists := routes[item.RouteID]; if !exists || owner.ModuleID != binding.ModuleID { error }`；
  - `Navigation.ParentID` 必须引用**同模块** navigation：`if owner, exists := navigation[item.ParentID]; !exists || owner != binding.ModuleID { error }`。
- 现存 IAM 菜单 `iam.access`（顶级组 + 同模块子项）与 Organization `organization.directory`（063）都只能在模块内嵌套；跨 owner 父子引用被拒绝。
- NavigationPolicySnapshot 的 `parents` 无环遍历（631-680）与 menu 生成（retainMenuWithVisibleParents）与 owner 无关，放开跨 owner 引用不破坏既有门禁。

### 2. WebUI「自带页面」归属现状

- manifest.Routes 全部由模块 Binding 声明；宿主只保留固定系统状态页（404/403/未实现/不可用等，App.tsx 内 RouteErrorBoundary/SystemStatePage），不进 manifest/menu。
- 不存在「宿主可声明入菜单的页面」，因此业务模块「把 WebUI 自带页面纳入自己下级」当前在契约与数据两个层面都不可行；「业务模块页面挂到宿主分组下」同样无宿主分组概念。

### 3. 参考站形态（shadcn-admin settings）

- 侧栏「Settings」二级分组，包含四个子页：Profile（个人资料）、Account（账号/安全）、Appearance（外观/主题）、Notifications（通知偏好）；
- 内容为分区表单/偏好卡 + 统一页头；与本项目 PageSection/Card 表单模板一致，可直接复用现有骨架。

## 差距与升级点

1. **设置中心**：新建业务模块 `settings`（internal/module/settings），实现四子页与两级菜单（组 `settings.center` + 四个子项），复用 iam（资料/安全）、theme（外观）、experience（通知/偏好）数据与 SDK 控件；Notifications 先做前端偏好（localStorage），不新增后端存储（记录为后续候选）。
2. **菜单层级契约升级（双向）**：
   - 放开 `Navigation.ParentID` 的跨 owner 限制：任何已声明 navigation id 都可作父级/子项（无环校验沿用）——业务模块页面可挂到其他模块/平台分组的下级；
   - 新增「宿主导航声明」（composition/内部声明 HostNavigation：ID/落地 RouteID/Title/Icon/Order/ParentID，owner=host），使宿主分组/平台页面可作为业务模块页面的父级；同时模块页面也可作为宿主分组引用（Retain 门禁逻辑复用）。
   - 反向使用（模块页面挂到宿主分组）即「WebUI 自带（设置中心/平台分组）可编排业务模块页面的下级」；正向（设置中心子页挂到业务模块组）即为「业务模块可纳 WebUI 自带页面为下级」——双向演示用 settings.center 作为第一实例。
3. **派生设计思路**：以「双向归属」为规范扩展（例如：`ops.dashboard` 挂到系统组、`iam.security` 挂到设置-账号组等），记录在 070 设计与 webui 开发指南。

## 事实与推断

**事实**：契约强制同模块 ParentID/RouteID；宿主无入菜单页面；参考站为两级设置菜单 + 表单卡。

**推断**：放开跨 owner 引用 + 宿主导航声明可在不破坏无环/排序/门禁的前提下实现「双向」；设置中心以业务模块承载最贴合「业务页面由模块持有」边界。

## 对本任务的影响

- 计划 070：契约升级（放开 ParentID 跨 owner + HostNavigation）+ settings 模块（四子页/菜单/图行政中文案/mock/生成链）+ 双向实例与文档 + Go/WebUI/e2e 验证与截图。