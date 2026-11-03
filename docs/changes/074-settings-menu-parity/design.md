# 074 设置菜单一致性：页内导航与全局菜单 8 分区对齐 — 需求与设计

> 支撑研究：[R074-001](research/R074-001-parity-gap/report.md)

## 1. 目标

全局「设置」菜单子项与页内 SectionNav 完全一致：同名、同序、同数量（8 分区）。不再出现「全局有 Account security / 页内无」或「页内有 language… 全局无」的错位。

## 2. 设计原则（用户补充，并入本变更）

- **页面职责边界**：WebUI 功能模块（如设置中心）自己实现页面；需要账号/安全/资料等能力时**调用其模块（iam）的接口**实现，而不是把 iam 页面挂进自己的菜单。设置中心 profile/account/security 页已是此模式（调 `self/profile`、`self/archive`、`self/password`）；`iam.security` 归位 `iam.access` 即落实该原则。
- **菜单通用本质**：全局菜单（组 + 子项，manifest 驱动）与页内侧边栏（分组布局 `Route.GroupLayoutID` + SDK `SectionNav`）是平台通用能力，不绑定任一业务；settings 只是「多分区页面」范式的实例。一致性规则：全局子项与页内分区**同名同序**（同一语义）；通用范式写入 webui 开发指南供其他模块复用。

## 3. 改动

| 位置 | 改动 |
| --- | --- |
| internal/module/settings/binding/webui/binding.go | `settings.center` 子项补全 8 分区：新增 `settings.language`（Icon `languages`，Order 31）、`settings.about`（Icon `info`，Order 32）、`settings.acknowledgement`（Icon `star`，Order 33）；现有五子项不变 |
| internal/module/iam/binding/webui/binding.go | `iam.security` 的 `ParentID: settings.center` 改回 `iam.access`（页面职责归位；跨 owner ParentID 能力保留在 internal/webui + 文档） |
| internal/composition/webui_registry_test.go | 菜单边断言：settings.center 下八子项；`iam.security` parent 回 `iam.access` |
| webui/e2e/webui.spec.ts | 070 用例：菜单 fixture 更新（Settings 组 8 项、iam.security 回 iam.access）；断言「Account security」出现在身份权限组而非设置组 |
| 文档 | webui 开发指南：新增「多分区页面通用范式」（全局一组 + 页内分组布局 + 子项与分区一致）与「模块 UI 需求调用他模块接口自实现页面」原则；changelog 074 |

## 4. 验证

- Go：`go test ./internal/webui/... ./internal/composition/... ./internal/module/iam/... ./internal/module/settings/...`；`go run ./cmd/app webui generate`。
- WebUI：typecheck/lint/i18n/modules/vitest/build/generate:check。
- Playwright 20（070 断言更新：设置组 8 子项可见、Account security 回身份权限组；071/072 不变——页内仍 8 分区）。
- 截图 074-settings-menu-parity.png（侧栏两级 + 设置组 8 项）。

## 5. 边界

- 页内 SectionNav 8 分区与全局 8 子项对齐；`iam.security` 回归 iam.access；跨 owner ParentID/HostNavigation 契约能力保留供未来使用。