# 前端文档体系需求

## 客户目标

让 `frontend/` 的文档成为可用的“当前体系”，而不是零散主题文件 + 历史变更账本：
进入者（人工与 Agent）从统一入口开始，能在有限的几个当前 authority 中找到某个主题
“现在应该如何做”，并能区分“当前事实”与“历史证据”。

## 使用场景与可验收行为

### 场景 A：新成员 / Agent 进入前端

- 从 `frontend/README.md` 或前端 `AGENTS.md` 都能到达 `docs/README.md`。
- `docs/README.md` 说明阅读顺序、当前架构地图、主题 authority 清单与文档维护规则。
- 验收：`docs/README.md` 存在且包含架构地图、主题 authority、文档维护规则、变更记录导航章节；
  相关链接均可解析。

### 场景 B：查询某个主题的当前做法

- “Admin Surface 新增一个插件页面怎么做”能由 `docs/admin-framework.md`（或 `surfaces/admin/AGENTS.md`）
  回答；“UI Element 如何分类”由 `ui-element-system.md` 回答。
- 每个主题只有唯一 authority，不含相互矛盾的过期段落。
- 验收：必备 authority 文件存在；架构图在 README、AGENTS、docs 层一致（含 framework/surface）。

### 场景 C：复核“当前质量证据”

- `quality-evidence.md` 给出当前门禁数字与预算，并明确历史证据指向变更记录。
- 验收：文档不再把 098 历史快照冒充当前；数字以任务执行时实际输出为准。

### 场景 D：文档被机器检查

- `pnpm docs:check` 可执行并纳入 `pnpm check`：入口存在、必备 authority 存在、
  当前 authority 相对链接可解析、变更索引覆盖最新变更。
- 验收：`docs:check` 通过；故意删入口/断链/漏索引能使其失败。

## 范围

- 本阶段只允许新增/修改：`docs/**`、`README.md`、`AGENTS.md`、
  `surfaces/admin/AGENTS.md`、`packages/admin-framework/AGENTS.md`、
  `tooling/check-docs.mjs`、根 `package.json`（仅 `docs:check` script 与 check 链）。
- 不修改任何功能代码、组件、页面、路由、i18n 文案或 generated 产物。
- 不把 101 延期内容（完整 Shell/既有页面/Legacy Navigation/Shell CSS/Host 路由迁移）
  描述为已实现。

## 非目标

- 不重写 `ui-element-system.md`、`motion-foundation.md`、`ui-visual-calibration.md` 正文。
- 不修改历史变更记录内部内容（冻结证据）。
- 不把根仓库 doc-guard 与前端 doc 门禁耦合。
