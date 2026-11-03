# Motion 专项最终验证

基于 Git `1e500e0`，接续109设置语义优化。设计与消费者清单见
[Motion 审查](../design/motion-review.md)，原报告新增问题见108 §20。

## 实施与实际体验

- 实际浏览35个主要入口：全部设置、UI Family、Pattern、Archetype，以及总览、参考
  资源、状态、基座、图标和 Motion。审查默认1280×720，专项再覆盖1440/390/320、
  2048超宽、深色英文大字号。
- Public Reveal 内容默认可见；滚动呈现仅增强阅读，不等待 Observer。首屏/恢复、
  快速越过、失效与 Reduced 直接稳定；滚动进入播放一次短 rise，焦点立即取消位移。
- 设置嵌套 Page 自身不动画，直接语义分组进入；后续五个分组显式复用 Reveal。
  总览质量/活动分组复用相同能力，主从详情复用 Content Swap。无新的公共 API 或 Token。
- Host 复用初始锚点定位/焦点：桌面实测目标 top=482、scrollY=1459；390×844手机
  目标 top=622、bottom=666，焦点在 Switch，opacity=1、transform=none，无横向溢出。

## 专项与失败修复

| 证据                      | 实际结果        | 边界                                                                |
| ------------------------- | --------------- | ------------------------------------------------------------------- |
| motion-unit-final.txt     | 10项通过        | 单例、SSR输出、首屏、跨界、快滚、focus、缺失/构造/注册失败          |
| motion-targeted-final.txt | 16项通过        | 第一阶段含旧Motion与方向转场，不冒充最终全部新增场景                |
| motion-expanded.txt       | 11通过/1失败    | 失败是整应用无JS假设；RuntimeProviders实际等待hydration，范围已澄清 |
| motion-with-anchors.txt   | 18项通过        | 修复初始锚点后含明暗/英文/大字/超宽、Axe与回归                      |
| motion-anchor-final.txt   | 2项通过         | 正确书签定位/焦点/刷新/返回，损坏编码不阻断hydration                |
| motion-types-final.txt    | 全workspace通过 | 类型检查后仅增加损坏编码安全返回与对应浏览器例                      |
| motion-lint-final.txt     | exit 0          | 静态规则；完整运行继续验证最终源码                                  |

初轮测到两个顺序创建的 Observer，原因是 Strict Mode 清理/重建；最终断言验证同时
存活峰值=1，单元另验证注册与释放，没有将资源检查改为任意计数容忍。初始类型声明
及缺 Provider 的 SSR 测试失败分别留在 motion-check-type-attempt.txt 和
motion-check-unit-attempt.txt。所有失败保持记录，不降低门禁、Axe、默认超时或快照阈值。

## 完整运行

`motion-check-final.txt` 是完整 `pnpm check`，已执行结束，exit 1。
前置治理/架构/依赖/生成物/Lint/类型、382单元、生产构建和原性能预算已经通过。
297项浏览器回归：282通过、15失败，耗时26.5分钟。14个失败用例仅为原有27项
截图断言差异，与动效前的视觉待确认范围一致；另一个 SET-012 仍读取内层 Page
的整容器动画，与新的 region 契约冲突。已改为检查直接语义区段 forward recipe，
并新增内层 Page animation=none 断言，保留 Shell opacity 恒定的检查。
生产代码在此完整运行后未改动；测试修正后的独立回归记录于
`motion-final-regression.txt`，不改写完整命令的失败历史。
该独立回归24项全部通过（1.3分钟）：完整 settings-routes 12项和新增动效12项，
包含修正后的 SET-012。因此行为失败已解决，尚待人工确认的为14个用例的27组视觉差异；
没有把这一复测改写为重新执行的全量297项通过。

gzip：initial=371626B，最大路由resource-list=434107B，union=903851B，CSS=47687B。
相比动效前，initial增加292B，CSS增加7B；沿用原预算，没有改变性能门禁。
滚动专项检查文档高度保持不变、无横向溢出与同时单例；Reveal仅transform动画，
没有scroll listener或每帧同步测量。未宣称得到真实低端设备的FPS测量。

## 视觉与验收边界

实际画面在motion-final目录，静态截图不能证明动画时间线；时机、单次与中断由浏览器
交互和行为断言确认。截图捕获前回到页面顶部，避免把sticky chrome的捕获位置误判
为页面结构。模拟窄屏/触摸不替代真实手机、软键盘、屏幕阅读器或原生zoom测试。

原视觉基线与阈值未修改；任何最终失败必须区分行为、Axe、构建/预算与视觉。旧视觉
差异仍按AGENTS.md §10“视觉基线只能在人工确认变化合理后更新”处理，不能自动批准。

本次完整运行的27组 expected/actual/diff 在后续测试前已独立归档，见
[最终视觉对照](motion-final/visual-differences/index.html)。该对照来自本次运行，
不复用设置专项的旧实际截图。格式与文档尾部检查单独执行，因为浏览器失败使
`pnpm check` 短路，结果见 `motion-format-final.txt`、`motion-docs-final.txt`。
两项尾部检查均通过；SET-012测试文件独立ESLint通过。`git diff --check`通过，
原Playwright快照目录没有变更。

续轮核验见 `motion-visual-integrity.json`：27个截图名称与上一轮完全一致，81张
归档图片完整；每个 expected 同时逐字节匹配上一轮对照和当前仓库 golden。
20张 actual 与上一轮逐字节相同，7张有差异，因此名称范围一致不等于本次画面
完全未变；人工确认应使用本次对照。当前仍未收到基线更新确认。
