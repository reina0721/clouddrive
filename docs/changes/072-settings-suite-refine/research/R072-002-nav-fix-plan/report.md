# R072-002 页内导航 SPA 修复与设置套件分区实施路径

## 研究问题

(a) 模块内 SPA 导航注入候选；(b) SettingsNavLayout 导航切换改造；(c) IAM 自服务资料/软注销接口设计；(d) 分区与全局菜单取舍。

## 候选对比

### a) SPA 导航注入

| 候选 | 结论 |
| --- | --- |
| HostRuntime 增加 `navigate(path)`（推荐） | App.tsx 已持有 react-router navigate 并组装 HostRuntime；SDK runtime 类型加字段（向后兼容，Requires 保持）；模块页面 `useHostRuntime().navigate` 触发 SPA 切换；与 ZoneRenderer 注入先例一致 |
| 独立全局导航 store/事件 | 违背依赖注入惯例，引入共享可变全局状态 |
| 模块自引 react-router | 违反模块边界（tsconfig 不映射） |

### b) SettingsNavLayout 切换

当前 071：SectionNav href → 浏览器默认导航（整页刷新）。改造：SettingsNavLayout 用 `useHostRuntime().navigate(path)` 作为 SectionNav 的 `onSelect`（此时 SectionNav href 分支会 preventDefault 并回调 onSelect —— 已有该语义）；删除 href 默认导航依赖（单轨：无整页刷新路径残留）。

### c) IAM 自服务端点

| 端点 | 语义 |
| --- | --- |
| `PATCH /api/v1/iam/self/profile`（updateProfile） | 更新当前账号资料：nickname/bio/birthDate，`expectedVersion` 乐观锁（复用 Accounts 更新先例），返回新版本与 identity；权限：会话自服务 |
| `POST /api/v1/iam/self/archive`（softDeleteSelf） | 两步确认（首调返回 `confirmationId`，二次提交真实归档）；复用 `ArchiveAccount` 语义（阻塞登录/分配、吊销会话）——技术软注销，不物理删除 |

migration 004（三方言）：`iam_accounts` 增 `nickname TEXT NULL, bio TEXT NULL, birth_date TEXT NULL`（出生日期以 TEXT/ISO 存）。

### d) 分区与菜单

- 页内 SectionNav 全 8 分区：profile/account/security/appearance/notifications/language/about/acknowledgement。
- 全局菜单 settings.center 子项保持主要五项（profile/account/security/appearance/notifications），language/about/acknowledgement 仅页内（避免菜单过深；文档说明两处可见性）。
- 原 account（改密）→ 拆为 account（用户名/软注销）与 security（改密/认证，071 的 AccountPage 界面迁移）。

## 事实与推断

**事实**：runtime 无 navigate 但装配点存在；archive 软注销语义完备缺自服务端点 + 资料字段；语言键存在。

**推断**：HostRuntime.navigate + SettingsNavLayout onSelect 即修复整页刷新；IAM 自服务两端点 + migration 004 满足资料/软注销；8 分区重组为页内全列 + 菜单五项。

## 对本任务的影响

072 计划：IAM（migration 004 + updateProfile/self-archive + 测试）→ runtime navigate（SDK+App 注入+SectionNav 接入）→ settings 8 分区重组（binding/路由/页面/语言/关于/鸣谢/i18n）→ e2e（页内 SPA 切换断言 + 资料/注销流程 + 截图）→ 文档与提交。