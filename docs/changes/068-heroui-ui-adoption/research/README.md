# 068 研究档案

## 研究范围

1. HeroUI 在仓库中的真实状态（用户主张「已接入未使用」，R068-001 澄清为 042 引入、059 退役、当前零依赖，仅有本地陈旧 `.package-map.json` 残留）；
2. 「全量使用 HeroUI」的可行形态与承载边界（R068-002：方案 A 单轨整层替换为推荐，方案 B 分层适配不满足「全量」，方案 C 维持现状不满足指令）。

## 检索方式

- 内部证据：git 历史（`-S "@heroui"`）、package.json/pnpm-lock/node_modules、既有平台契约层源码与测试、059/062/067 变更记录；
- 外部证据：npm registry 实测（版本/许可证/peer）、HeroUI 官方文档（组件面/主题/Toast）；
- 判定标准：3.2 成熟技术评估 + 3.8 单轨演进 + 4.3 保留/升级/替换/自研结论。

## 记录索引

| ID | 研究问题 | 结论摘要 |
| --- | --- | --- |
| [R068-001](R068-001-heroui-facts/report.md) | HeroUI 真实状态与版本事实 | 未「接入未使用」：042 引入、059 退役；当前三处依赖声明均无 heroui；残留仅为本地 .package-map.json 陈旧条目；HeroUI v3（MIT）peer React≥19 ✅、Tailwind v4 需新增。 |
| [R068-002](R068-002-migration-options/report.md) | 全量采用的方案与边界 | 推荐方案 A（单轨整层替换 + Tailwind v4 + @heroui/theme + @heroui/toast）；平台契约层（权限/zone/reveal/滚动/experience/reduced-motion）保留自研；styles.css 收窄到 reset/token/平台行为。 |

## 状态

研究门禁结论：关键事实验证充分（git/npm/文件系统三源一致）；方案 A 的收益、成本与风险已列出；未发现与技术选型 authority 的直接冲突（将由本变更更新）。研究门禁通过，进入计划阶段（待用户确认）。