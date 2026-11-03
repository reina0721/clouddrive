# 072 设置套件细化：8 分区重组、IAM 自服务资料/软注销、SPA 页内导航修复 — 需求规格

> 支撑研究：[R072-001](research/R072-001-backend-and-nav-gap/report.md)、[R072-002](research/R072-002-nav-fix-plan/report.md)

## 1. 目标与范围

- 管理中心（host.center）下的设置模块重组为 **8 分区**：profile（用户主页设置：昵称/介绍/出生日期，经用户/权限体系接口）、account（用户名/注销＝技术软注销）、security（密码/认证，承接原改密）、appearance、notifications、language、about（项目介绍/技术栈/仓库地址）、acknowledgement（鸣谢）。
- **修复缺陷**：页内分区导航点击不应整页刷新（SPA 内切换）。
- 范围：IAM 后端（资料字段 migration + 自服务 updateProfile/self-archive 端点与测试）；WebUI runtime 导航能力（HostRuntime.navigate + App 注入）；settings 模块分区重组（8 路由/页内导航/语言页/关于页/鸣谢页/i18n 双语文案）；e2e 与截图；文档与提交。不改其他模块既有契约。

## 2. 需求项

### REQ-072-A IAM 资料字段与自服务接口

- A1：migration 004（三方言 mysql/postgres/sqlite）：`iam_accounts` 增 `nickname`、`bio`、`birth_date`（可空）。
- A2：`PATCH /api/v1/iam/self/profile`（updateProfile）：更新当前账号资料（昵称/介绍/出生日期），`expectedVersion` 乐观锁，返回新版本与 identity；登录会话自服务权限；操作权限与 permission catalog/observability/openapi 同步。
- A3：`POST /api/v1/iam/self/archive`（softDeleteSelf）：两步确认（首调返回 `confirmationId`，二次确认执行）→ 复用归档语义（阻塞登录/分配、吊销会话，技术软注销，不物理删除）；拒绝已归档账号；两步之间增加防误触校验。

### REQ-072-B 页内导航 SPA 修复

- B1：`@webui/sdk/runtime` 的 `HostRuntime` 增加 `navigate(path: string): void`（App.tsx 注入 react-router navigate；向后兼容，Requires 不升主版本）。
- B2：`SettingsNavLayout` 改用 SectionNav `onSelect` → `navigate(path)`（SPA 切换），移除 071 的整页默认导航路径（单轨，无刷新残留）。

### REQ-072-C settings 8 分区重组

- C1：routes 增到 8：`/settings/{profile,account,security,appearance,notifications,language,about,acknowledgement}`；`settings.center` 全局菜单子项保留五主分区，页内 SectionNav 全 8 分区。
- C2：页面：profile（资料表单，接 updateProfile/loadSession）、account（用户名只读显示 + 注销两步确认，接 self/archive + 会话处理）、security（改密/认证，由原 AccountPage 迁移）、appearance（保持代码迁移）、notifications（保持）、language（语言偏好：写 `community-go-webui-language` + 重载）、about（项目介绍/技术栈/仓库地址静态文案）、acknowledgement（鸣谢静态文案）。
- C3：i18n en/zh 全量键；mock 补充（updateProfile/self/archive 前端 mock 端点或注记）。

### REQ-072-D 验证与文档

- D1：Go：IAM 新增端点契约/openapi/permission/observability 同步，单元与 archive 流程测试（乐观锁、两步确认、归档后登录拒绝）；全量 go test 绿。
- D2：WebUI：typecheck/lint(i18n+architecture)/lint:modules/vitest/build/generate:check 绿；e2e：页内导航点击切换 URL 且**不发生整页 reload**（导航事件/PW 断言）、资料表单保存、注销两步流程、语言页/关于页/鸣谢页渲染、截图 072-*。
- D3：文档：IAM 自服务契约（docs/development/…）、webui 开发指南（8 分区 + SPA 导航）、changelog 072、提交。

## 3. 非目标

- 不做物理删除账号（注销＝软注销/归档）；
- 语言分区不建宿主并行语言系统（沿用同键 + 重载语义）；
- 不改其他业务模块契约（仅 IAM 自服务新增与 settings 重组）。

## 4. 风险

- IAM 契约变更范围大（permission/observability/openapi/生成链），需全量门禁与既有菜单/账号页回归。
- 软注销端点防误触（两步确认 + UI 强提示）；已归档账号拒绝再次操作。
- migration 004 需要三方言 down/up 与数据库迁移回归（go test 内现有 migrate 门禁）。