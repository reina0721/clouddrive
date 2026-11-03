# 验证记录

## 局部验证（2026-10-27）

| 检查         | 命令                                                                                                               | 结果                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Surface 单测 | `pnpm --filter @clouddrive/surface test`                                                                           | 176 passed（含新增 pageTransition 用例） |
| Web 单测     | `pnpm --filter @clouddrive/web test`                                                                               | 192 passed                               |
| 新 e2e       | `pnpm exec playwright test apps/web/e2e/page-transition.spec.ts --project=chromium`                                | 10 passed                                |
| 受影响回归   | `transition` + `motion-preference` + `settings-product-review` + `settings-routes` + `shell-security` + `settings` | 53 passed                                |
| 视觉         | `pnpm exec playwright test apps/web/e2e/visual.spec.ts --project=chromium`                                         | 9 passed（`settings-desktop` 更新）      |

> 完整门禁之后仅在 `settings-index.test.ts` 补充了两条测试断言（「页面切换」命中
> `pageTransition`、新字段中英文文案真实），产品代码未变；该文件由
> `pnpm --filter @clouddrive/surface test`（176 passed）与 ESLint/Prettier 单独验证。

### 视觉基线变更（逐项复核）

- 文件：`apps/web/e2e/visual.spec.ts-snapshots/settings-desktop-chromium-win32.png`
- 差异：1440×2265 → 1440×2381（+116px，0.02 像素比）
- 原因：外观·动效与视觉辅助组新增「页面切换动画」Select 与说明，位于「动效偏好」与「高对比度」之间
- 复核：查看 actual 截图，仅新增该字段，其余布局/配色/token 无变化；无其它基线受影响
- 记录：见 [README](../README.md) 与 `design/decisions.md` D-07

## 完整门禁

`pnpm check` **退出码 0**（日志：[pnpm-check.log](pnpm-check.log)）：

- Playwright **423 项**（116 的 413 + 本变更 10）；web 192、surfaces 176；
- Architecture 845 files、Dependency 28、两项 Codegen fresh、ESLint、全部 TypeScript、
  Next build、Prettier、Docs（23 条变更）全部通过；
- 产物预算（未调整阈值）：initial **408,047 B / 409,600**、maxRoute **432,435 B / 445,440**
  （`/login`）、CSS **48,736 B / 49,152**、最大 chunk 84,704 B。

## 环境阻塞与收口说明

上述门禁（check14）是产品代码与最终提交一致时的一次完整绿色运行。之后为让
`settings-index.test.ts` 的补充断言也进入同一次门禁，又发起了两次重跑，均被环境打断：

1. 系统盘写满（Turbopack `磁盘空间不足 / ENOSPC`），8 个 family 页 hydration 超时；
   清理构建缓存、Chrome 模型缓存与回收站后恢复（磁盘已回到 GB 级余量）。
2. 残留的 3001 端口被 `wslrelay` 占用，Playwright `webServer` 等待 120s 超时；结束该进程后端口释放。
3. 第三次浏览器全量重跑进行到 232/423 时，按用户决定停止，避免继续用 30 分钟等待换取与
   check14 等价的结论。

结论依据：check14 完整门禁退出码 0（产品代码与 HEAD 一致）；之后的差异仅为
`settings-index.test.ts` 两条断言与文档，已由 `pnpm --filter @clouddrive/surface test`
（176 passed）、ESLint、Prettier、Docs check 单独验证。
