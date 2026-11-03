# 068 WebUI 全量采用 HeroUI 组件库

状态：研究门禁已通过（R068-001/R068-002）；用户确认方案 A（全量采用 HeroUI v3 + Tailwind v4）；**实施完成**（HER-068-A/B 与 C/D 主要部分，含单轨收口与边界记录；Vitest 109、Playwright 15、typecheck/build/lint/generate/go 全绿），证据见 [tasks.md](tasks.md)。

## 背景

用户主张「Web UI 明明接入了 HeroUI 组件库，为什么却没有使用」，要求全量使用。研究澄清（R068-001）：HeroUI 并未「已接入未使用」——042（c08f12d）曾作为候选引入，059（b36dcc6）以「零消费者依赖」为由正式退役；当前 `package.json`/`pnpm-lock.yaml`/`node_modules` 均无 `@heroui/*`，唯一「接入」痕迹是本地 `node_modules/.package-map.json` 的陈旧映射（未跟踪文件，与依赖声明不一致）。当前 HeroUI v3（`@heroui/react@3.2.4`，MIT）peer 要求 React≥19（满足）与 Tailwind v4（需新增）。

## 范围

按用户指令重新引入 HeroUI v3 并单轨整层替换 WebUI 呈现层（方案 A）：新增 `@heroui/react/@heroui/theme/@heroui/toast` 与 `tailwindcss@^4`（Vite 集成）；SDK 原语、Shell 与全部业务页面迁移到 HeroUI 组件；`@webui/sdk/ui` 导出契约与平台契约层（ActionTrigger 权限呈现、zone 注入、Reveal、滚动运行时、experience 派生配置、reduced-motion）保持不回归；迁移完成后单轨收口并更新 authority 文档。

## 明确不做

- 不改模块 Binding/Manifest/路由/权限/服务端契约/数据库/Go 行为；
- 不把动作级权限、zone、reveal、滚动体验、体验配置等平台契约交给组件库；
- 不引入运行时插件/远程模块；不留新旧双轨；
- 不为「统一」做无收益重构（组件库无对等能力的平台层保留自研）。

## 阅读顺序

1. [研究档案](research/README.md)：R068-001（现状事实澄清）、R068-002（迁移方案对比，推荐方案 A）
2. [需求规格](requirements.md)：REQ-068-A..E
3. [设计方案](design.md)：依赖装配、SDK 原语替换、Shell 迁移、主题共存、单轨收口与待确认决策 1–5
4. [任务清单](tasks.md)：HER-068-A..F