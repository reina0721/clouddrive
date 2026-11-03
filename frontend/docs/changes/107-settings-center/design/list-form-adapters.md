# 列表、表单与地区适配

## 1. 目标与边界

把设置中心的数据展示/操作偏好/语言与地区分类接到真实列表、表单、搜索与日期/数字/相对时间
场景：列能力与记忆、草稿、提交去向、聚焦、刷新、搜索历史、地区格式工具。**每项设置必须有
真实消费者**（不能只在设置页证明控件选中/存储变化）。设计依据 R107-001/R107-003。

## 2. DataTable 列能力扩展（ui-adapter，走 foundation 门禁）

现状：`DataTable`（packages/ui-adapter/src/data-display.tsx）受控 selection/sort/density/
empty/粘性表头，无列宽/列序/列显隐。
扩展（Element→Variant→Composition 无法表达时才进公共契约，登记 foundation-contracts，
并在 /ui-elements/data 复核后落 Showcase）：

- 列宽：复用 HeroUI v3 `Table.ResizableContainer`/`ColumnResizer`（已装未透出），经
  ui-adapter 语义 props（不暴露 vendor）包成受控列宽（`columnSizes` + `onResize`）。
- 列顺序：可键盘操作的前移/后移按钮（每列操作菜单/按钮，`aria` 完整；不做 drag）。
- 列显隐：受控 `visibleColumnIds`（必要标识列不可隐藏；恢复时过滤已退役列）。
- 密度/分隔/固定表头：密度接全局 density 偏好；分隔 Variant 只从现有设计允许的 Variant
  取；固定表头 = 现有 sticky header class 受控。
- 长文本：截断（默认，line-clamp + tooltip reveal）或换行（偏好）。

## 3. 列表状态记忆（覆盖值优先级）

- 优先级固定：业务强制约束 > 当前显式操作或 URL > 已保存页面覆盖 > 全局默认。
- 具体列表通过**稳定页面 ID + 列 ID** 保存覆盖值（pageId 在页面显式声明；不是 URL 派生）。
- 记忆项按偏好开关：列布局（宽/显隐/序）、排序条件、筛选条件、分页位置；各列表默认值 =
  全局默认；列布局记忆默认开、排序/筛选/分页记忆默认关（新用户默认值表）。
- 恢复：分页在筛选/删除/页大小变化后校正到有效页；不恢复危险的批量选择状态；返回列表
  恢复已允许保存的筛选、分页与滚动；显式 URL 条件优先。

## 4. 草稿（页面显式允许字段）

- 页面声明 `draftFields`（白名单）；开启"自动保存"后，表单 dirty 时经 workspace Port
  写本地草稿（防抖受产品预设，不暴露毫秒）；恢复草稿仍是未提交语义；业务提交成功后清草稿；
  **提交失败不清**；多窗口/刷新冲突不静默覆盖（保留选择）。
- 表单基建：form-foundation 已提供 dirty/错误聚焦（shouldFocusError:true = 首错误定位
  默认开）。首字段聚焦偏好默认关：开启后在表单挂载聚焦第一个可编辑字段（可聚焦性判定）。
- 离开提醒：表单 dirty + 页面离开 → leave-confirm（shell-integration.md §6）；重置前确认
  （form.reset 前弹确认）。

## 5. 提交去向与危险操作

- 创建/编辑成功去向：仅在**真实成功回调后**执行（参考场景本地任务的真实 then/完成）；缺
  少详情目标的页面明确说明"进入详情"不适用（禁用该选项 + 说明）。
- 删除/批量/清空确认：删除用 `ConfirmDialog`/`DestructiveConfirmDialog`；危险操作既有
  **输入确认**（如输入名称）不被全局偏好削弱（产品规则高于偏好）；全局"删除确认"关闭
  时仅关二次确认层，不解除输入确认。
- 复制反馈：复制动作（Clipboard API）成功/失败后 Toast 反馈（偏好可关）；公共复制助手
  若有跨页复用价值进 ui-adapter（登记），否则页面本地组合（至少两个消费者才提公共）。

## 6. 刷新策略

- 偏好：关闭 / 仅页面重新进入时 / 定期刷新（统一 60s 预设常量，不暴露毫秒）。
- 定期刷新实现（Host 计时器 + 页面注册）：后台（visibilitychange hidden）、离线
  （navigator.onLine/online-offline 事件）、提交中暂停；不并发重入（已有刷新在跑则跳过）；
  不覆盖未提交编辑（dirty 时暂停自动刷新或仅提示）；页面卸载清理计时器。

## 7. 搜索行为与历史

- 搜索时机：输入后自动搜索（防抖产品预设）/ Enter 后搜索（偏好）。
- 最近搜索记录（记录开关 + 上限）、显示搜索历史（显示开关）、显示搜索建议（默认开）、
  清空搜索历史（独立明确操作；关闭记录/显示不删已存）。
- 各页面最近一次搜索条件保留（页面状态记忆，可关）。
- 设置搜索自身（settings-plugin.md §6）不落入业务搜索历史/不受搜索时机偏好影响。

## 8. 地区格式（i18n 工具扩展）

现状：`formatDate/formatNumber/formatRelativeTime`（Intl）存在；无周起始/时区/纯日期
防偏移工具；DatePicker 未接界面语言与周起始（RAC I18nProvider 未装配，Calendar
firstDayOfWeek 已可用）。

- 需要新增（i18n 包内，均为纯 Intl 封装，Feature 不直接 new Intl.*Format）：
  - `formatDateOnly(locale, date)`：按日期格式偏好输出**纯日期，不因时区发生日期偏移**
    （用 date 的本地分量组装，不做 UTC 转译）；
  - 带时区的时间格式：`formatTime(locale, date, { timeZone, hour12, showSeconds })`；
  - 相对时间：近似"5 分钟前"（Intl.RelativeTimeFormat 现有）或精确时间（偏好切换）；
  - 周起始/语言无关的星期工具（纯函数，供日历 firstDayOfWeek）。
- DatePicker/Calendar 装配：Host 按界面语言装配 RAC `I18nProvider`（locale）+ 一周起始日
  （偏好 mon/sun → Calendar firstDayOfWeek）；数字格式跟随地区（formatNumber 现有）。
- 时区：自动 = `Intl.DateTimeFormat().resolvedOptions().timeZone`；指定 = IANA 字符串
  （SelectField 受控列表：Common + 主要城市，有限集合）。
- 所有日期/时间/数字/相对时间/单位统一 i18n 输出；业务不裸写。

## 9. 参考场景（≥2 个独立消费者验证公共 Pattern）

- 资源列表（reference-resources 或 page-archetypes/resource-list 升级为真实交互参考）：
  列宽/列序/列显隐、分页/筛选/滚动恢复、批量/删除确认、复制反馈、搜索时机与历史。
- 创建/编辑/详情（page-archetypes/create-edit 或 reference-resources create/edit 扩展）：
  草稿自动保存与恢复、提交去向、离开/重置确认、首字段/首错误聚焦、地区格式。
- 参考数据保持确定性本地用途；新增本地会话操作明确标注"参考范围"，不伪装后端保存或任务。
- **同一公共 Pattern 至少两个独立场景**（不在设置页内部自证）。

## 10. 验证方案

- 单测：列布局记忆（含退役列过滤/标识列保留）、分页校正、草稿白名单/失败不清除、搜索
  历史上限/清空、纯日期不偏移（跨时区固定用例）、相对/精确时间切换。
- e2e：参考场景真实链路（改列→刷新→恢复；编辑→离开→确认/取消；草稿→刷新→恢复→提交→
  清除）、定期刷新暂停（后台/离线/提交中）。
