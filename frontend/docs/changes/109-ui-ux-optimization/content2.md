# UI/UX 续接上下文（2026-10-08）

用户最新要求：停止验收分析，立即保存上下文与缺口，用户要离开。不要自动继续分析或浏览器操作。
请求的 `.codex/content2.md` 写入被权限拒绝（apply_patch和正常PowerShell均失败）；本文件为完整续接副本。
目标未完成，已停止。缺口见 requirements/remaining-gaps.md。

## 项目和完整目标

根目录 C:/rin/coder/i0721/console-web，直接包含packages/surfaces/apps/docs，没有frontend子目录。
开发服务 http://127.0.0.1:4173 仍运行，浏览器/热更新可用，没有重启服务。
目标：八个设置分类的语义、信息架构、视觉、组件复用、跨设备和实际操作优化；重点外观七项，
并检查其它页面共性缺口。不能缩减成仅Radio改样式，不从零重做已有工作。
原报告 docs/changes/108-ui-ux-audit/README.md（本轮§18）；109保存任务和实施证据。
遵循现有AGENTS：HeroUI仅Adapter、语义Token、i18n、原生可访问交互、公共消费者/authority/门禁。
不复制旧系统或TailAdmin源码，不改快照阈值/预算，不擅自commit/revert，不使用未授权子代理。

## 环境和检查

命令、项目文件读取/写入/临时清理恢复。Node24.19.0；当前pnpm12.9.1，manifest要求10.22.0。
pnpm check在用户目录pnpm-store-operation-locks/all-stores.lock拒绝访问，检查链尚未开始。
直接Playwright worker fork仍spawn EPERM，没有进入测试断言；不要安装/绕过安全限制。
Vitest正式参数 --configLoader native --pool threads可用，未改变断言/范围/超时。
当前没有需要等待的CLI session，命令均已终止。
最新容器/authority修改前，全部9个有test脚本工作区372项单元通过：Web126、Surface52、
SurfaceFoundation45、Schemas50、i18n2、Core16、PluginFramework40、StateFoundation39、FormFoundation2。
此前相关类型/lint、架构505源、治理12工作区11owner、生成物freshness、格式/docs/diff通过。
**最新容器回退、authority长标签和新增3项e2e之后尚未补跑检查，不能使用旧成绩宣称通过。**
完整生产构建、原预算、browser/Axe及视觉人工验收尚未完成。历史14项视觉失败快照未批准更新。
apps/web/next-env.d.ts由Next开发运行时生成.next/dev类型引用，未手写，生产生成路径待核验。

## 历史保留工作

Tabs默认可选固定/非固定、弱化关闭/溢出管理、移动持续分类入口、开关hover内边距、Switch两端
几何、总览普通Section去阴影、主题图标tiles均有实现与证据，不要重复审查或还原。

## 本轮代码与文件

- packages/ui-adapter/src/radio-group-field.tsx：inline/previews、装饰option.preview。原input、
  Selection/Keyboard/Disabled由HeroUI负责；cards/rows/tiles默认不变。有icon的inline省重复圆点。
  **最新**：@container；previews窄容器单列横向预览＋标题，@sm三列纵向；preview窄时w-20。
  tiles仍三列。最新这部分未补跑检查，没有新公共export。
- packages/design-system/src/tokens.css：四preset生成块加data-accent-preview，色样用同一ds-brand。
  high/system-more增强焦点、辅助文字、边界，修复border-strong变量自引用；标准默认不变。
- apps/web/src/host/providers.tsx：contrast=system独立监听系统more，不受followSystemAssistive限制。
- apps/web/src/host/anchor-focus.ts、navigation-port.tsx：现有目的地协调增加resetScroll；目标pathname/
  search提交且模态退出后下一帧显式滚顶；保留锚点定位和关闭滚顶。只接Plugin Port，不是全部Host。
- surfaces/plugins/settings/src/category-sections.tsx：主题tiles；色样inline；密度/字体/宽度previews；
  短模式inline，长说明rows，Boolean Switch/多值Select保留。摘要含来源跳转，不新增store。
- 新 surfaces/plugins/settings/src/setting-previews.tsx：Density/Font/Width装饰示意；手动动效用
  ContentSwapTransition；真实truncate/wrap；formatDateOnly/formatTimeOfDay；通知真实FeedbackController
  与Host原3/5/8秒映射，无自研timer。文案在settings/i18n.ts，中文/英文。
- surfaces/plugins/ui-elements/src/form-elements-page.tsx及i18n：同源inline/previews/禁用示例。
  **最新**ExecutionSketch装饰图标+三段进度；长文本开关传播到新增呈现名称/说明，未补跑检查。
- apps/web/src/test/ui-element-actions.test.tsx：新增预览/inline语义测试，专项7项已通过。
- 新 apps/web/e2e/settings-semantic.spec.ts现在7项：三视口外观、移动滚动、1440/320容器长标签、
  system-more独立性。最新3项尚未类型检查，全部浏览器断言未执行；系统测试Axe当前切回标准后，
  system/high覆盖仍不足。
- docs/ui-element-system.md最新容器回退/inline/长内容契约；108§18、109/tasks.md与
  evidence/review-verification.md已记录上一阶段，但尚未回填最新372项和容器发现。

## 实际证据及未判定项

R18-01：390外观底部scrollY1168切通知，滚顶开仍93，h1 top31被Header bottom80遮挡；
修复后scrollY0、h1 top124、焦点返回分类入口。
R18-02：高对比度原仅粗焦点、system受额外开关限制、边界变量循环；已修复，浅/深色真实有效。
新发现：320嵌套authority容器197px，3列长标签逐字竖排；回退后197px横向行，中文卡186px高，
英文也无横向溢出。最新390真实设置页尚未完整复核；无溢出不等于可读性通过。
颜色蓝色刷新保存、密度ArrowRight、减少动效duration1e-05s、原320大字号、390/1440英文实测。
文本截断46px/换行66px；12小时+秒示例08:08:42 AM；真实成功toast已打开。
关闭滚顶：导航页底部693切外观后381，非零但不是精确保留，不可宣布严格滚动保持通过。
搜索定位因现场内容改变未匹配，没导航，不能视为代码缺陷或通过。

## 浏览器停止现场，不自动抢占

CUA句柄reviewBrowser=IAB2、settingsReviewTab=tab2；临时TailAdmin tab已关闭。
临时视口390×844尚未reset。当前/settings，移动分类Drawer打开，搜索“自动滚动验证”。
脚本先输入“自动滚动”，后续内容发生变化，可能用户接管，不擅自清空或导航。
scrollToTopOnNavigate测试从原true改false，尚未恢复；后续用户允许继续操作时恢复或确认意图。
其它测试偏好恢复：theme/contrast system、accent purple、density/font standard、zh-CN、24小时、
秒关闭、longText truncate。现在不继续验收、浏览器操作或恢复任务。

## 证据和续接

截图在109/evidence/review-2026-10-08：semantic-before-*八分类、appearance-current-1440、
appearance-en-1440/390、high-contrast-dark-390、category-scroll-fixed-390、locale-en-390、
notification-preview-390，均带semantic-前缀。最新preview-long-320、preview-long-en-320是回退后。
semantic-check-attempt.txt、semantic-browser-attempt.txt保存环境失败；没有更新视觉基线。
用户重新指示继续时先读本文件/缺口文档；先处理最新未检查源码及现场状态，不重做初始审查。
全目标保持，不能把已写测试算通过；保留所有已有修改/截图/日志，不自动提交或清理。
