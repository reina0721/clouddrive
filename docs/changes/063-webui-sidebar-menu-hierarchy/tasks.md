# 063 任务清单：当前业务模块侧边栏菜单层级分类

## 状态

研究门禁已通过（R063-001，2026-08-24 验证）；用户已确认决策 1–5 推荐项；**实施完成**。以下为任务执行证据。

## 任务

| ID | 工作量 | 依赖 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `PLAN-063-001` | M | R063-001 | 形成需求、设计、任务与文档影响计划并提交确认 | requirements/design/tasks/README/documentation-impact 齐全；用户确认 | 完成（2026-08-24 用户确认） |
| `BIND-063-001` | M | PLAN | IAM binding：新增父 `iam.access`（落地页 `iam.accounts`、Order 30），`iam.security/accounts/roles/permissions` 设 ParentID 与 Order 40–70 | `validateBindings`/locale 覆盖通过；顺序父先子后 | 完成 |
| `BIND-063-002` | M | PLAN | Organization binding：新增父 `organization.directory`（落地页 `organization.departments`、Order 80），三个子项 ParentID 与 Order 90–110 | 契约校验通过；i18n 覆盖 | 完成 |
| `BIND-063-003` | S | PLAN | navigation 保持平铺并调整 `navigation.menus` Order 至 120 | 契约校验通过；mock 同步 | 完成 |
| `I18N-063-001` | S | BIND | iam/organization locale 增补组标题 `webui.iam.access.title`、`webui.organization.directory.title`（en-US/zh-CN） | locale 覆盖校验通过；lint:i18n 无告警 | 完成 |
| `MOCK-063-001` | S | BIND | 同步 `internal/module/navigation/binding/webui/web/mock.ts` 菜单行（新增父、修正 defaultParentId/order） | mock 与管理页一致；Vitest 通过 | 完成 |
| `GEN-063-001` | S | BIND/I18N/MOCK | 重新生成 `webui/src/generated/webui-registry.ts` | `generate:check` 通过；mock manifest menu 含新父节点与 parentId | 完成 |
| `TEST-063-001` | M | BIND | 组合测试新增 `TestApplicationWebUICatalogMenuHierarchy`：父/子归属、父序先子序、全套菜单结构断言 | Go 测试全绿 | 完成 |
| `DOC-063-001` | M | BIND | `docs/development/webui.md` 增补「菜单层级分类」节；变更记录与 `documentation-impact.yaml`；`docs/changes/README.md` 063 行 | Docs 校验通过；authority 与实现一致 | 完成 |
| `VER-063-001` | M | 全部 | 全量验证：Go 测试/vet、WebUI generate:check/lint/typecheck/test、Playwright e2e、diff 复核 | 全部通过；受限项如实标注 | 完成 |

## 验证矩阵（实测结果）

| 门禁 | 命令/入口 | 结果 |
| --- | --- | --- |
| Go 单元 | `go test ./...` | 全绿（含 `TestApplicationWebUICatalogMenuHierarchy`） |
| Go 静态 | `go vet ./internal/webui/... ./internal/composition/... ./internal/module/navigation/...` | 通过 |
| WebUI 生成 | `corepack pnpm generate:check` | 通过（registry 已重新生成） |
| WebUI 测试 | `corepack pnpm exec vitest run` + `node --test scripts/project-layout.test.mjs` | 79 用例通过 |
| WebUI 静态 | `eslint .`、`lint-modules`、`lint-architecture`、`lint-i18n-contract`、`tsc --noEmit` | 全部通过；ESLint 仅 1 个既有 warning（`webui/src/mock/router.test.ts`，非本次变更） |
| E2E | `corepack pnpm exec playwright test --workers=1` | 11 用例通过（dev 10 + mock 1） |
| 文档 | `docs/development/webui.md` 更新；变更记录齐全 | 已同步 |

## 触发与记录

- 本变更已获用户确认（2026-08-24）；实施过程中未发现需要退回研究的新事实。
- 未执行项：容器 runtime / 远端 CI 浏览器验收（既有验证边界，未在本次范围内）。