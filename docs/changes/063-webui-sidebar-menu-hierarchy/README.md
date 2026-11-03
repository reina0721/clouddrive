# 063 当前业务模块侧边栏菜单层级分类

## 状态

**已确认，实施完成**（2026-08-24 用户确认决策 1–5 推荐项；PLAN/BIND/I18N/MOCK/GEN/TEST/DOC/VER 全部完成，证据见 [tasks.md](tasks.md)）。

## 结果

在 webui 契约（各业务模块 `binding/webui` 静态声明）内完成了当前业务模块的侧边栏菜单层级分类，未修改任何 webui 代码、契约类型或生成器源码：

- **IAM**：新增顶级组父节点 `iam.access`（身份与权限管理，落地页 `iam.accounts`），`iam.security/accounts/roles/permissions` 归入其下（Order 30–70）；
- **Organization**：新增顶级组父节点 `organization.directory`（组织管理，落地页 `organization.departments`），`organization.departments/positions/assignments` 归入其下（Order 80–110）；
- **Ops**：保持两级现状（`ops.dashboard → ops.capabilities`，Order 10/20）；
- **Navigation**：`navigation.menus` 保持平铺根级（Order 120）。
- 同步：iam/organization locale 增补组标题（en-US/zh-CN）；navigation 模块菜单管理页 mock 行同步新声明；重新生成 `webui/src/generated/webui-registry.ts`；契约/组合测试增加 `TestApplicationWebUICatalogMenuHierarchy`；`docs/development/webui.md` 增补「菜单层级分类」节。

## 验证摘要

- Go：`go test ./...` 全绿（含新增组合测试）、`go vet ./internal/webui/... ./internal/composition/... ./internal/module/navigation/...` 通过；
- WebUI：`generate:check` 通过、Vitest 79 用例通过、模块/架构/i18n lint 通过、ESLint 0 error（1 个既有 warning 于 `webui/src/mock/router.test.ts`）、typecheck 通过；
- Playwright：11 用例通过（dev 10 + mock 1）；本机无容器 runtime 验收，保持既有验证边界。

## 范围

见 [范围说明（计划版）](README.md)（实施后已按上述结果更新）；**未修改 webui 代码**——`webui/src/**` 手写源码、`internal/webui/contract.go` 契约类型、生成器源码均未改动；`webui/src/generated/webui-registry.ts` 仅由官方生成器重新生成。

## 明确不做

与计划一致：不新增路由/页面/操作权限；不做跨模块父节点；不实现运行时动态菜单；不改契约核心；不引入第三方依赖；不实施容器 runtime / 远端 CI 浏览器验收。

## 阅读顺序

1. [研究档案](research/README.md)：R063-001（契约现状、宿主渲染能力、当前声明、mock/生成物影响）
2. [需求](requirements.md)：REQ-063-001..010、验收与边界
3. [设计](design.md)：方案对比、改动清单、失败语义、已确认决策 1–5
4. [任务清单](tasks.md)：全部任务完成状态与验证矩阵