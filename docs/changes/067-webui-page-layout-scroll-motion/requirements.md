# 067 WebUI 业务页面布局骨架与滚动/动效体验 — 需求规格

> 支撑研究：[R067-001](research/R067-001-layout-skeleton-reference/report.md)（报错事实与布局差距）、[R067-002](research/R067-002-scroll-motion-technology/report.md)（滚动/动效选型与承载边界）

## 1. 目标与范围

用户提出「新增修复方案」，共三点：

1. 修复组织管理及下级模块在 Web UI 页面中的报错；
2. 参照 https://react-demo.tailadmin.com/ 的布局骨架重构全部业务模块 Web UI 页面布局；
3. 为 Web UI 实现以下能力及派生配置设置：动态交互、阻力感、弹入响应（内容面板/卡片/列表进入视口的弹入节奏）、滚动体验（全站阻尼平滑滚动、磁吸吸附、显式滚动场景劫持、边缘阻尼）、页面滚动条（默认稳定插槽、预留右侧，避免 Windows 实体滚动条出现时挤压布局）、阻尼平滑滚动（Lenis 柔化滚轮、保留触控原生惯性）、边缘阻尼/橡皮筋（页面与滚动区域边缘轻微橡皮筋反馈）。

范围：WebUI 平台（`webui/src`、`webui/src/styles.css`、`webui/package.json`）与全部业务模块页面（IAM/Organization/Auth/Navigation/Ops 的 `binding/webui/web/*`）。不改动模块 Binding/Manifest/路由/服务端契约/数据库/Go 行为。

## 2. 需求项

### REQ-067-A 组织模块报错修复

- REQ-A1：组织分配页使用的 `webui.organization.assignments.saved|conflict|revision` 三个翻译键必须在 en-US/zh-CN locale 中定义（缺失键当前被宿主换成「翻译资源缺失」占位）。
- REQ-A2：组织部门/岗位/分配页的创建、归档/恢复、保存操作失败必须有用户可见反馈与已捕获的 Promise（不得 unhandled rejection）。
- REQ-A3：组织模块页面不再出现缺失键占位文案（`webui.organization.*` 消费键与 locale 键逐一对应）。

### REQ-067-B TailAdmin 式布局骨架（平台原语 + 全模块页面迁移）

- REQ-B1：平台提供统一的布局骨架原语（组件 + 样式）：区块卡片（标题/主体/页脚）、统计卡行、数据表格卡片、工具行、列表卡片网格、表单面板，全部进入平台 `webui/src/sdk/ui`（`@webui/sdk/ui` 导出）与 `styles.css` public UI 分区；通用布局样式不得再由各模块重复实现。
- REQ-B2：全部业务页面（IAM 账号/角色/权限/会话/安全、Organization 部门/岗位/分配、Auth 审计、Navigation 菜单、Ops 运行状态/能力清单）迁移到新骨架；页面逻辑、操作 ID、权限钩子、i18n 键与 aria 语义保持不变。
- REQ-B3：模块 CSS Module 只保留模块专属 selector（ops-*/policy-*/session-*/audit-*/permission-matrix 等），通用布局由平台提供；`pnpm lint:architecture` 继续通过。
- REQ-B4：响应式（≤1000px / ≤720px 断点）与现有 e2e 断言保持成立（必要时同步更新断言以匹配新骨架语义）。

### REQ-067-C 滚动体验运行时

- REQ-C1：阻尼平滑滚动：工作区滚动容器（`.page-viewport`）接入 Lenis，柔化滚轮触发页面滚动；触控设备保留原生惯性；reduced-motion 或设置关闭时回退原生滚动。
- REQ-C2：边缘阻尼/橡皮筋：页面与滚动区域边缘显示轻微橡皮筋反馈（瞬态位移 + 弹性回弹 + 边缘辉光），设置可关，reduced-motion 关闭。
- REQ-C3：磁吸吸附：声明 `data-snap-x` 的横向滚动区（页签轨等）启用 CSS scroll-snap 吸附。
- REQ-C4：显式滚动场景劫持：声明 `data-scroll-hijack="x"` 的区域把纵向滚轮输入转换为横向滚动（应用于横向溢出的表格包装）；设置可关。
- REQ-C5：页面滚动条：默认「稳定插槽，预留右侧」（`scrollbar-gutter: stable`），`overlay` 档切换 `scrollbar-gutter: auto`；避免 Windows 实体滚动条出现时挤压布局。

### REQ-067-D 派生配置设置

- REQ-D1：`ThemePreferences` 增加 `experience` 组（`smoothScroll`、`damping`、`edgeDamping`、`magneticSnap`、`scrollHijack`、`reveal`、`revealRhythm`、`scrollbar`），默认值满足 REQ-C1..C5（稳定插槽、平滑滚动开、standard 阻尼、边缘阻尼开、reveal 开、balanced 节奏）。
- REQ-D2：旧 localStorage 主题自动迁移补齐 experience 默认值；`applyTheme` 落到 `<html data-experience-*>`。
- REQ-D3：ThemeDrawer 新增「体验」面板，可开关平滑滚动/边缘阻尼/磁吸/劫持/弹入响应，并选择阻尼档位、弹入节奏与滚动条策略；文案进入 host locale en-US/zh-CN。
- REQ-D4：`data-motion=reduce`（显式或系统）统一降级：Lenis 销毁、橡皮筋/劫持停用、Reveal 立即可见、CSS 动画近零——与 059 决策一致。

### REQ-067-E 弹入响应

- REQ-E1：内容面板（区块卡片）、卡片（统计卡/列表卡）、列表（表格/网格）进入视口时按可配置节奏弹入（translateY/scale + opacity，spring 类 easing）。
- REQ-E2：`RevealList` 支持按 index 派生 stagger delay；`calm/balanced/playful` 三档节奏影响 duration/ease/offset。
- REQ-E3：不引入动画库（059 边界保持）；IntersectionObserver 不可用（测试/旧环境）时回退为始终可见。

## 3. 验收标准

- A：组织页面无缺失键占位；操作失败有反馈；Vitest 新增组织 locale 键一致性用例通过。
- B：全部业务页面迁移完成；`pnpm typecheck`、`pnpm lint`、`pnpm lint:modules`、`pnpm test`、`pnpm build`、`pnpm generate:check` 通过；E2E 通过且截图为证。
- C/D：体验配置在 ThemeDrawer 可用、持久化、迁移；`data-experience-*` 与 `data-motion` 断言通过；Lenis 在真机浏览器滚动平滑、触控原生；边缘/劫持/磁吸行为有代码路径与单测。
- E：Reveal 在页面可见（e2e 断言 `reveal-shown` 类与节奏属性）；reduced-motion 下无过渡。

## 4. 非目标（明确不做）

- 不引入 Tailwind、动画库、headless 组件库或微前端（059/062 边界保持）。
- 不改变模块 Binding/Manifest/路由/权限/服务端契约/数据库/Go 代码。
- 不重写既有业务逻辑与数据流；不在宿主集中维护业务数据。
- 不新增「第二套滚动实现」双轨：关闭时即浏览器原生滚动。
- 不把滚动/动效运行时做成模块可装载插件。

## 5. 风险与未决项

- Lenis 对 element wrapper 的真机边界行为（已在验证阶段用 Playwright + 人工浏览器复核）。
- 页面重构可能引起 e2e 选择器变更——列入任务并逐条核对语义等价。
- `scrollbar-gutter` 在旧浏览器无效果（回到现状，不破坏布局）。