# R001 WebUI 契约命名边界研究

## 1. 研究问题与方法

本研究从 `HEAD c08f12d`、Git 状态、042 需求/设计/任务、Go 定义与 Composition、Auth Session、CLI、migration、WebUI 源码和权威主题文档追踪 `admin` 的定义、装配点、wire value 与真实 owner。研究只判断命名和迁移边界，不新增功能或改变认证授权语义。

## 2. 当前事实

- 当前工作树在研究前干净，`main` 比 `origin/main` 领先一个尚未推送的 042 实施提交。
- `internal/admin` 实际拥有的是模块 WebUI 页面 Binding、Catalog、manifest 和 revision 契约，不是“管理员”领域模型。
- Auth 的 `adminservice` 实际拥有 WebUI 本地用户、浏览器 Session、CSRF 和登录 HTTP；角色词与接入媒介混在同一技术名中。
- `binding/admin`、`applicationAdminCatalog`、`GenerateAdminRegistry`、`/api/v1/admin`、`admin generate`、`admin reset-password`、`admin_users`、`admin_sessions`、Cookie、前端类型、消息 ID、CSS class 和文档形成同一条现行命名链。
- 普通业务 API、Auth operation policy 和 Ops management 数据源并不依赖“Admin”角色语义；替换名称无需改变权限模型或业务能力。
- 042 的技术命名已进入一个本地提交，但尚未进入 `origin/main`。当前没有证据表明存在已发布的外部消费者或已执行的 000004 生产数据库。

## 3. 事实与推断

| 类别 | 结论 |
| --- | --- |
| 事实 | 宿主目录已经叫 `webui/`，模块贡献的是该宿主可装配的页面契约。 |
| 事实 | `admin` 同时表示宿主、契约、用户、Session、路由与 CLI，无法从名称判断 owner。 |
| 推断 | 契约根包、Binding 和 Composition 应以 `webui` 命名；这是最贴近真实边界的稳定名。 |
| 推断 | Auth 内部包应使用 `webuiauth`，明确其仍由 Auth 模块拥有，而非建立顶层认证模块。 |
| 推断 | HTTP、CLI、Cookie、表名和前端公开标识也必须同步替换，否则仍保留两套语义。 |
| 推断 | 由于 042 未推送，可直接重命名 000004 文件、SQL 表和 checksum；不增加 000005 兼容迁移。 |

## 4. 单轨替换范围

- Go Contract：`internal/admin` -> `internal/webui`，公开类型使用 `WebUI` 前缀或在该包内使用简洁语义名。
- 模块 Binding：`binding/admin` -> `binding/webui`，源码目录仍在模块 owner 内。
- Composition/codegen：所有 `Admin*`、`admin*` helper 与文件名替换为 `WebUI*`、`webui*`。
- Wire：`/api/v1/webui/manifest`、`/api/v1/webui/auth/*`、`webui generate`、`webui reset-password`。
- Auth：`adminservice` -> `webuiauth`，`AdminAccess/Admin/AdminHTTP` -> `WebUIAccess/WebUIAuth/WebUIHTTP`。
- 持久化：`admin_users/admin_sessions` 与 000004 文件名、schema/checksum 替换为 `webui_users/webui_sessions`。
- 浏览器：package、registry、类型、消息 ID、brand、storage key、Cookie 和 CSS class 统一使用 `webui`。
- 文档：当前 authority 改为 WebUI；042 只保留历史证据和 superseded 指向。

不触碰 MySQL 工具名 `mysqladmin`、第三方资料原文或与本项目 WebUI 契约无关的其他仓库历史记录。

## 5. 风险与验证

- 路径和生成物漏改会造成编译失败或 revision 不一致；需搜索旧符号并运行生成 clean check。
- Cookie 与表名替换会使中间版本 Session/数据库不兼容；当前未推送事实允许直接替换，但实施前必须再次确认 Git/远端状态。
- 042 文档不能继续充当当前命名 authority；应只保留历史上下文并链接 043。
- 完成后必须验证 `rg` 不再命中项目自有 `Admin/admin` 技术标识，只允许明确列入白名单的历史标题或第三方固定文本。

## 6. 研究门禁

当前定义、调用方、wire value、持久化与文档影响面已有可复核证据；用户已明确选择 `webui` 契约命名。剩余未知不妨碍形成迁移计划，研究门禁通过。由于公共路径、CLI、Cookie 和表名会改变，非文档实施必须等待本计划报告后的再次确认。
