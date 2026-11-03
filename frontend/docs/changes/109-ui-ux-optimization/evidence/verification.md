# 109 最终验证记录

当前代码在最后手机详情组合、状态收缩及焦点修复后重新执行完整 `pnpm check`。
原日志为 [check-final.txt](check-final.txt)，不是之前 214/217 项的过程记录。

| 门禁                                   | 当前结果                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Foundation / Architecture / Dependency | 通过；12 workspaces、11 owners、500 source files、25 governed dependencies               |
| Plugin / Design codegen freshness      | 通过；9 plugins、38 plugin routes                                                        |
| ESLint                                 | 通过；max-warnings 0                                                                     |
| TypeScript                             | 所有 workspace 通过                                                                      |
| Vitest                                 | 369 项通过                                                                               |
| Next production build                  | 通过；dev `.next` 与 production `dist` 分离                                              |
| Performance                            | 通过；保持原预算，具体数值见下文                                                         |
| Playwright / Axe / Visual              | 219 项：205 通过、14 视觉失败；其它行为断言没有失败                                      |
| Format / Docs                          | 通过；完整命令在视觉失败停止后独立执行全仓检查，日志为 final-format.txt / final-docs.txt |

27 个失败错误均为 `toHaveScreenshot`，对应 14 个测试用例，不把 27 组图片误报
为 27 个失败用例。截图断言保留原阈值和失败状态，soft 只让同一用例继续完成
后续键盘、焦点、状态和 Axe 检查。完整命令 exit 1，未宣称全绿。

## 当前预算

以下为生产构建 gzip 字节数，源于最终原日志，不使用开发模式计时判断性能。

| 指标                           |  当前值 |
| ------------------------------ | ------: |
| initial JS                     |  369813 |
| 最大 Route JS（resource-list） |  432613 |
| 所有 route union JS            |  918832 |
| CSS                            |   47131 |
| 最大 chunk                     |   84658 |
| raw JS                         | 3018041 |

最大 Route 原上限 440320 B；所有原预算均通过。未提高阈值。

## 行为与几何覆盖

- Catalog 38 条插件路由在 390/1440 下标题、主内容及文档边界；首页另有 Shell 和视觉覆盖。
- Shell 16 个宽度，包括所有要求断点边缘和 320/390/430/1920/2560。
- 九个公共 Family 的 Dark/English/大字号/三密度搜索父边界和 Toggle 末项；十个
  Tabs 消费者 × 320/767/768 的 30 个独立几何组合另保留 tabs-geometry-current.txt。
- 短高度 256/400 的普通/确认动作，危险确认和其它 Floating 的键盘/焦点/Axe。
- 设置字段定位、分类保留、恢复、持久化拒绝/损坏重试；导航修饰键、返回与标签关闭。
- 列宽指针/键盘/记忆/显隐/恢复；手机详情同实体、关闭焦点/选择/可见位置、跨桌面和打开态 Axe。
- 本地示例失败/重试/取消/校验/保存/重置；Reference 实体、去向、通知与草稿。
- 原生重复提交、校验期间离开、本地保存卸载清理；导出失败重试和 Pending 禁止提前关闭。
- 连续快速导航、进度收尾、浏览器后退、reduced motion；不调整全局 duration。

## 人工与环境限制

[27 组原基线/最终渲染/diff](visual-diffs-final/index.html) 保留完整原尺寸图片，
manifest.json 保存来源与 SHA256。未更新 Playwright baseline，未提高 diff 阈值。
已有快照修改数为 0；108 中 18 个文本文件仅格式空白变化，文字/JSON 数据未改，
原像素证据保留。

TailAdmin 五页 × Light/Dark × 手机/桌面/超宽的 30 张当前截图及真实切换/分页/
日期打开态见 [外部矩阵](tailadmin-review.html)。这不等于全部外部状态的人工门
已经通过，107 相关 checkbox 保留。

真实 iOS/Android、软键盘、动态工具栏、安全区与原生 zoom 没有当前设备证据；
CSS viewport、字号和 Chromium 模拟只证明其自身覆盖范围。
