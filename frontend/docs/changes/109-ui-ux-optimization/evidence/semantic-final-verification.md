# 2026-10-09 设置语义续审验证

设计与全字段清单见[设计审查](../design/settings-semantic-review.md)，原问题见108报告§19。
本记录区分当前执行结果、已提交历史与视觉验收；不自动更新快照。

## 执行记录

- semantic-resume-check.txt：环境恢复后首次完整命令，治理、类型、单元、生产构建和
  原预算运行成功；浏览器阶段发现旧系统偏好假设，同时新增分组仍在修改，主动停止。
  此日志不是最终代码的全绿证据。
- semantic-resume-browser.txt / semantic-resume-browser-fixed.txt：新增预览测试首次执行；
  隐藏input直接check超时，改用Space并验证选中状态；初始evaluateAll在hydration前返回
  空数组，增加加载门控与色样数量断言。没有修改产品选择逻辑或放宽测试。
- semantic-product-browser.txt：八分类及共享控件首次完整专项25通过/1失败；真实暗色
  Dialog白字对比度不足。按Token配对修复，并扩至四强调色的明暗打开态验证。
- semantic-index-unit.txt：Surface七文件54项通过，含新增双语解析、字段唯一性和
  原漏检字段的发现路径。
- semantic-final-check.txt：专项仍运行时尝试全量，架构扫描读到Playwright临时trace内
  的编译vendor CSS；未更改门禁排除，等待专项结束后重新执行最终完整检查。
- semantic-product-browser-final.txt：35项中32通过，三项失败是搜索使用错误role以及
  侧栏测试手动收起后reload仍假定配置为compact；修正为公开searchbox和真实持久化配置。
  semantic-product-navigation-final.txt三项复测全部通过。
- semantic-final-check-complete.txt：治理/类型/lint/单元/构建/原预算通过，进入272项浏览器。
  人工复核320英文大字号确认主题逐字换行及分类入口截断，停止命令修复可读性。
  本次中止记录不能视为最终全量结果。
- semantic-readable-narrow.txt：修复容器响应式tiles与入口去重后16项全部通过，覆盖八分类
  以及共享控件明暗；新增标签行数和入口不截断断言。实际窄屏截图人工复核完成。

## 最终结果

恢复后的最终源码完整运行已完成：semantic-final-check-current.txt，374 单元通过、
285 浏览器 271 通过/14 视觉失败；原基线未更新，完整命令 exit 1。
之前的完整运行及专项结果保留如下，不覆盖历史记录。

- 最终产品代码完整命令：semantic-final-check-readable.txt，`pnpm check` exit 1。
  治理、架构、依赖、生成物、Lint、TypeScript、374项单元、生产构建、原性能预算通过。
  272项浏览器254通过、18失败，26.8分钟；14项为27个视觉截图断言，其余四项为旧测试问题。
- 新增settings-product-review的25项在该完整运行中全部通过，settings-semantic七项全部通过；
  含八分类67字段、明暗、320英文大字号、高对比度、四色Dialog、键盘、触摸和持久化。
- 四个旧测试问题：主题六组合、开关九组合共用30秒；密度已改比较预览但仍查找圆点；
  标签默认关闭且前置状态未明确。矩阵拆为独立测试，圆点回归转到真实UI Elements权威，
  标签显式初始化并等待hydration。没有修改产品逻辑或增加超时。
- semantic-final-test-repairs.txt：17项补测15通过/2失败；一个旧截图路径写入UNKNOWN，
  另一个测试初始化脚本在刷新时重新覆盖已保存值。截图归本轮目录，初始化仅在无key时写入。
  整个受影响settings-ux-review套件重跑：semantic-final-ux-suite.txt，34项全部通过，3.3分钟。
  此后只移动证据输出路径，保留此前已提交的历史PNG。
- 性能gzip：initial 371334B；最大路由433816B（resource-list）；union 896874B；CSS 47680B。
  原预算未改变。浏览器失败中断了完整命令的format/docs尾段，另行执行并记录。

完整运行与修复后的专项不合并成一次“全量全绿”。产品代码在完整运行后没有变化；
剩余视觉验收仍需人工确认。原基线和阈值保持不变。

修复后的独立源码检查：semantic-final-boundaries.txt（506源文件/18fixtures），
semantic-final-types.txt（全部workspace），semantic-final-format.txt（全部匹配文件），
semantic-final-docs.txt（8 authority/15 changes）均exit 0。最终Lint同样exit 0，见semantic-final-lint.txt。

## 视觉与证据边界

2026-10-09 恢复后的最终源码全量结果已收齐（semantic-final-check-current.txt）：
374 单元通过，全部源码前置门禁、生产构建与原预算通过；285 浏览器中 271 通过、
14 失败，27 个断言均为旧视觉基线差异。此前四项行为/测试问题在此完整运行中通过，
不再依赖拼接专项成绩。完整命令 exit 1，未更新视觉基线；该结果属于动效专项实施前。

semantic-final/包含八分类1440浅色与320深色英文大字号、Dialog四色明暗、紧凑侧栏
手机画面。它们是当前实际结果，尚不是批准后的自动视觉基线。浏览器模拟覆盖触摸、
键盘、刷新保存、焦点恢复和Axe WCAG AA，没有新增真实设备/软键盘/读屏或原生zoom证据。

- [八分类当前画面](semantic-final/index.html)
- [27组旧基线/当前/差异](semantic-final/visual-differences/index.html)
- [当前画面总览](semantic-final/comparison-contact.png)

人工复核了320英文大字号和手机中文，修正了Axe与无溢出无法识别的逐字换行/入口截断。
视觉对照包含此前已提交但仍未人工确认的项目级变化，不仅是本轮设置分组。
