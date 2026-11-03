# Foundation 质量证据

`pnpm check` 是完整门禁入口，按顺序执行 Foundation、Architecture、Dependency、Codegen freshness、Lint、Type、Vitest、Next Build、Performance、Playwright/Axe/Visual、Docs 与 Format 检查。

新增 Universal Element 至少证明 Variant/State、DOM Contract、键盘/Focus/ARIA、Dark、Compact、英文扩张与 Overlay 打开态。新增 Page Pattern 至少证明正常、空、错误、只读、禁用、处理中、部分受限、长文本与窄屏退化。Page Archetype 使用确定性 URL 独立打开，不依赖模拟 API。

当前预算不因新增页面提高：首屏 JS 400 KiB、最大 Route JS 430 KiB、CSS 48 KiB、最大 Chunk 200 KiB（均为 gzip）。阈值变化必须有独立研究和确认，不能用于掩盖回归。

## 109 当前验收

本轮代码和结果逐项见 [109 实施账本](changes/109-ui-ux-optimization/tasks.md)。
最新 Sidebar 轮次见 [专项验证](changes/109-ui-ux-optimization/evidence/sidebar-verification.md)：
10 项专项通过；全量和视觉人工确认状态以该账本为准。以下 check-final.txt 数字是
109 初始实施轮的历史检查，不代表后续 Authentication / Sidebar 轮次。
完整门禁记录为 `docs/changes/109-ui-ux-optimization/evidence/check-final.txt`。
最后代码已通过治理/lint/类型、369 项单元测试、生产构建与原产物预算。
浏览器 219 项：205 通过、14 项因视觉比较失败；其后格式/文档门独立补跑。
完整命令 exit 1，不能声明全绿；早期失败或中断日志不代替最终结果。
结果见 [109 验证记录](changes/109-ui-ux-optimization/evidence/verification.md)。
视觉阈值及快照保持原值，人工确认和真实设备验证独立列出。

## 102 历史证据（复核 + Sidebar Navigation 重构）

以对应变更执行时的实际命令输出为准：

- Workspace 分类 11 个（Universal 7 + Product Surface foundation/framework + `surfaces` 实现 + `apps/web` Host）；`tooling/foundation-contracts.json` 登记 10 个 Contract owner。
- Architecture 检查覆盖 230 个源文件（含 `surfaces/`、`generated/` 与 Host 薄入口）。
- Vitest：`surface-foundation` 34、`plugin-framework` 40、`core` 16、`form-foundation` 2、`i18n` 2、`schemas` 1、`web` 91、`surface` 40（合计约 226）。
- 静态路由 33 个（`apps/web/dist` 32 个页面 HTML + not-found），含 `/reference-resources` 四条与 `/system-tools`（icons）与 `/settings`（107 迁移后独立插件；原 preferences 路由单轨删除）。
- Playwright e2e：`reference-resources.spec.ts` 覆盖列表/创建/详情/编辑、Route Target 导航、imperative 导航、Axe WCAG AA、视觉基线与窄屏英文无溢出；`settings.spec.ts` 覆盖外观/搜索/恢复默认/语言/深链定位，`leave-confirm.spec.ts` 覆盖离开确认取消与确认（原 `preferences.spec.ts` 已随 107 单轨删除，由 settings spec 取代）。
- Performance 最新一次输出：initial ≈ 333,164 B、maxRoute ≈ 423,541 B（`/ui-elements/forms`）、CSS ≈ 46,559 B、最大 Chunk ≈ 84,658 B，均在预算内。
- 已知视觉基线漂移（HEAD 同样复现，与本仓库任务无关，未擅自更新）：`universal-motion-desktop`、`ui-elements-family-status-async`、`surface-foundation` 视觉面、`transition` 时序断言。107 迁移已删除旧 `preferences-desktop` 基线；`settings-desktop` 新基线待人工确认后生成。

## 文档体系证据

- `docs/README.md` 是前端文档唯一入口；主题 authority 见其清单。
- `pnpm docs:check` 校验：入口存在、必备 authority 文件存在、内部相对 Markdown 链接可解析、变更索引覆盖最新变更。

## 历史证据

各变更的完整最终证据是历史快照，见 [变更记录索引](changes/README.md)；数字只在对应变更当时有效，不作为当前事实。

## 116 当前验收（Vben 对标实施）

- 静态门禁：Foundation / Architecture / Dependency / 两类 Codegen freshness / Lint /
  全部 TypeScript / Vitest（core 26、surface-foundation 54、plugin-framework、web 192、
  surface 全量）通过；完整 `pnpm check` 含 Next build、性能预算、Playwright 与 docs/format。
- 代码生成：21 plugins / 60 routes；新增 `analytics`、`workspace`、`menus`、`departments`、
  `dictionaries` 与 `settings.security`。图标词汇新增 analytics/workspace/menu/department/dictionary。
- 公共能力：`ui-adapter/charts`（Area/Donut/Bar/Sparkline + 纯几何）、
  `surface-foundation/collection-tools`、DataTable 三档密度/固定列/树形行、
  `plugin-framework/navigation-admin` Port、`core/table`（normalizeColumnLayout/toCsv）。
  均已登记 foundation-contracts，并有 Showcase 与业务同源使用。
- 浏览器：新增 4 个 spec（demo-access、shell-security、table-productivity、system-management）；
  修复 5 个 spec 的硬编码旧端口；产品缺陷修复 6 项（锁屏会话、Rail 过渡几何、偏好迁移、
  菜单覆盖键、重复导航入口、缺失 i18n）。
- 视觉基线：仅复核后更新 5 张（导航项、顶栏入口、设置新分类/配置面板、Forms 状态行），
  未调整阈值或批量接受。
- 外部限制：Vben 后端 503 导致其 CRUD 数据态不可观察；本项目新模块为演示数据。
  详细证据与失败/限制见 [116 验证记录](changes/116-vben-parity-implementation/evidence/verification.md)。

### 116 最终门禁（2026-10-27）

- `pnpm check` **退出码 0**：Foundation、Architecture（843 files）、Dependency（28）、两项
  Codegen freshness、ESLint、全部 TypeScript、Vitest（web 192 / surfaces 175 /
  core+plugin-framework+surface-foundation 等）、Next build、产物预算、Playwright
  **413 项**（chromium 406 + backend-contract 7）、Prettier、Docs（22 条变更）。
- 产物预算（未调整阈值）：initial **407,293 B / 409,600**、maxRoute **431,681 B / 445,440**
  （`/login`）、CSS **48,567 B / 49,152**、最大 chunk 84,658 B。
- 浏览器测试新增：demo-access、shell-security、table-productivity、system-management；
  视觉基线按逐项复核更新 12 张（导航项/顶栏入口/设置分类/登录演示面板）。
- 原始日志：[116 完整门禁](changes/116-vben-parity-implementation/evidence/pnpm-check.log)。

### 117 页面切换动画偏好（2026-10-27）

- `pnpm check` **退出码 0**：Architecture 845 files、Dependency 28、Codegen fresh、ESLint、
  TypeScript、Vitest（web 192 / surfaces 176）、Next build、产物预算、
  Playwright **423 项**（116 的 413 + 页面切换 10）、Prettier、Docs（23 条变更）。
- 产物预算（未调整阈值）：initial **408,047 B / 409,600**、maxRoute **432,435 B / 445,440**
  （`/login`）、CSS **48,736 B / 49,152**、最大 chunk 84,704 B。
- 视觉基线仅 `settings-desktop` 更新（新增一行「页面切换动画」，1440×2265 → 1440×2381，
  0.02 像素比，逐项查看后确认）；默认页面切换动画保持不变。
- 原始日志：[117 完整门禁](changes/117-page-transition-animations/evidence/pnpm-check.log)。
