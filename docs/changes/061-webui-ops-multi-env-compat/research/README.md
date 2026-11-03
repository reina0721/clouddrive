# 061 研究档案

## 研究范围

本变更回答：为什么默认启动（模式 B：Go 服务托管 WebUI）下，`运行状态`（Ops Dashboard/Capabilities 页）请求 `/management/*` 一直得到 4xx；两种模式的 management 数据通路分别是什么；用户要求“整个 WebUI 骨架与全部数据实现 mock 且显式声明（默认 server-hosted、i18n 双语）”后，全 WebUI mock 的归属、生成与传输层方案是什么。范围只覆盖 Ops WebUI 数据层、业务 Router 的 management 数据通路与 WebUI mock 数据层，不研究公开 API 新增契约、CORS/Session 语义或容器验收。

## 检索方式

- 按 `docs/changes/README.md` 顺序确认下一个变更序号为 `061`。
- 检索既有研究元数据：`docs/research/**/metadata.yaml` 与 `docs/changes/060-webui-hosting-modes/research/**`，无与“management 数据通路 / Ops 页面数据源”直接命中的可复用记录；`060` 的 R001 只记录“webui/src 不调用 /management”（宿主源码视角），未覆盖 `internal/module/ops/binding/webui/web` 模块页面。
- 代码证据：`internal/module/ops/binding/webui/web/api.ts`、`internal/module/ops/binding/http/handler.go`、`internal/module/ops/module.go`、`internal/composition/{service,generation}.go`、`internal/webuihost/spa.go`、`webui/vite.config.ts`、`webui/.env.example`、`pkg/httpx/router.go`，以及 `060` 的实施证据（`tasks.md` E2E-060-001 断言 `managementStatus=404`）。

## 记录索引

| ID | 标题 | 状态 |
| --- | --- | --- |
| [R061-001](R061-001-ops-management-reachability/report.md) | Ops 页面 management 数据通路与 4xx 根因（含 2026-08-22 修订补充：显式环境声明、默认 server-hosted） | active |
| [R061-002](R061-002-whole-webui-mock-design/report.md) | 整个 WebUI（骨架与全部数据）mock 实现与显式声明设计 | active |