# 043 WebUI 契约命名单轨迁移需求

## 目标

把 042 中项目自有 `admin` 技术命名完整替换为 `webui`，使包、契约、装配、协议、认证接入和持久化名称表达同一个明确 owner，并清除旧命名和兼容轨道。

## 要求

| ID | 要求 |
| --- | --- |
| REQ-001 | 契约根包改为 `internal/webui`；类型、构造、校验和测试使用 WebUI 语义。 |
| REQ-002 | Auth/Ops 模块贡献目录统一为 `binding/webui`；Todo 仍不提供该 Binding。 |
| REQ-003 | Composition、manifest、registry、revision 和生成命令统一使用 `webui` 命名。 |
| REQ-004 | HTTP 单轨改为 `/api/v1/webui/manifest` 与 `/api/v1/webui/auth/*`，不保留 `/api/v1/admin`。 |
| REQ-005 | CLI 单轨改为 `webui generate` 与 `webui reset-password`，不保留 `admin` alias。 |
| REQ-006 | Auth 内部实现改为 `webuiauth`，相关依赖和 Module 字段使用 `WebUI` 语义；认证、授权、CSRF 和 Session 行为不变。 |
| REQ-007 | Cookie、数据库表、migration 文件、schema、checksum、前端类型、registry、消息 ID、CSS class、brand 和本地主题 key 统一替换为 `webui`。 |
| REQ-008 | 000004 migration 直接成为 WebUI auth migration，不新增兼容 migration；实施前复核 042 未推送且无外部应用证据。 |
| REQ-009 | 当前权威文档改用 WebUI 命名；042 标记为被 043 命名决策取代，但保留历史证据。 |
| REQ-010 | 完成后搜索旧名称，项目自有现行实现不得残留 `Admin/admin` 技术标识、路径、配置或生成物。 |

## 非目标

- 不新增或删除 WebUI 功能，不改变页面范围、权限 policy、Auth 模式、Session 安全参数或 Ops 数据源。
- 不提供旧路由、旧 CLI、旧 Cookie、旧表名或 Go alias 兼容层。
- 不改写 Git 历史，不 amend/rebase 042 提交，不执行 push。
- 不修改第三方固定名称、工具命令或与本项目 WebUI 无关的历史仓库内容。

## 验收标准

- Go 全量测试、WebUI lint/typecheck/build、registry clean check、migration checksum 与文档检查全部通过。
- `rg` 旧名审计只剩 042 历史标题/说明和明确白名单第三方固定文本；现行代码、wire、存储和权威文档无旧轨。
- `/api/v1/webui`、`webui generate/reset-password`、WebUI Cookie 和 `webui_*` 表是唯一入口。
- staged diff 只包含 043 单轨命名迁移，最终创建独立 Conventional Commit。
