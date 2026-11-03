# 验证记录（116）

验证对象：本轮六类能力（VP-01…VP-06）与横切公共能力。所有结论来自实际执行的命令与浏览器
运行，不以"文件存在"或"编译通过"代替产品验收。

## 环境

- 开发/门禁主环境：Windows 宿主 + 仓库 `C:\rin\coder\rin721\console-web`（Node 24 / pnpm 10.22.0）。
- WSL 环境修复（本轮新增）：Node 22.23.4（Linux）安装到 `~/.local/toolchain`；
  `pnpm-workspace.yaml` 增加 `supportedArchitectures.os = [current, linux, win32]`，
  使 rolldown/lightningcss/next-swc 的 Linux 与 Windows 原生绑定同时安装。
  修复前 Vitest 在 WSL 启动即报 `Cannot find native binding`；修复后
  `pnpm test`（WSL）完整通过：先后 190 → 192 个 web 测试 + 全部 workspace 测试，退出码 0。
- 说明：完整 `pnpm check`（含 Next build / Playwright / 性能预算）在 Windows 运行，
  因为浏览器与原生构建产物按宿主平台安装；WSL 已单独验证 unit/gate 子集。
- 开发服务器：`apps/web/.env` 的 `WEB_PORT=3000`。WSL 旧 dev server 在 drvfs 上无法监听
  Windows 侧新建文件（曾导致 `Can't resolve './demo-access'`），已清空 `.next/dev` 并改用
  Windows dev server；e2e 的 `webServer` 复用同一配置。

## 静态门禁

| 检查                                                                                 | 结果 | 依据                                                                                                   |
| ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------ |
| `pnpm foundation:check`                                                              | 通过 | 14 fixtures + 13 workspaces / 12 contract owners + Tailwind 源覆盖                                     |
| `pnpm architecture:check`                                                            | 通过 | 20 fixtures + 841 源文件边界检查                                                                       |
| `pnpm dependency:check`                                                              | 通过 | 27 个受控依赖                                                                                          |
| `pnpm codegen:design:check`                                                          | 通过 | tokens.css / motion.css fresh                                                                          |
| `pnpm codegen:plugins`                                                               | 通过 | 21 plugins / 60 routes（含 analytics、workspace、menus、departments、dictionaries、settings.security） |
| `pnpm lint`                                                                          | 通过 | `--max-warnings 0`                                                                                     |
| `pnpm --filter @clouddrive/{core,surface,plugin-framework,ui-adapter,web} typecheck` | 通过 | 见完整 check 日志                                                                                      |
| `pnpm format:check` / `pnpm docs:check`                                              | 通过 | 入口 + 8 authorities，22 条变更索引                                                                    |

完整 `pnpm check` 的最终退出码与日志：`evidence/pnpm-check.log`（由本轮最终执行生成）。

## 浏览器验收（Playwright / Chromium）

新增与重写的用例：

- `apps/web/e2e/demo-access.spec.ts`：三身份真实登录、操作员/受限成员权限差异、演示数据重置
  （目录/探针 key 清除、`clouddrive.shell` 保留）。
- `apps/web/e2e/shell-security.spec.ts`：快捷偏好抽屉切换水印与顶部布局并刷新保持；
  锁屏遮挡（`main[inert]`）、错误密码保持锁定且**不退出会话**、正确密码解锁。
- `apps/web/e2e/table-productivity.spec.ts`（VP-04）：列设置隐藏/重置/持久化、密度计算值、
  CSV 页面与选中导出、树形行 aria-expanded 与行数、Showcase 同源。
- `apps/web/e2e/system-management.spec.ts`：菜单标题覆盖与隐藏**真实作用于侧栏**并跨刷新保持；
  部门新增与"存在下级不可删除"；操作员无 `settings.update` 时只读并说明原因。

既有套件修复与复核：

- 5 个 spec 硬编码旧端口 4173/4174，配置迁移后整片失败；新增 `apps/web/e2e/base-url.ts`
  统一从 `WEB_PORT` 派生（含 backend `+1`），并修复 `account-menu`、`authentication`、
  `authentication-backend`、`collect-noncritical`、`settings-*`。
- 根因级修复（产品缺陷，不是放宽断言）：
  1. 锁屏原先复用 `auth.login`，输错密码会按认证语义清空会话 → 新增
     `apps/web/src/auth/unlock.ts` 只读复核（Mock: 目录摘要/fixture 常量；Backend: 明确
     `unsupported` 并只提供重新登录）。
  2. 紧凑 Rail 在宽度过渡中内容随轨道居中漂移（48px 图标中心 39.5/132px）→
     `.surface-shell-compact-rail` 固定 80px 内宽。侧栏分隔线恢复 border，避免正文宽度偏移。
  3. 偏好版本 1→2 升级丢弃 `rememberedSidebarCollapsed`，导致"记住折叠"失效 → migrate 保留。
  4. 菜单覆盖键在 Plugin 侧用 routeId、Host 侧用 navigationId → 统一以 navigationId
     （routeId 回退）为键，覆盖才真正生效。
  5. 工作区插件与首页同名"工作台"造成重复导航入口 → 独立 `overview` 分组 +
     "个人工作区"，分析/工作区归入概览。
  6. `ui-elements` 缺失 `Code` 状态文案导致裸 i18n key 出现在 Showcase → 补齐。
- 视觉基线：仅在逐项截图复核后更新 5 张，均为可解释的产品变化（新增导航项、顶栏快捷偏好/
  锁屏入口、设置第九分类与配置输出面板、Forms 状态标签行）。阈值未调整。
- 既有用例的**期望更新**（产品语义变化，非放宽）：设置字段数 9/12/4（新增色弱/灰阶/布局/安全），
  滚动揭示末行改为灰阶字段（设置页脚变高）。

结果：`pnpm test:browser` 两 project（chromium + backend-contract）在本轮最终执行中全绿，
数量与耗时以 `pnpm-check.log` 为准。

## 可访问性 / 响应式 / 主题

- 新页面与控件复用 HeroUI/React Aria（Switch、Radio、Select、Dialog、Menu），未重建
  Selection/Focus/Overlay。
- 图表：`role="img"` + `aria-label` + 隐藏数据表 + roving tabindex 方向键；无动画。
- 锁屏：`role="dialog" aria-modal`，`inert` 背景，焦点移入密码框，错误用 `role="alert"`。
- 水印：`aria-hidden`、`pointer-events: none`，不进入可访问树。
- 双语：新增文案全部在 Plugin 自有 namespace（`analytics.*`、`workspace.*`、`menus.*`、
  `departments.*`、`dictionaries.*`、`settings.*`）与 Host `shell.*`；中英文 key 对称。
- 暗色/窄屏：`shell-security`、`settings-product-review`、`visual.spec` 已覆盖；本轮新增
  页面在 1440/1024/390 截图复核（证据目录 `evidence/`）。

## 未验证 / 外部限制

- Vben 演示站：HTTP/2 资源 503（`--disable-http2` 可解），业务接口 503 → 其 CRUD 数据态
  未观察，对标只基于结构/字段/空错态。
- 真实后端联调：认证已有 backend adapter 与契约测试；菜单/部门/字典/分析/工作台均为演示数据
  （页面明确标注），未声称生产指标或真实服务联调。
- 未实现项与原因见 [需求明确不做](../requirements/README.md#明确不做有依据不是缩减范围)。

## 产物预算（性能门禁）

首轮 `pnpm check` 在 `performance:check` 失败：initial 525,476 B / maxRoute 590,082 B /
CSS 50,176 B（预算 400 / 435 / 48 KiB）。按"修复根因、不放宽阈值"处理：

1. 生成器 Host 静态 page 改为 client `next/dynamic` 外壳（动态路由保持 SSR 枚举）——
   页面依赖不再提升进每个 Route 的公共 chunk。
2. `ui-adapter` 改为按组件导入 HeroUI 样式（base/theme/utilities/variants + 实际使用组件），
   并补回 `calendar-year-picker`/`scroll-shadow` 等 DatePicker 依赖（首轮遗漏由
   `overlays.spec.ts` 视觉基线发现）。
3. 顺手把握手层的 `QuickPreferencesDrawer`/`LockScreen` 改为 `next/dynamic`。

最终：initial **405,759 B**（上限 409,600）、maxRoute **430,094 B** `/login`（上限
445,440）、CSS **48,567 B**（上限 49,152）。预算未调整，视觉差异仅来自实际产品变化。

注意：`packages/ui-adapter/src/styles.css` 的组件 CSS 清单是维护项，新增 HeroUI
primitive 时必须补充对应组件样式导入；遗漏通常表现为视觉基线差异而非类型错误。

### 最终复测（以 `evidence/pnpm-check.log` 为准）

首轮修复后仍有两个回归由全量浏览器验收发现并修复：

1. **滚动偏好不生效**：滚动重置只挂在 Link 点击处，`next/dynamic` 页面提交后不再触发。
   已把偏好判定提升到 `RouteTransition`（Route 层），命令面板/程序化导航同样生效；
   `anchor-focus` 增加 50ms 轮询兜底（Suspense 子树替换可能不产生 childList 变更）。
2. **对比度不足**：DataTable 表头 12px 粗体 `text-ink-muted` 在 `surface-muted` 上
   对比度 4.24（AA 要求 4.5），改为 `text-ink`；Axe 全量扫描恢复通过。
3. **HeroUI 动画工具类**：按组件导入样式后仍需 `tw-animate-css`（`@apply fade-in-0`），
   必须在 Host 入口紧跟 `tailwindcss` 导入；已写入 `apps/web` 依赖与
   `tooling/dependency-policy.json`（28 个受治理依赖）。
4. 认证页视觉基线更新 2 张（登录页新增演示身份面板与重置入口，属本轮产品变化）；
   其余基线未动，阈值未调整。

最终产物：initial **406,695 B**（≤409,600）、maxRoute **431,115 B** `/login`
（≤445,440）、CSS **48,567 B**（≤49,152）；预算未调整。

### 收口（2026-10-27，最终提交）

上文的 405,759 / 430,094 与 406,695 / 431,115 都是迭代过程数字；最终以
[`pnpm-check.log`](pnpm-check.log)（413 项浏览器、退出码 0）为准：

- initial **407,293 B**（≤409,600）、maxRoute **431,681 B** `/login`（≤445,440）、
  CSS **48,567 B**（≤49,152），预算未调整。
- 新增 `analytics-workspace.spec.ts`（3 项）后浏览器总数 412；六类场景另有定向复测
  **109 项**（[`parity-retest.log`](parity-retest.log)），逐项结论见
  [最终逐项复测矩阵](../research/final-parity-matrix.md)。
- 仓库内测试生成的意外证据文件已清理：设置安全页截图归入本目录
  `evidence/screenshots/`，109 历史证据目录恢复。

- 图表 Showcase：`/ui-elements/data#charts` 与 Analytics 同源，`data-display.spec.ts` 覆盖 aria/方向键/Axe。

### 图表 Showcase 与溢出修复（同日补入）

- 公共 `ui-adapter/charts` 原先只有 Analytics 一个消费者，缺少 Showcase；已在
  `/ui-elements/data#charts` 增加 Area/Donut/Bar/Sparkline 四图预览（Theme / Responsive /
  Keyboard / Accessible summary 四状态），与 `data-display.spec.ts` 同源断言。
- 该 Showcase 暴露了图表隐藏数据表的真实缺陷：`<table class="sr-only">` 在 320px +
  English large text 下仍参与文档滚动宽度（381px 溢出）。修复为把表格包进
  `div.sr-only`（overflow 裁剪生效），`ui-ux-109` 三个密度用例恢复通过。
- `settings-product-review.spec.ts` 的证据输出改到 `testInfo.outputDir`，不再向
  `docs/changes/109` 写入新文件；历史证据目录保持静态。
