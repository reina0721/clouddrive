# 072 设置套件细化：8 分区重组、IAM 自服务资料/软注销、SPA 页内导航修复 — 设计方案

> 支撑研究：[R072-001](research/R072-001-backend-and-nav-gap/report.md)、[R072-002](research/R072-002-nav-fix-plan/report.md)；需求：[requirements.md](requirements.md)

## 1. IAM 后端（internal/module/iam）

### 1.1 migration 004（三方言）
`iam_accounts` 增列：`nickname TEXT NULL`、`bio TEXT NULL`、`birth_date TEXT NULL`（ISO 日期字符串）；down 语句逆向删列。同步 migration 目录清单（migrate 门禁会校验 up/down 成对与顺序）。

### 1.2 model/repo
- `model.Account` 增 `Nickname/Bio/BirthDate`；`NewAccount` 保持默认空。
- `repo.AccountRecord` 增三字段；account snapshot/mapping 同步（repository.go、snapshot.go 引用的结构）。

### 1.3 service
- `UpdateSelfProfile(ctx, expectedVersion, nickname, bio, birthDate)`：读取当前账号（会话自服务），乐观锁（Version 匹配）更新资料并 bump security revision？**不 bump**（资料非安全敏感，仅 version++）；返回更新后 identity。
- `BeginSelfArchive(ctx)` → `confirmationId`（内存/内置存储，TTL 短）；`ConfirmSelfArchive(ctx, confirmationId)`：校验 confirmationId → 复用 `ArchiveAccount` 归档自身并吊销会话。

### 1.4 handler/contract
- `PATCH /api/v1/iam/self/profile`（body: nickname/bio/birthDate/expectedVersion）→ 200 + identity；错误：version conflict（409 语义）、无效日期。
- `POST /api/v1/iam/self/archive`（body: {}）→ `{confirmationId}`；`POST /api/v1/iam/self/archive/confirm`（body: confirmationId）→ 204。
- 操作权限：新 permission keys（`iam.self.profile`、`iam.self.archive`）进 iampermission.Definitions + composition permission catalog 聚合测试更新。
- humabinding Definition（OpenAPI/observability 自动同步）。

### 1.5 前端 api（settings/iam api.ts）
- `updateSelfProfile(profile, expectedVersion)`、`beginSelfArchive()`、`confirmSelfArchive(confirmationId)`（settings api.ts 跨调用）；iam mock 增路由（host mock 或 settings mock 注记）。

## 2. SPA 页内导航修复（runtime + settings）

### 2.1 runtime navigate
- `webui/src/sdk/runtime/index.tsx`：`HostRuntime` 增 `navigate?: (path: string) => void`（可选，向后兼容）；类型导出注释。
- `App.tsx` 组装 runtime：`navigate`（react-router）。
- `SettingsNavLayout`：`useOptionalHostRuntime()` 取 navigate；SectionNav 传 `onSelect`（id → `/settings/{section}` 映射时 navigate）；href 保留但不再作为导航主路径（onSelect 存在时 preventDefault）——**整页刷新路径移除**。

### 2.2 分区与路由
- binding：8 routes（保留原四路径 profile/account/appearance/notifications，新增 security/language/about/acknowledgement；**account 语义改为用户名/注销，原改密迁 security**）；Navigation：settings.center 子项五项（profile/account/security/appearance/notifications），页内 SectionNav 全 8。
- 页面：
  - ProfilePage：资料表单（昵称/介绍/出生日期 + 保存，乐观锁 error 提示）。
  - AccountPage：用户名只读 + 「注销账号」两步确认（确认对话框内完成 Begin/Confirm，成功后跳登录/清会话）。
  - SecurityPage：071 AccountPage 的改密表单迁移。
  - AppearancePage/NotificationsPage：保持（071）。
  - LanguagePage：语言选项（zh-CN/en-US）→ 写 `community-go-webui-language` + `location.reload()`。
  - AboutPage/AcknowledgementPage：静态文案（i18n 双语：项目介绍/技术栈/仓库地址；鸣谢列表）。
- SettingsNavLayout：8 分区 items（受控 icon：user/shield/palette/bell/key?/languages/about/award——受控目录内选择：user、shield、palette、bell、key、list、activity，新增若需 `languages`?/`award`? 检查 icons.go 目录（无 languages/award）→ 用现有图标：language→list? 给 about/acknowledgement 用 info? 目录外需新增（受控双向）——新增 `info`（about）、`star`（acknowledgement）、`languages`（language）三图标（lucide Info/Star/Languages + Go 目录）。

## 3. 文件影响

| 区域 | 文件 |
| --- | --- |
| IAM | model/model.go、repo/*（account mapping）、service/service.go、binding/http/contract.go+huma.go、binding/migration/{mysql,postgres,sqlite}/000004_*.{up,down}.sql、binding/permission、composition 聚合测试 |
| runtime | webui/src/sdk/runtime/index.tsx、webui/src/App.tsx |
| settings | binding/webui/binding.go、web/SettingsNavLayout.tsx（8 分区 + onSelect navigate）、web/{Profile,Account,Security,Appearance,Notifications,Language,About,Acknowledgement}Page.tsx、web/api.ts、mock、locale en/zh、settings.module.css |
| 图标 | internal/webui/icons.go、webui/src/icon-catalog.ts（info/star/languages） |
| e2e | webui/e2e/webui.spec.ts（SPA 切换无 reload 断言、资料/注销/语言/关于/鸣谢 + 截图 072-*） |
| 文档 | webui 开发指南、IAM 自服务契约、changelog 072、webui/README |

## 4. 验证

- Go：`go test ./internal/module/iam/... ./internal/webui/... ./internal/composition/...`（乐观锁、两步注销、归档后登录拒绝、migration 三方言）；`go run ./cmd/app webui generate`。
- WebUI：typecheck/lint/lint:modules/vitest/build/generate:check；Playwright（SPA 切换断言：点击分区 URL 变化且无 document reload——用 page.waitForURL + 断言无 full navigation event / PW 检测）。
- 截图 072-settings-{profile,account,security,language,about,acknowledgement}.png。

## 5. 待确认决策

1. IAM 自服务端点形态：updateProfile（PATCH，乐观锁）+ self/archive 两步确认（推荐）；
2. 导航修复：HostRuntime.navigate + SectionNav onSelect（SPA，单轨移除整页路径）（推荐）；
3. 分区：页内全 8 分区；全局菜单 settings.center 子项五分区（推荐）；
4. language 分区沿用同键+重载（推荐）；about/acknowledgement 静态双语（推荐）；
5. 图标新增 info/star/languages 入受控目录（推荐）。