# 043 WebUI 契约命名单轨迁移设计

## 命名映射

| 当前名称 | 目标名称 |
| --- | --- |
| `internal/admin` | `internal/webui` |
| `binding/admin` | `binding/webui` |
| `AdminBinding/AdminCatalog/AdminManifest` | `WebUIBinding/WebUICatalog/WebUIManifest`，包内按现有简洁类型名落地 |
| `applicationAdminCatalog` | `applicationWebUICatalog` |
| `GenerateAdminRegistry` / `admin-registry.ts` | `GenerateWebUIRegistry` / `webui-registry.ts` |
| `adminservice` | `webuiauth` |
| `AdminAccess/Admin/AdminHTTP` | `WebUIAccess/WebUIAuth/WebUIHTTP` |
| `/api/v1/admin/*` | `/api/v1/webui/*` |
| `admin generate/reset-password` | `webui generate/reset-password` |
| `__Host-community-go_admin_session` | `__Host-community-go_webui_session` |
| `admin_users/admin_sessions` | `webui_users/webui_sessions` |
| `admin-registry`, `AdminSession`, `admin.*`, `admin-*` | 对应 `webui` 技术名 |

## 所有权

`internal/webui` 只定义页面扩展和运行 manifest 契约，不拥有认证。Auth 模块的 `webuiauth` 仍拥有本地用户、密码、Session、CSRF 和 HTTP Handler；Composition 只负责选择、聚合和挂载。Ops 仍只贡献 WebUI 页面并消费现有 management operation。

## 迁移顺序

```text
复核远端与工作树
  -> Contract/package 与 module binding 路径
  -> Auth webuiauth 与 migration/schema
  -> Composition、HTTP 与 CLI wire
  -> WebUI registry、类型、消息和样式
  -> 权威文档与 042 superseded 标记
  -> 生成、测试、旧名审计、提交
```

文件移动使用 Git 可识别的单轨替换；不复制旧目录，不增加 alias。若实施时发现 042 已推送、000004 已被外部环境应用，或存在外部消费者，必须返回研究阶段设计正式迁移，而不是静默保留兼容层。

## 验证

- `go test ./...`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm generate:check`
- migration checksum/兼容性测试
- `git diff --check`
- `rg` 审计旧包、旧路径、旧 CLI、旧 Cookie、旧表与旧生成物

E2E 与视觉结果不因纯命名迁移而改变；若 wire 路径变更导致页面闭环无法静态证明，应补充定向 HTTP/CLI 集成测试，不用未执行声明代替验证。
