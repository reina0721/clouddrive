# 087 任务与证据

## 当前门禁

研究门禁已通过（R087-001）；用户在本轮明确确认 087 方案，随后完成了计划范围内的
源码、测试、生成物与文档实施。当前状态为**实施完成，提交本变更后闭合**；未修改 IAM API、数据库、
迁移或外部系统。

## 任务清单

| ID | 依赖 | 工作量 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `RES-087-001` | — | M | 复核 Settings/group layout/workspace/query/历史决策与运行态 | R087-001 metadata/report 可复核，事实与未知分离 | 完成 |
| `PLAN-087-001` | RES-087-001 | M | 形成 requirements/design/tasks 与索引 | REQ/DEC/文件影响/失败语义/验证齐全 | 完成 |
| `CONFIRM-087-001` | PLAN-087-001 | — | 用户确认恢复显式 workspace 资格及本任务范围 | 计划报告后的后续消息明确确认 | 完成（用户本轮确认） |
| `REPRO-087-001` | CONFIRM-087-001 | M | 建立 Accounts query → Settings 的失败用例并记录 hit target/URL/active workspace | mock/dev fixture 记录点击目标、URL、active workspace、可见 panel；未添加猜测补丁 | 完成（Playwright 审计用例） |
| `POLICY-087-001` | REPRO-087-001 | L | 恢复 Go/TS typed WorkspaceTabPolicy 与生成链，默认 disabled | catalog/manifest/registry tests 通过；未知值拒绝 | 完成（Go contract + generated manifest） |
| `ROUTER-087-001` | POLICY-087-001 | L | AppShell 只为 opt-in route 打开 workspace；普通 route 走 Outlet | 删除 formal-route 自动标签分支；分流单一 | 完成（AppShell/RouteSlot/WorkspaceOutlet） |
| `SETTINGS-087-001` | ROUTER-087-001 | M | Settings 八分区恢复共享固定 SettingsLayout 与 SPA child Outlet | 节点跨切换保持；无八标签增长；aria-current 正确 | 完成（mock/dev E2E） |
| `QUERY-087-001` | ROUTER-087-001 | M | 普通 Accounts query 与 inactive workspace 隔离 | 离开 Accounts 后无隐藏列表 panel；筛选仍正常 | 完成（mock/dev E2E） |
| `STORAGE-087-001` | POLICY-087-001 | M | 持久化/reconcile 只接纳 opt-in workspace | 旧普通 route 元数据安全丢弃；principal/allowlist 语义保留 | 完成（Vitest 9 storage tests） |
| `QA-087-001` | SETTINGS/QUERY/STORAGE | L | 单元、生成、Go、WebUI、E2E、视觉与旧符号检索 | REQ-087-001..008 全部有证据 | 完成（见下方验证记录） |
| `DOC-087-001` | QA-087-001 | M | 同步当前 authority 与 085 Rev.2 被取代结论 | 当前文档只描述显式资格单轨 | 完成（README/webui authority/tasks） |
| `COMMIT-087-001` | DOC-087-001 | S | 精确暂存并 Conventional Commit | 仅包含确认范围；验证结果写入任务记录 | 完成（本次 Conventional Commit） |

## 实施与验证证据

- `pnpm exec vitest run src/workspace src/components/shell/WorkspaceTabs.test.tsx src/app-shell.test.tsx`：35/35 通过。
- `pnpm test`：49 个测试文件、233 个测试通过；既有 React `act`/key 警告未新增失败。
- `pnpm typecheck`、`pnpm lint`、`pnpm generate:check`、`pnpm build`：通过；Lint 仅保留仓库既有未使用变量警告。
- `pnpm e2e -- --project=mock -g "087"`：2/2 通过；整套 mock E2E：10/10 通过。
- `pnpm e2e -- --project=dev -g "087 workspace policy isolates ordinary routes and keeps OpenAPI singleton"`：认证 dev fixture 1/1 通过；真实后端服务未启动。
- `go test ./...`：通过；相关 `internal/webui` 与 OpenAPI binding 测试亦通过。
- 运行态审计记录 `event.target`、`.settings-content` 祖先命中、URL、活动 workspace 和可见 panel，并作为 Playwright JSON attachment 保存；未发现“中性点击回 Accounts”的可复现命中目标，因此没有增加 CSS/事件拦截补丁。

## 剩余风险

- 本轮未启动真实后端 8080，dev E2E 的后端联调证据仍受运行环境限制；mock E2E 与契约/单测已覆盖本任务的前端行为。
- 085 Rev.2 的旧浏览器 localStorage 不主动清除；恢复时按当前 manifest 的 `restorable` allowlist 丢弃普通 route 元数据，符合本任务不迁移用户存储的约束。

## 已确认决策

- `DEC-087-001`：取消“所有正式页面自动标签”，恢复默认 disabled 的显式 workspace policy。
- `DEC-087-002`：Settings、Accounts 等普通页面走单 Router Outlet。
- `DEC-087-003`：Settings 八分区共享一个固定布局，不为每个分区创建标签。
- `DEC-087-004`：Accounts query 继续保留，但不让离开后的普通列表保持 mounted。
- `DEC-087-005`：实施先建立失败用例；无法复现任意点击时不做猜测式 CSS/事件补丁。

## 当前剩余未知

- 本轮 dev E2E 使用认证 API fixture 而非真实 8080 服务；真实后端运行态仍未验证。
- 用户报告刷新后仍恢复完整 Accounts query，与当前 storage allowlist 会剥离该 query 的代码
  事实不一致；实施时需记录实际构建 revision、history 与 workspace snapshot 时序。
- 若用户要求继续保留所有普通页面标签，当前推荐方案不成立，必须返回研究阶段设计
  panel-local Router/history，而不能在本计划内临时扩大范围。
