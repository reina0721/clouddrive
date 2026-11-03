# 070 设置中心与菜单层级「双向归属」架构升级

状态：研究门禁已通过（R070-001/R070-002）；计划已建立，**待确认**（等待用户对 design.md 第 7 节决策 1–5 的确认）。

## 背景

用户参考 https://shadcn-admin.netlify.app/settings 实现设置中心（Profile/Account/Appearance/Notifications 四分区），并要求评估/升级 WebUI 菜单层级：业务模块是否能将 WebUI 自带页面纳入自己下级菜单，并保证「WebUI 自带 ↔ 业务模块」可双向互为上下级，派生更多设计思路。

研究确认（R070-001）：当前 `internal/webui` 契约强制 `Navigation.ParentID/RouteID` 必须引用**同模块**声明（跨 owner 父子被拒），宿主没有可入选菜单的页面——「双向选择」当前不可行。参考站形态为两级设置菜单 + 表单/偏好卡（与现有页面模板一致）。推荐组合（R070-002）：新业务模块 `settings` 承载四子页；契约升级为「放开跨 owner ParentID 引用 + 新增宿主导航声明 HostNavigation」；Notifications 采用前端 localStorage 偏好（无后端通知系统前不建存储）。

## 范围

- 契约升级（internal/webui/contract.go 放开 ParentID 跨 owner；composition 装配 HostNavigation，owner=host）；
- 新业务模块 `settings`（Profile/Account/Appearance/Notifications + 两级菜单 + i18n/mock/图标/生成链）；
- 双向实例（settings.center 收纳 iam.security 等业务页面进设置组下级，反向实例按确认选择）；
- 派生规范（分组/页面 owner 与引用解耦）与 authority 文档；Go/WebUI/e2e 验证与截图及提交。

## 明确不做

- 不为 Notifications 引入后端存储/消息系统（无真实通知用例）；
- 不把设置逻辑落入宿主 SDK（保持业务页面由模块持有）；
- 不破坏既有模块 Binding 语义（同模块引用仍合法）。

## 阅读顺序

1. [研究档案](research/README.md)：R070-001（现状契约与参考差距）、R070-002（归属与升级候选）
2. [需求规格](requirements.md)：REQ-070-A..D
3. [设计方案](design.md)：契约升级、settings 模块、双向实例、文件影响与待确认决策 1–5
4. [任务清单](tasks.md)：SET-070-A..F