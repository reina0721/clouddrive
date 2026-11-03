# 107 研究档案 README

本目录保存 107 设置中心（独立 /settings 设置插件 + 页面标签/通知中心/本地草稿/搜索历史/
收藏/最近/工作状态恢复/命令/快捷键）的研究证据快照。研究基线 revision `77740c19`
（工作区干净，2026-09-06）。研究只读，未修改文件、未启动服务、未执行实现验证；
SET-002 起的外部复核证据见 R107-004（只读采集，gitignored 截图不入库）。

## 检索与复用

- 记录按 `R107-<语义名>/metadata.yaml + report.md` 组织；检索先看 metadata 的
  question/keywords/applicable_scenarios/status/refresh_triggers。
- 实施入口按根 [研究档案与报告](../../../research/README.md) 流程复用：记录快照与 revision，
  只把与研究边界相交的变更与各记录 refresh_triggers 比较；命中才定向复核，未命中记录
  "基线未漂移"直接实施。

## 记录索引

| ID                                                            | 主题                         | 状态   | 回答                                                                                                                   |
| ------------------------------------------------------------- | ---------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| [R107-001](R107-001-settings-architecture-state/report.md)    | 当前架构与能力缺口快照       | active | 偏好页真实行为、Shell store、侧栏手风琴、导航生命周期、缺失能力清单、删除引用面                                        |
| [R107-002](R107-002-settings-capability-placements/report.md) | 公共能力落点与边界           | active | preferences/workspace/notifications/commands Port 与产品偏好模型归属（framework 子路径 + surface subpath + Host 装配） |
| [R107-003](R107-003-design-system-accent-density/report.md)   | Design System 主题扩展与校准 | active | 强调色×对比度×密度×字号×内容宽度×动效语义映射、DatePicker locale/weekStart、表格 Resizable/列能力、TailAdmin 复核门禁  |
| [R107-004](R107-004-tailadmin-settings-review/report.md)      | TailAdmin 外部复核证据       | active | 四组页面（表格/Tabs/表单/通知）可达性与 DOM/控件/状态证据、截图清单、四套强调色 WCAG 候选计算                          |

## SET-002 进展（外部复核门禁）

- R107-004 已记录：TailAdmin 可达（HTTP 200）与四组页面 DOM 证据 + 截图
  （test-results/tailadmin-review/，gitignored）。
- **尚未完成（不标 SET-002 完成）**：交互态/Dark 变体/中英长文本/三档视口逐项复核的
  像素级目检与视觉基线人工确认（本模型无图像输入；属 SET-008 人工门禁）；
  四套强调色终值选配确认（候选对比度已算，待产品/视觉复核锁定）。
