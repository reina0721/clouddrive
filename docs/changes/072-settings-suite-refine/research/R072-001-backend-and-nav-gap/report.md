# R072-001 设置套件细化：分区重组、后端缺口与 SPA 导航缺陷

## 研究问题

(a) IAM 资料字段与归档语义现状；(b) 需新增的自服务端点；(c) 页内导航 SPA 切换注入途径；(d) 语言切换机制；(e) 分区/页面重组路径。

## 证据

### IAM 现状（f4966e2）

- `iam_accounts`（三方言 migration 000001）：`id, username, display_name, status, archived, must_change_password, security_revision, version`——**无昵称/介绍/出生日期等资料字段**。
- `model.NewAccount(username, displayName, ...)`；`Account.Archived` 与 `Assignable()`（Status==Active && !Archived）。
- `Service.ArchiveAccount(accountID)`：软归档语义——阻塞登录/分配并吊销会话（`TestArchiveAccountBlocksLoginAssignmentAndRevokesSessions` 守护）。
- HTTP 只有管理端 `POST /api/v1/iam/accounts/{id}/archive`；**无自服务归档端点、无资料更新端点**。

### SPA 导航注入途径

- `@webui/sdk/runtime` 的 `HostRuntime` **无 navigate**。
- `App.tsx`：`useNavigate` + 组装 `HostRuntime`（52 行）——可把 `navigate(path)` 回调注入 runtime（模块页面经 `useHostRuntime().navigate` 做 SPA 内切换）。
- 先例：`ZoneRenderer` 已向 zone 组件注入 navigate（受限 props 模式）。
- 071 的 SettingsNavLayout 用 href 默认导航 → 整页刷新（用户要求修复）。

### 语言机制

- `webui/src/i18n.ts`：localStorage 键 `community-go-webui-language` + `resolveLanguage`；切换语言即写键并整页重载（顶栏 select 行为）。

### 分区/页面现状

- settings 现四路由（profile/account/appearance/notifications）与 `SettingsNavLayout`（071）。
- 目标 8 分区：profile（资料）、account（用户名/软注销）、security（原改密迁移）、appearance、notifications、language、about、acknowledgement。

## 事实与推断

**事实**：资料字段缺失；archive 已是软注销语义但无自服务端点；runtime 可注入 navigate；语言键已有。

**推断**：新增 migration 004（资料字段）+ 自服务端点（updateProfile、self/archive）即可满足 profile/account；分区重组 = settings 路由调整 + 页内 SectionNav 8 项；导航修复 = HostRuntime.navigate + SettingsNavLayout 接 onSelect（SPA 切换，替换整页导航，单轨）；language/about/acknowledgement 为轻量页面（语言偏好写键+重载；about/acknowledgement 静态内容）。

## 对本任务的影响

072 计划按四条线：IAM 后端（资料+软注销自服务）、settings 板块重组（8 分区）、导航修复（runtime navigate + SectionNav onSelect）、语言/关于/鸣谢页面与文档；Go/WebUI/e2e 门禁与提交。