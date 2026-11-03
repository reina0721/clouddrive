# 069 研究档案

## 研究范围

1. 068 之后当前 Web UI 骨架是否由 HeroUI 拼装（R069-001 复核：控件已 HeroUI、骨架仍自绘，并确认 HeroUI v3 的 Modal/Drawer 为 DialogTrigger 模式、Switch/Checkbox 无交互 input 等装配机制）；
2. 基于 HeroUI 视觉语言重新设计骨架与布局的分层方案（R069-002：token 对齐、Shell HeroUI/RAC 拼装、页面模板、测试策略）。

## 检索方式

- 内部事实：`webui/src/components/*` 与 `shell/*` 源码复核、`webui/node_modules/@heroui/react` 的 modal/drawer/switch/checkbox 实现源码、068/067 变更记录。
- 外部参考：HeroUI 主题 token（@heroui/theme/@heroui/styles 变量）、TailAdmin 参考站形态（公开 demo）。

## 记录索引

| ID | 研究问题 | 结论摘要 |
| --- | --- | --- |
| [R069-001](R069-001-current-skeleton-audit/report.md) | 骨架是否已 HeroUI 拼装 | 否：Shell/遮罩/页面布局容器仍自绘；HeroUI Modal/Drawer 为 DialogTrigger 客户端模式、Switch/Checkbox 无 input；`HeroUI + RAC + Tailwind` 为可行拼装路径 |
| [R069-002](R069-002-skeleton-design-language/report.md) | HeroUI 视觉语言与骨架分层 | 半径/阴影/间距/语义色/暗色/密度语言；TailAdmin 形态 vs 067 差距集中在 Shell 与 token；四层规范（token→Shell 拼装→页面模板→验证） |

## 状态

研究门禁结论：关键事实（源码/机制/token）均有证据；未发现与技术选型 authority 冲突（RAC 显式依赖将同步记录）。研究门禁通过，进入计划阶段（待用户确认决策 1–5）。