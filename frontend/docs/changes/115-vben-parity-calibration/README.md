# 115 Vben 对标需求校准

本次仅校准文档，不实施产品功能。核对日期：2026-10-26；源码基点：`59b5581`。
证据为本地源码、现有 authority 与确认需求；未访问线上演示或 Vben 源码，不能据此宣称完成外部产品对标、线上故障定位或浏览器验收。

当前架构以 [文档手册](../../README.md) 和主题 authority 为准；本目录是任务级研究、需求候选、设计约束和验证账本，不成为新的架构 authority。

## 阅读入口

- [源码核对与差距矩阵](research/findings.md)
- [范围、编号与待决策事项](requirements/README.md)
- [分层设计与公共能力门禁](design/README.md)
- [后续执行协议](design/execution-protocol.md)
- [逐项实施清单与建议顺序](tasks.md)
- [本次文档验证](evidence/verification.md)

## 六项任务映射

原包把最新变更误写为 113；114 已属于 [API 工作台第二轮优化](../114-api-workbench-refinement/README.md)。
本次只使用变更编号 115，六个候选需求使用独立 VP 编号。原 Task 编号只作来源映射，不再作为新的变更编号；未来真正实施时重新检查最新序号，分配独立变更账本并回链这里，不预占 116～119。

| 候选 ID | 原编号   | 需求                                                            | 校准结论                                                 |
| ------- | -------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| VP-01   | Task 114 | [显式 Mock 演示与快捷角色登录](requirements/VP-01-demo-auth.md) | 复用认证；快捷凭证为缺口；自动降级排除，滑块和重置待决策 |
| VP-02   | Task 115 | [Shell、页签与命令扩展](requirements/VP-02-shell-navigation.md) | 命令面板已接入；多布局、固定页签等属于候选扩展           |
| VP-03   | Task 116 | [偏好增量、水印与锁屏](requirements/VP-03-preferences.md)       | 复用八分类设置；四分栏替换及安全相关能力待决策           |
| VP-04   | Task 117 | [集合查询与表格生产力](requirements/VP-04-collection.md)        | 复用 DataTable 与列设置示例；工具栏归 Pattern/Feature    |
| VP-05   | Task 118 | [权限呈现与系统管理扩展](requirements/VP-05-access-system.md)   | 权限码、操作门控和角色编辑已有；新系统模块待业务定义     |
| VP-06   | Task 119 | [图表与分析场景评估](requirements/VP-06-analytics.md)           | 未发现原提议图表契约；首页双大盘与确认需求冲突，暂缓     |

所有产品任务均未实施、未验收。后续执行只处理用户明确要求的范围，不能把文档校准完成等同于产品功能授权或完成。
