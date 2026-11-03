# 研究证据

继承 108 三份报告的 37 个编号，不重复全量研究。实施前最小复现已确认：
1024 主内容 Y=880，320 顶栏超宽；手机导航无 dialog/ESC；主题字段 Y=854；
字号搜索无 hash 且焦点在结果；输入高44/50.67/68；320×256 Dialog 操作超出视口。

公共组件的外部校准使用 TailAdmin 具体页面；只观察，不复制实现或尺寸。

## 继承依据与当前复现

直接依据为 [整体报告](../../108-ui-ux-audit/README.md)、
[响应式专项](../../108-ui-ux-audit/responsive-review.md) 和
[手机专项](../../108-ui-ux-audit/mobile-review.md)。原 38 路由、190 响应式组合、
114 手机组合是历史研究，不转换为当前通过数。本轮依据已有结论定位根因，再用
当前源码、实际浏览器与独立回归闭合；覆盖归并见 [18 个工作包](../tasks.md)。

已安装 HeroUI 3.2.4 的类型与运行时提供 Table.ResizableContainer/ColumnResizer，
原“没有独立 resizable 子路径”结论已纠正，不能继续当成列宽延期依据。
外部具体页面当前矩阵见 [TailAdmin 复核](../evidence/tailadmin-review.html)；
此前终端超时保留为过程记录，后来成功访问不能伪装成全部状态已通过。

## 实施中新增的实际缺陷

| 实际触发                                    | 根因与修复                                                              | 本轮证据                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| 同帧原生 requestSubmit 两次写入两条记录     | 异步校验前缺即时锁；Form Foundation 单入口锁并在 finally 释放           | duplicate-submit-before.txt → submit-guards-final.txt        |
| 校验期间离开，旧结果完成后写入并拉回列表    | 业务回调未检查表单是否仍挂载；在正式提交入口门控                        | stale-submit-before.txt → submit-guards-final.txt            |
| 手机选中记录后关闭 Drawer，焦点落到页面根部 | 打开早于集合完成焦点；Browser Adapter 延后一帧，保留 HeroUI 恢复        | detail-pending-final.txt 的实际失败 → detail-focus-final.txt |
| 草稿恢复/reset 后仍显示旧字段值             | 非受控默认值没有跟随 RHF；正式 ControlledField/ref/onBlur 桥接          | draft-restore.txt、最终 draft-autosave 回归                  |
| 标签重载丢失旧会话                          | hydration 前记录当前页覆盖恢复数据；等待正式 hydration 门控             | fixes-behavior.txt、最终 page-tabs 恢复回归                  |
| 保存继续创建后输入再清空仍被误判 dirty      | 恢复名称永久进入 dirty 条件；成功提交清理恢复未保存标记                 | deferred-and-draft.txt、最终 restored-draft 回归             |
| 大字号 320px 出现文档溢出                   | body 的 20rem 最小宽被字号放大到 360px；Host min-width:0                | toggle-boundaries-final.txt、最终公共 Family 几何            |
| Settings 进入有外层/内层重复动画            | 持久 Layout Page 也被 route-enter 选择；排除带 route-content 的持久外层 | fixes-behavior.txt、最终 settings/transition 回归            |

## 环境与源码风险

dev/build 共用目录实际出现 ENOTEMPTY，已按 Next phase 分离 .next/dist；现有
watcher 保留。中断 Playwright 留下的临时 trace CSS 曾被源码 gate 扫描，原临时
产物归档后恢复检查，没有修改治理规则或增加排除。

受控 HeroUI 根没有内部 Pressable 时仍发出 vendor PressResponder 警告；已核对
安装版本正式 DialogTrigger 装配及公开受控 API。焦点、ESC 和 Axe 有当前行为
证据，警告不记作已经复现的交互缺陷，也不制造隐藏控件掩盖。

视觉快照、原生 zoom 和真实设备状态属于独立验收边界。源代码中的可能风险只有
实际复现后才修复；不能从未覆盖状态推导“已通过”或预造无调用方抽象。
