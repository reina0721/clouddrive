# 067 WebUI 业务页面布局骨架与滚动/动效体验

状态：研究门禁已通过（R067-001/R067-002）；计划已按用户「新增修复方案」直连需求建立并默认按 design.md 第 11 节推荐项实施（本会话审批策略为 never，实施任务已标记为已确认执行）；实施与验证已完成（LAY-067-A..I，Vitest 109 项、Playwright 14 项全绿），证据见 [tasks.md](tasks.md)。

## 背景

用户报告「组织管理及下级模块在 Web UI 页面中存在报错」，要求修复并依据 TailAdmin（react-demo.tailadmin.com）重构全部业务模块页面布局骨架，同时为 Web UI 实现：动态交互与阻力感、弹入响应（面板/卡片/列表进入视口的弹入节奏）、滚动体验（全站阻尼平滑滚动、磁吸吸附、显式滚动场景劫持与边缘阻尼）、页面滚动条（默认稳定插槽预留右侧、避免 Windows 实体滚动条挤压布局）、Lenis 阻尼平滑滚动（保留触控原生惯性）、边缘阻尼/橡皮筋反馈，以及派生配置设置。

研究确认（R067-001）：组织分配页使用 `webui.organization.assignments.saved/conflict/revision` 三个未定义翻译键，宿主缺失键处理把其替换为「翻译资源缺失」占位——这是用户可见报错的主体；另有创建/归档操作未捕获 Promise 拒绝。布局差距为平台缺少统一「区块卡/统计行/表格卡」骨架，各模块重复实现近似布局样式。

## 范围

- 组织模块报错修复（locale 键 + 操作失败反馈）；
- 平台布局骨架原语（PageSection/StatGrid/StatCard/DataCard/card-grid/item-card/toolbar 等进入 `@webui/sdk/ui` 与 `styles.css` public UI 分区）并迁移全部业务模块页面（IAM/Organization/Auth/Navigation/Ops）；
- 滚动体验运行时（`webui/src/scroll/`：Lenis 窄封装 SmoothScrollController、EdgeBand、ScrollHijack、磁吸 snap）与弹入响应（`webui/src/motion/`：Reveal/RevealList）；
- ThemePreferences `experience` 派生配置 + ThemeDrawer「体验」面板 + 旧主题迁移；
- 唯一新增第三方依赖 `lenis`（MIT，1.3.x），按 3.2 边界封装；
- 配套单测、e2e（含新 webui-experience.spec.ts 与截图）、文档同步与提交。

## 明确不做

- 不引入 Tailwind/动画库/headless 组件库/微前端（059/062 边界保持）；
- 不改模块 Binding/Manifest/路由/权限/服务端契约/数据库/Go 行为；
- 不重写业务逻辑与数据流；不把滚动/动效做成模块可装载插件；
- 不建立第二套滚动实现双轨：关闭即浏览器原生滚动。

## 阅读顺序

1. [研究档案](research/README.md)：R067-001（报错事实 + 布局差距）、R067-002（滚动/动效选型与承载边界）
2. [需求规格](requirements.md)：REQ-067-A..E
3. [设计方案](design.md)：任务 A–G 的结构、文件影响、验证矩阵与待确认决策 1–5
4. [任务清单](tasks.md)：LAY-067-A..I（依赖、完成条件、状态记录）