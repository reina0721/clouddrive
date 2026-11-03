# R102-001 Frontend 文档体系现状审计

## 1. 研究问题

`frontend/docs/` 是否构成一个可用的“当前文档体系”——即是否有统一入口、主题 authority
是否与 101（Admin Framework / Surface File Routes）之后的代码一致、变更索引是否完整、
文档链路是否机器可查。研究目标是回答“完善文档体系”需要改什么，而不是重写任何主题内容。

## 2. 已核实事实

- `frontend/docs/` 没有 `docs/README.md`。前端 `AGENTS.md` 第 4.3 节规定
  “文档入口固定为 `AGENTS.md -> README.md -> docs/README.md -> 主题文档`”，
  但该入口文件不存在，链路从第一步就断。
- `frontend/docs/` 主题文件 7 个：`ui-element-system.md`(20KB)、`ui-visual-calibration.md`(14KB)、
  `motion-foundation.md`(8KB) 内容较完整；`frontend-foundation.md`、`admin-foundation.md`、
  `foundation-extension-governance.md`、`quality-evidence.md` 短小。
- 前端 `README.md` 的架构与 Foundation Contract 段落、frontend `AGENTS.md` 的架构地图、
  `docs/frontend-foundation.md`、`docs/admin-foundation.md`、`docs/quality-evidence.md`
  均早于 101 提交，完全没有提及 `packages/admin-framework`、`surfaces/admin`、
  `tooling/admin-codegen`、`pnpm codegen:admin` 或 `/reference-resources`。
- `docs/quality-evidence.md` 名义上是“Foundation 质量证据”当前文档，正文却只是
  “098 最终证据”快照（9 workspaces、8 Contract owners、135 源文件、29 Vitest、41 Playwright）。
  现状是 11 workspaces、10 Contract owners、architecture 覆盖 198 源文件、
  Vitest 汇总约 89（framework 16 + surface 7 + admin-web 46 + admin-foundation 11 +
  core 4 + form-foundation 2 + i18n 2 + schemas 1）、33 个静态路由（dist 32 + 404）、
  13 个 e2e spec 文件、`reference-resources.spec.ts` 已存在。
- `docs/changes/README.md` 只索引到 099，100（top-progress）与 101（admin-surface-file-routes）
  目录存在但未列入；末句“下一个任务序号为 100”已过期（当前最大序号为 101）。
- `surfaces/admin/` 与 `packages/admin-framework/` 没有局部 AGENTS/约束文档；
  其余 `packages/*`、`apps/*` 均有局部 AGENTS。
- 仓库根 `docs/documentation.yaml` + `scripts/Verify-Docs.ps1` 只治理根仓库文档；
  `frontend/` 在 required_documents 中只有 `frontend/README.md`，前端内部文档链路没有机器检查。
- 现有 Markdown 内部相对链接零断链（已做全量扫描），说明“改文档”不会引入既有断链回归。
- UI authority 页面数量：`/ui-elements` 下 9 个 Family 目录；README 写的“46 个 Universal UI Element”
  与 runtime 字符串（visual.spec 断言“公开 Element 46 / 46”）一致，未发现该数字过期。

## 3. 推断

- “文档体系”应由**入口手册 + 分层主题 authority + 局部约束 + 变更索引**组成；
  `docs/changes/**` 只保留历史证据与导航，不能充当体系主体（用户明确要求）。
- 101 引入的 Framework/Surface/Codegen 是新架构事实，必须进入当前 authority
  （新 `docs/admin-framework.md`）并同步 README/AGENTS 架构图；
  仅靠变更记录不构成“当前说明”。
- `quality-evidence.md` 需要从“098 快照”重构为“当前质量证据”，把历史证据移到变更记录定位。
- 文档门禁应是**结构性**（入口存在、链接可解析、索引覆盖、必备文件存在），
  而不是脆弱地断言“文档中某个数字等于代码中的某个数字”，避免门禁因无害编辑腐烂。

## 4. 对 102 的强制影响

1. 新建 `docs/README.md` 入口手册与 `docs/admin-framework.md` authority。
2. 同步 `README.md`、`AGENTS.md`、`frontend-foundation.md`、`admin-foundation.md`、
   `quality-evidence.md` 到 101 之后事实；数字以执行时实际输出为准。
3. 修复 `docs/changes/README.md` 索引（追加 100/101、删除过期句、明确历史定位）。
4. 新增 `surfaces/admin/AGENTS.md`、`packages/admin-framework/AGENTS.md` 局部约束。
5. 新增 `tooling/check-docs.mjs` 结构门禁并接入 `pnpm check`。

## 5. 局限与刷新

本审计不判断主题文档内容质量、不重写 ui-element-system/motion-foundation/ui-visual-calibration
正文；数字断言在 102 完成后若代码再变，应由后续变更按同一“当前证据”原则更新，
不把本记录的数字当作永久事实。
