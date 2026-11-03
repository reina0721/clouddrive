# 逐项滚动呈现验证

2026-10-09。实现与范围见[专项审查](../design/scroll-reveal-review.md)。

本轮将上轮区段级呈现扩展为语义内容项，不覆盖原报告和历史截图。

## 已完成的专项验证

- 9项 Reveal 单元通过：SSR默认可见、观察器缺失/构造/observe失败、单例释放、快滚跳过、
  首次进入、独立叶项/父子互斥、实际几何排序、批次延迟、动态内容和焦点中断。
- 32项浏览器专项通过，日志为 `scroll-items-browser-verified.txt`。覆盖桌面、手机、
  320/2048宽度、深色英文大字号、Axe、系统 Reduced/off、静默观察器、刷新/hash、
  返回/恢复、局部详情替换、快速/反向滚动和交互即时可用。
- 本轮完整检查中的独立字段/首屏专项再次通过。额外路由审计补入真实资源详情和编辑，
  从37入口扩大为38入口，结果由 `scroll-items-routes-final.txt` 与 `scroll-items/route-audit.json` 保存。
- CUA实际浏览：设置首屏仅可视字段完成，屏外 fontScale/contentWidth/motion/contrast
  保持pending；PageDown后及时稳定，无大Section动画。参考资源面包屑的computed foreground
  已从vendor默认色映射为项目ink-muted。TailAdmin Cards、Modals打开态和Links已复核。

测试截图在 `scroll-items/`；快滚后反向浏览没有重播，Reveal前后页面高度保持一致。
默认内容始终可见，动画只增强呈现；“pending”不是隐藏或交互锁。

## 完整检查与根因修复

首次 `pnpm check` 已执行：383单元、架构/依赖/类型/构建/预算通过；301浏览器282通过、
19失败。15项是视觉比较，4项是真实瞬态对比度失败，未将后者归为截图差异。
日志为 `scroll-items-check.txt`。

四类对比度根因及修复：

1. 标题转场降低面包屑透明度：标题保留轻量位移，保持不透明。
2. Reveal降低前景对比度：普通起点收敛为0.96，高对比度/系统more为1。
3. 高对比度弹层的vendor进入透明度降低蓝色操作文字对比：四种Adapter浮层在该模式
   取消进入/退出动画，保留HeroUI的Focus、Portal与关闭生命周期。
4. Breadcrumb Item内公开Link未消费项目颜色：Adapter局部映射公开主题变量到现役Token。

没有改Axe标准、增加稳定等待、放宽像素阈值或更新golden。重复检查日志保留在
`scroll-items-contrast*.txt`；中间结果还包含截图文件写入失败，以及开发缓存保留旧样式的
复验失败，均不作为最终通过证据。随后重启本任务开发服务器，当前CSS映射已实测确认。

人工确认前的完整检查 `scroll-items-check-verified.txt` 已完成：301浏览器287通过、14失败。
全部14失败均为截图比较，共28个差异；此前四项功能/Axe失败均通过，不存在未处理的
功能或Axe断言失败。由于视觉基线尚待人工确认，`pnpm check` 退出码仍为1。
已通过：治理、边界、依赖、生成物、Lint、类型、383单元、生产构建与原性能预算。
补充38入口审计通过（43.2秒，详情/编辑使用真实资源ID）；后续Lint也通过。
最终 `format:check`、`docs:check` 与 `git diff --check` 通过，日志为
`scroll-items-format-final.txt`、`scroll-items-docs-final.txt`。
gzip：initial372775B，最大route435294B，union905755B，CSS47717B；未引入新动效依赖。

## 视觉复核

首次全量比较产生28个截图差异，27个名称在上轮对照中已存在，新增Motion独立项示例。
名称相同不代表像素完全相同；本轮组合与导航颜色修复仍需逐张复核。
[对照页](scroll-items/visual-differences/index.html)展示基线、当前结果与diff，manifest可逐项追踪。
对照已刷新为最终全量截图；本轮完整语义矩阵另存至 `scroll-items/semantic/`。
人工确认前保留原golden；历史semantic-final/motion-final不覆盖。

按AGENTS §10“视觉基线只能在人工确认变化合理后更新”，上述失败复验前保留原基线。
全部自动化成绩与人工视觉验收分别记录，不把专项通过当成完整检查全绿。

## 人工确认与基线复验

用户已针对归档的28项明确回复“确认这28项，更新并复验”。仅更新这28个golden，
更新前逐项检查原golden SHA-256与review expected完全一致，目标唯一且位于e2e目录；
复制用户审查过的actual，没有对整个测试目录运行无差别snapshot更新。
路径和前后hash见 `scroll-items/approved-baseline-updates.json`。
旧expected/actual/diff和之前失败日志继续保留。

人工确认后的完整 `pnpm check` 已通过（exit 0），日志为 `scroll-items-check-approved.txt`：
383单元、301浏览器（15.3分钟）、架构/依赖/生成物/Lint/类型、生产构建、原性能预算、
格式与文档门禁全部通过。该轮包含38个真实入口审计、桌面/移动端独立设置行、首屏错峰、
快滚/反向滚动/恢复/Reduced、键盘焦点、Axe和已批准视觉基线的完整复验。
本轮语义截图更新至 `scroll-items/semantic/`，原历史截图恢复；审批对照与hash记录保留。
