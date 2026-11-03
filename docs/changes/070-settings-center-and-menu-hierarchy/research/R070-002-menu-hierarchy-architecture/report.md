# R070-002 设置中心模块与菜单层级「双向归属」的架构升级候选

## 研究问题

实现设置中心 + 菜单「双向归属」的承载候选对比与推荐。

## 候选对比

### a) 设置中心归属

| 候选 | 结论 |
| --- | --- |
| 新业务模块 `settings`（推荐） | 四子页（Profile/Account/Appearance/Notifications）+ 两级菜单由模块持有；复用 iam/theme/experience 数据与 SDK；符合「业务页面由模块持有、宿主不装业务」边界 |
| 宿主平台页 | 需新增「宿主 route/menu 声明」且宿主实现业务配置逻辑，违反既有模块边界，成本高 |

### b) 菜单契约升级

| 候选 | 结论 |
| --- | --- |
| 只放开跨 owner ParentID（推荐基线） | RouteID 仍归本人；任何 navigation 可作父级（业务模块页可挂到其他模块/平台分组）；叠加 c 使宿主分组/页面可被引用 |
| 额外引入 `HostNavigation`（推荐） | composition/内部声明宿主导航项（落地 RouteID/标题/图标/顺序/父级），owner=host；供「WebUI 自带页面/平台分组」作为业务模块页面的父级 —— 补足「宿主→业务」方向 |
| 不动契约 | 不满足用户双向诉求 |

### c) Notifications

| 候选 | 结论 |
| --- | --- |
| 前端偏好（推荐） | localStorage 持久化通知相关偏好，页面说明当前无后端通知系统；不新增存储/消息依赖 |
| 后端通知偏好存储 | 当前无真实通知用例，违反「不为不存在用例预建」；列为候选方向仅记录 |

### d) 派生设计思路（记录为规范）

- 分组 owner 与页面 owner 解耦：菜单分组节点可被任意声明者引用为父级（无环/顺序/图标门禁复用，Retain 门禁沿用）——「双向归属」；
- 第一实例：`settings.center` 分组可收纳 settings 自身页面；`iam.security` 等业务页面可挂到 settings 的分组下（业务模块页面 → 平台设置组下级）；settings 子页也可作为其他模块分组的子项（演示选择其一并在文档标注选择）；
- 宿主分组（HostNavigation）：平台级分组（如「系统」）可收纳任意模块页面，形成「宿主框架组织业务」模式。

## 事实与推断

**事实**：契约 owner 约束（同模块 ParentID/RouteID）；无环/排序/Retain 门禁与 owner 无关；参考站为两组设置菜单。

**推断**：放开 ParentID 跨 owner + HostNavigation 可达成双向且门禁可复用；settings 模块为最小可行承载。

## 对本任务的影响

070 计划按此组合编写（任务：契约升级 → HostNavigation → settings 模块（四页+菜单+i18n+mock+生成链）→ 双向实例与文档 → Go/WebUI/e2e 验证与截图 → 提交）。