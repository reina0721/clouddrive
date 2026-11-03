# 前端文档体系设计

设计由 `R102-001` 支撑。本节描述 102 已确认范围内的文档结构、同步内容与门禁设计。

## 1. 文档入口链

```text
frontend/README.md
  └─ docs/README.md（唯一入口手册：阅读顺序 + 架构地图 + 主题 authority 清单
       + 运行验证 + 文档维护规则 + 变更记录导航）
        └─ 主题 authority（docs/*.md）
             └─ 局部 README / AGENTS（workspace 级约束，回链主题 authority）
```

- `docs/README.md` 不复制主题正文，只做导航与边界声明。
- `docs/changes/README.md` 是任务账本索引；每个变更目录保持历史证据定位。

## 2. 主题 authority 分层

| 文档                                                                         | authority 范围                                                          | 与 101 的关系                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `frontend-foundation.md`                                                     | Universal 层 workspace 职责与禁止项                                     | 补 workspace 分类说明与 101 链接    |
| `admin-foundation.md`                                                        | foundation 视觉/Pattern/Shell 能力                                      | 新增“与 Framework / Surface 的分工” |
| `admin-framework.md`（新建）                                                 | Framework 契约/Registry/Surface 边界/File Route/Codegen/Host Capability | 101 的当前 authority                |
| `foundation-extension-governance.md`                                         | 扩展顺序与生命周期门禁                                                  | 不改正文（保持）                    |
| `ui-element-system.md` / `ui-visual-calibration.md` / `motion-foundation.md` | UI/Motion 主题                                                          | 不改正文（保持）                    |
| `quality-evidence.md`                                                        | 当前质量证据 + 历史证据入口                                             | 重构：当前数字以执行输出为准        |

## 3. 同步矩阵（本任务修改）

| 文件                                         | 修改内容                                                                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                  | 分层架构图补 framework/surface；验证段补 `/reference-resources`；Foundation Contract 补 framework/surface/codegen；文档入口指向 docs/README.md |
| `AGENTS.md`                                  | 架构地图补 framework/surface 与命名规则；文档入口链；Framework 唯一 Router 声明                                                                |
| `docs/frontend-foundation.md`                | workspace 表与分层说明补 101                                                                                                                   |
| `docs/admin-foundation.md`                   | 新增与 framework/surface 分工                                                                                                                  |
| `docs/quality-evidence.md`                   | 重构为“当前证据 + 历史证据”                                                                                                                    |
| `docs/changes/README.md`                     | 索引补 100/101/102；删过期句；历史定位声明                                                                                                     |
| `surfaces/admin/AGENTS.md`（新建）           | private workspace、公开白名单、generated 不可手改、插件契约约束                                                                                |
| `packages/admin-framework/AGENTS.md`（新建） | 契约层定位、不实现 Router、/plugin 子路径、Host Capability 语义                                                                                |

## 4. docs:check 门禁

`tooling/check-docs.mjs`（Node，无新依赖）校验：

1. `docs/README.md` 存在且包含必备章节（架构地图、主题 authority、文档维护规则、变更记录导航）。
2. 必备 authority 文档存在（frontend-foundation、admin-foundation、admin-framework、
   foundation-extension-governance、ui-element-system、ui-visual-calibration、motion-foundation、quality-evidence）。
3. 当前 authority 文件（frontend/README.md、AGENTS.md、docs/README.md、docs/changes/README.md、
   主题文档）的相对 Markdown 链接可解析；历史变更记录内部冻结不扫描。
4. `docs/changes/README.md` 索引覆盖最大序号变更目录。

接入：根 `package.json` 新增 `docs:check`，并在 `pnpm check` 链 `format:check` 之后追加。

设计约束：门禁只做结构性校验，不校验文档中的数字与代码一致性，
避免“无害编辑导致门禁腐烂”；数字正确性由变更记录证据与本任务复核保证。

## 5. 验证方案

- 运行 `node tooling/check-docs.mjs`（应通过）；`pnpm docs:check` 同效。
- `pnpm lint` 与 `pnpm format:check` 覆盖新 md/mjs（无源码改动，其余门禁不受影响）。
- 抽查数字断言与当前代码一致（workspace 11 / contracts 10 / architecture 198 文件 /
  Vitest 合计约 89 / 33 静态路由 / 13 e2e spec / performance 最新输出），以实际命令输出为准。
- 全量 `pnpm check` 除已知预存在视觉漂移（`universal-motion-desktop`、
  `ui-elements-family-status-async`）与本地 pnpm 版本环境问题外应全绿；受限项如实记录。
