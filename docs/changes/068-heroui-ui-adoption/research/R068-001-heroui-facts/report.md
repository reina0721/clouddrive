# R068-001 HeroUI 在仓库中的真实状态与当前版本事实

## 研究问题

用户主张「Web UI 明明接入了 HeroUI 组件库，为什么却没有使用」，并要求「全量使用 HeroUI 组件库」。需要回答：

- （a）HeroUI 在仓库中的真实接入状态；
- （b）「接入」痕迹来自哪里；
- （c）当前 HeroUI 版本/许可证/peer 依赖/主题与 Toast 附加包事实；
- （d）与既有决策（042/059/062/067）的冲突范围。

## 方法与范围

- Git 历史：`git log -S "@heroui" -- webui/package.json`；
- 当前事实：`webui/package.json`、`webui/pnpm-lock.yaml`、`webui/node_modules`（`.package-map.json`、`@heroui` 目录、`.pnpm`）；
- npm registry 实测：`@heroui/react`、`@heroui/theme`、`@heroui/toast`、`@heroui/flat`、`tailwindcss` 的 latest 版本、许可证与 peerDependencies；
- 仓库文档：042/059/062/067 变更记录中的组件库/样式 authority 决策。

## 证据

### 1. HeroUI 从未「已接入未使用」——042 引入、059 退役

| 提交 | 动作 |
| --- | --- |
| `c08f12d`（042 Admin WebUI 基础） | 把 `@heroui/react` 加入 `webui/package.json`（候选引入） |
| `b36dcc6`（059 Shell 体验升级） | **退役** `@heroui/react`：commit message 原文 "…and retire the zero-consumer HeroUI dependency"；`webui/package.json` 该依赖被移除（`1 -`） |

059 变更 README 明确记录「退役零消费者 HeroUI，不引入 Tailwind/动画库」；062/067 延续自研原语 + 平台样式 authority（`webui/src/ui/index.tsx`、`styles.css` public UI 分区）。

### 2. 当前仓库事实（快照 f7ca5ca + 本地运行态）

- `webui/package.json`：**无任何 `@heroui/*`**；
- `webui/pnpm-lock.yaml`：**无 heroui 记录**；
- `webui/node_modules/@heroui`：**不存在**（`Test-Path` False）；`.pnpm` 亦无 heroui 条目；
- `webui/node_modules/.package-map.json`：**存在陈旧条目** `"@heroui/react":"@heroui/react@3.2.4(…)"` 挂在根项目 dependencies ——与 package.json/lock/node_modules 三者不一致，属于本地运行残留（未跟踪文件，不进仓库），很可能就是「明明接入了」的误判来源。

### 3. npm registry 事实（2026-08-26 实测）

| 包 | latest | 许可证 | 关键 peer /
说明 |
| --- | --- | --- | --- |
| `@heroui/react` | 3.2.4 | MIT | `react>=19`、`react-dom>=19`、`tailwindcss>=4`、react-aria 系列（react-aria-components、@react-aria/*、@react-spectrum/provider） |
| `@heroui/theme` | 2.4.26 | MIT | Tailwind 插件形态主题系统（extendTheme/custom variants、.dark 模式） |
| `@heroui/toast` | 2.0.22 | MIT | Toast 附加包 |
| `@heroui/flat` | —（404） | — | 无 Tailwind 的 flat 变体在 v3 不存在 |
| `tailwindcss` | 4.3.3 | MIT | HeroUI v3 的 peer 依赖 |

本仓库 `react ^19.1.1`/`react-dom ^19.1.1` 满足 HeroUI peer；**Tailwind v4 未引入**，是必须新增的唯一前置第三方。

## 事实与推断的区分

**事实**：HeroUI 已退役并非「接入未使用」；`package.json`/lock/node_modules 均无 HeroUI；`.package-map.json` 为本地陈旧残留；HeroUI v3 要求 React 19 + Tailwind v4；仓库 059/062/067 明确以「自研/不引入 Tailwind/组件库/动画库」为边界。

**推断**：用户看到「接入」的证据大概率是本地 `.package-map.json` 残留或对 042 时期历史的印象；「全量使用 HeroUI」在当前版本形态下必然引入 Tailwind v4 + `@heroui/theme`，并重构自研原语与样式 authority。

## 对本任务的影响

- 向用户核实/澄清「未接入」事实，再由用户确认是否仍要按「全量采用 HeroUI v3 + Tailwind v4」推进（计划阶段决策）；
- 若确认，变更按 068 计划实施：依赖与主题装配 → SDK UI 原语替换（保持导出契约与 ActionTrigger/zone/reveal/体验配置等平台契约）→ Shell 替换 → 模块页面校准 → 测试/e2e 维护 → 文档 authority 迁移（styles.css 分区、webui.md、technology-selection.md）。