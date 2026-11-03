# 实施设计

依序：Host/Overlay → 公共空间契约 → 设置 → 标签/导航 → 数据/列宽 →
Reference/示例 → 文案/Showcase → 完整门禁。公共 API 只增加有消费者的语义能力，
Vendor props/slots 不外泄；Plugin 提供字段/实体身份，Host 管路由和 Browser 生命周期。
所有新增持久化字段显式白名单与版本迁移，视觉基线只能人工确认。

## 已实施的职责划分

| 能力     | Owner 与装配                                                             | 兼容规则                                                         |
| -------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 手机导航 | Web Host 装配左 Drawer，桌面和浮层复用 Surface 导航内容                  | 手机 `<64rem`，桌面 `lg`；越界关闭和解除锁定                     |
| 路由目标 | Plugin 提供 query/fragment，Registry 解析；Next Host 执行链接与命令导航  | Next 仍唯一 Router，修饰键和新标签行为保留                       |
| 字段定位 | Settings 提供稳定字段片段，Host 等待路由提交和浮层退出后聚焦             | 同路由也定位；新的定位请求取消旧等待，卸载清理                   |
| 页面标签 | Host 消费既有 Catalog 和已提交 h1；Shell Store 保存访问顺序/最后 href    | pathname 作为身份，查询和片段不产生重复标签；原 key 显式 v2 迁移 |
| 表格列宽 | Adapter 使用正式 ResizableContainer/ColumnResizer；Plugin Store 保存数值 | 按 column id 保存，Map 不出 Adapter；宽度不覆盖显隐/顺序/排序    |
| 外观配置 | Design System Schema 与生成器管理七个 appearanceProfiles                 | 保持原值与优先级，生成区域不手改；偏好 key 保持                  |
| 本地资源 | Reference Plugin 私有非持久化 Store 管理 fixture、新建和修改             | 查询 id 必须有效；刷新恢复 fixture，durable 草稿保持原契约       |
| 异步提交 | Form Foundation 管提交入口并发和卸载后的校验回调                         | RHF 保留字段状态/首错；业务操作取消归各自 Owner                  |

公共模块拆分只改变内部依赖粒度，已有 form-field、overlays、data-display 聚合入口
继续可用。CSS sideEffects 显式保留；按需日期、列设置、工作台详情与导出代码降低
生产依赖负担，不复制第二套组件或数据列表。

## 空间与切换契约

- Search 根、Group、Input 和父 Grid 允许收缩；图标和清除按钮保留命中尺寸。
- Field 的说明/错误增加说明区域，单行控制保持自身高度；TextArea 和 Date segment
  保留各自用途。Switch/Radio/Checkbox 文字纵向、可收缩。
- 默认控件消费 density 的 control Token；small/embedded 为明确用途例外。
  Settings 的短枚举选择 row 组合，解释型选择保留卡片，不改全局 Radio 默认高度。
- Toggle 单选保持连续边界并在自身范围横滚，多选独立换行。Tabs 原视觉 Variant
  保留；vertical 在 768 以下同步回退布局、ARIA 与键盘方向。
- 当前项只在选择、内容或尺寸变更时揭示，普通手动滚动不被持续抢回。动态移除或
  禁用当前项时回退首个 enabled 项；溢出提示来自真实滚动范围。
- Dialog 的普通高度由正文滚动，短视口允许整个 Dialog 滚动；HeroUI 继续负责
  Keyboard/Focus/Portal。异步确认不可重复提交或提前关闭，失败保留输入并可重试。

## 任务流程

Settings 保留八路由、三组分类和同一偏好状态。窄空间使用当前分类入口与 Drawer，
搜索显示字段及分类，空结果可清空；恢复操作位于次级区域，存储失败保留会话效果
和重试入口。切分类不重置搜索或草稿。

PageTabs 桌面保持访问顺序，手机显示当前页和完整名称菜单；关闭动作和切换分离。
活动页关闭先等待离开确认，再删除和导航；取消保留路由、输入、标签与进度。
真实上级 Breadcrumb 使用 Host 链接，其余层级使用静态语义。

工作台继续使用同一 Table、selected identity 和详情组件。窄空间选中后打开 Drawer，
桌面使用 SplitView；Browser Adapter 延后一帧打开，让 HeroUI 捕获已经提交的表格
焦点，并清理未完成 frame 和跨断点状态。关闭保留列表焦点/选择/可见位置。
详情在 Drawer 使用 embedded、桌面 outlined；普通内容面不增加 Overlay 层级阴影。
Enter 搜索有可见提交，Clear all 清查询/应用查询/筛选并归一页码，不覆盖列偏好。

Reference 列表、详情、编辑、通知、最近访问和收藏使用同一 query id；缺失/无效
实体显示明确返回入口。Schema 校验必填名称与枚举，成功先更新资源、已保存基线
和草稿，再执行偏好去向；失败不发布成功通知。恢复草稿不覆盖已输入内容。
本地 Archetype/Pattern 的编辑、保存、取消、重试和选择使用确定性状态；静态槽位
明确说明，不保留启用的空动作。本地保存定时器在 Browser Adapter 卸载时清理。

## 内容、动效与验收

首页主入口覆盖组件规范、页面模式和资源流程，数量由 Catalog 推导；Foundations
使用 Universal → Product Surface → Runtime Host 及 Surface × Runtime。
说明/状态/操作归所属 i18n namespace，技术标识和专有名称保留其身份。
手机 Showcase 收起目录并提供真实区段索引；公共能力与业务消费者同源。

不凭感觉调整全局 duration。当前修复聚焦同目标导航、进度、确认与 Settings
持久外层重复进入；连续导航、后退与 reduced motion 使用实际回归判断。
完整检查、局部几何与失败恢复证据见 [账本](../tasks.md)。视觉差异单独提供
[原基线/当前/diff](../evidence/visual-diffs-final/index.html)，不自动更新快照；
真实设备和原生 zoom 的限制不以 Chromium CSS viewport 结果替代。

## Sidebar 专项

展开/纯图标模式的比例、导航交互、状态和边界见[专项审查](sidebar-review.md)。
