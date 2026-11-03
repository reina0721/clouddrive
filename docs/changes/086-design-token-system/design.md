# 086 设计方案：唯一 Design Token 系统与内容视图分流

引用研究：[R086-001](research/R086-001-current-style-audit/report.md)；需求见 [requirements.md](requirements.md)。

> 实施状态：已确认并全部落地（round 2–3）。关键收敛：`styles.css` 建立 primitive→semantic→
> component 三级 token；density 由 `--density-factor` 单一推导 `--workspace-tabs-height` 等组件
> token；AppShell 根布局唯一渲染、业务路由只渲染 ContentViewport（data-page-width 有生产端）；
> fixed bars `flex:0 0 auto` 修复跨路由几何漂移；7 个模块 CSS token 化并通过 L2/L4/L5 style lint；
> 新增 mock e2e 几何稳定断言。实现细节以代码与 [tasks.md](tasks.md) 实施证据为准。

## 1. 总体结构与数据流

```text
:root (primitive tokens)
  ├─ base scale / spacing / typography / radius / border / motion / z / color palette
  └─ size primitives（--size-*, --density-factor）
        ↓ 被 semantic/component 引用
[data-color-scheme] / [data-theme-preset]（semantic 覆写：page/surface/text/accents/status）
[data-density]（component 尺寸推导：--workspace-tabs-height, --shell-header-height, --control-*）
        ↓
component tokens（--header-*, --sidebar-*, --workspace-tabs-*, --table-*, --form-*, --button-*）
        ↓
host 组件（AppShell→Sidebar/Header/WorkspaceTabs/ContentViewport）与模块页面只消费 component/semantic token
```

唯一 token 层级保证：任何几何/颜色/间距/排版调整只改 token，业务页面与公共组件不再出现
裸数值；整个后台的 Shell 在路由/density/theme 切换下由同源 token 驱动，几何稳定。

## 2. primitive tokens（styles.css `:root`）

- **base scale**：`--scale-1..8`（1/2/4/8/12/16/20/24…）作为 spacing/尺寸分母；
  现有 `--space-1..8` = `--scale-*` 的语义别名（spacing semantic），radius/border 复用 scale。
- **size primitives**：`--size-control-sm/md/lg`（32/36/40）、`--size-entity-md`（content 宽度档
  1600/1200/960/760）、`--size-shell-sidebar-expanded/collapsed`、`--size-shell-header`、
  `--size-shell-tabs-default`；`--density-factor`（default=1，compact≈0.86）用于推导组件高度。
- **typography**：`--font-scale-*`（12/13/14/16/18/24）、`--font-weight-*`、`--font-lineheight-*`、
  `--font-mono`（沿用现状，但归为 primitive）。
- **color palette（primitive）**：neutral/primary/accent/success/warning/danger/info 的
  `-base/-base-strong/-soft` 一级；semantic 层再映射（`--text/--surface/--primary…`）。
- **motion/z/radius/border** 保留现有并归类 primitive。

## 3. semantic tokens

- `--page/--surface/--surface-muted/--text/--text-secondary/--text-muted/--border/--border-strong`
- `--primary/--primary-soft/--primary-strong`（由 palette 语义映射；dark 与 preset 只覆写 palette
  primitive，不再每处重写语义名）
- `--status-*`（success/warning/danger/info 的 base/soft/strong）
- `[data-color-scheme="dark"]` 只覆写 primitive palette + 少量语义（如 shadow），
  `[data-theme-preset]` 只覆写 palette base；删除现在把 `--primary-*` 与 `--heroui-*` 双写的地方，
  改为单源 palette → 再投影给 `--heroui-*`（如需）或经由 `@theme` 让 HeroUI 引用同一 primitive。

## 4. component tokens 与推导

```css
:root {
  /* size primitives */
  --size-control-sm: 32px; --size-control-md: 36px; --size-control-lg: 40px;
  --size-shell-tabs-default: 42px;
  --density-factor: 1;
}
[data-density="compact"] { --density-factor: 0.86; }

/* component tokens：由 primitive 推导，组件内不再写死 */
:root {
  --control-height-sm: calc(var(--size-control-sm) * var(--density-factor));
  --control-height-md: calc(var(--size-control-md) * var(--density-factor));
  --control-height-lg: calc(var(--size-control-lg) * var(--density-factor));
  --workspace-tabs-height: calc(var(--size-shell-tabs-default) * var(--density-factor));
  --shell-header-height: calc(var(--size-shell-header) * var(--density-factor));
  --header-*: (空间/padding/字号由 header 组件 token 引用 primitive)
  --sidebar-*: …
  --workspace-tabs-*: （tab min/max width、rail、close、overflow 尺寸全部 token 化）
  --table-row-height-*: （derived from --size-*, 或保留三档语义并复核）
  --form-*: …
}
```

- `.workspace-tabs { height: var(--workspace-tabs-height) }`；`ShellSkeleton` 同源。
- compact/default 切换只改 `--density-factor`，删除 `[data-density] .sidebar-link/.page-viewport/...` 散点覆盖。
- `--control-*` 现有使用点（`.field-input`、`.ui-button` 等）自动获得密度缩放。

## 5. ContentViewport 与 AppShell 分流

- **AppShell（根布局唯一渲染，保持现状）**：Sidebar + Header + WorkspaceTabs + ContentViewport。
- 新组件 `ContentViewport`：唯一滚动容器，融合 `ScrollExperience(target="panel")` +
  `data-page-width` 语义（wide/detail/settings/form），统一 padding 只定义一次；
  fallback 普通路由与 mounted panel 都渲染它（panel 场景按 active 切换 hidden/inert）。
- 删除 `.workspace-panel-scroll` 的双 padding 复制，面板内容包在 ContentViewport 内。
- `data-page-width` 由 ContentViewport 依据当前 route.layout/类型写出，删除死规则并启用语义。

## 6. 清扫策略

- styles.css：逐条把 Shell/Tabs/Sidebar/公共 UI 的裸 px/hex 改为 token 引用；
  `!important` 清零（field-error 改语义 token + 优先级修正）；删除
  `[data-page-width]` 死规则（改为 ContentViewport 生产）、重复 color-preset 色板
  （改 `var(--primary)` 与 palette 单源）、双 padding。
- 模块 CSS：7 份文件逐项裁决——裸值 → token/组件 token；`:global` 裸选择器如属公共语义
  收敛到宿主 component token（ops 的 diagnostic-*、openapi 的 tree/tab 等）；
  openapi 的 `#16a34a...` 状态色改 `--status-*`；organization/settings/navigation/iam/auth 的
  间距/字号/圆角改 token 引用。
- 新增 lint 脚本守护：公共组件规则禁止 `!important`/裸 px/hex；模块 CSS 禁止覆盖宿主
  component selectors；同时保留反向 fixture 测试（沿用 style-rules 模式）。

## 7. 文件影响

| 范围 | 计划文件 |
| --- | --- |
| 平台样式 | `webui/src/styles.css`（token 分层重排 + 清扫 + 死规则删除） |
| 宿主组件 | `webui/src/components/AppShell.tsx`、新增 `webui/src/components/ContentViewport.tsx`、`webui/src/workspace/WorkspaceOutlet.tsx`、`webui/src/scroll/ScrollExperience.tsx`（如有） |
| UI 原语 | `webui/src/ui/index.tsx`（消费 component token；无结构变化） |
| 模块样式 | 7 个 `internal/module/*/binding/webui/web/*.module.css` |
| 守护脚本 | `webui/scripts/style-rules.mjs` / `lint-architecture.mjs` 扩展 + 反向 fixture |
| 测试 | Playwright 几何稳定断言（computed style 快照）、现有 Vitest/E2E 回归 |
| authority | `webui/README.md`、`docs/development/webui.md`、`docs/development/application-module-development.md`、`documentation-impact.yaml`、本变更记录与 `docs/changes/README.md` |

不计划修改后端业务 API、数据库、migration、权限键、Go 样式或第三方依赖版本。

## 8. 失败语义与风险

- ContentViewport 收敛若破坏某模块页面的固有滚动/宽度，先回到该页评估是否属模块特有
  （保留 .module.css 但只消费 token），不倒退为双 padding。
- HeroUI 组件边界（focus ring、高度）若 token 化引发回归，以“组件 token 引用同一 primitive”
  修正而非加 !important。
- 模块 `:global` 迁移量较大（ops 57 条、openapi 19 条、settings 22 条等），按模块分步进行，
  每步跑 E2E 回归；无法安全映射的保留在模块 CSS 并记录原因（研究门禁内需裁决）。
- Playwright 几何断言依赖真实浏览器环境；mock/visual 截图作为当前权威基线，
  dev 端 5 个既有失败项（基线上存在）不因本变更新增。

## 9. 验证方案

- Go：`go build ./...`、`go vet ./...`、`go test ./...`（无 Go 样式变更，跑回归）。
- WebUI：`pnpm generate:check`、`pnpm lint`（含新 style lint）、typecheck、test、build。
- Playwright：新增“路由切换 Shell 几何稳定”用例（读取 `.app-shell/.topbar/.app-sidebar/
  .workspace-tabs` 的 boundingBox，跨路由对比）；mock E2E 全量回归；三档视口 light/dark/
  compact/default 截图。
- 文档：`scripts/Verify-Docs.ps1`；authority 同步后才算完成。