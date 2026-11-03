# 设计与自主决策

记录本轮为解决"对标差距但受既有架构约束"所做的产品/技术决策。所有决策都可从当前源码
复核，不是计划。

## D-01 菜单业务覆盖的所有权：Host Store + Port

- 问题：菜单管理必须真正影响侧栏，但 Host 不得 import Plugin 内部实现，Plugin 不得
  自建路由/导航真相。
- 决策：持久化真相放 Host（`apps/web/src/state/use-navigation-admin-store.ts`，
  key `clouddrive.navigation-admin` v1）；Plugin 通过
  `@clouddrive/plugin-framework/navigation-admin` Port 读写；Shell 在
  `useProductNavigation` 应用覆盖（可见性/排序/权限码/标题）。
- 结果：同一份数据驱动"菜单管理页"和"侧栏"，不存在预览与生效不一致；部署期
  Registry 仍是路由/组件唯一真相。
- 失败语义：损坏记录拒绝覆盖，页面提供显式恢复；写入按节点 `version` 乐观并发。

## D-02 布局模式只做三种

- Vben 7 种布局。项目导航模型只有 Group → Parent → Child，双列菜单/内容全屏没有对应
  信息架构；因此实现 `vertical`（侧边）/`horizontal`（顶部）/`mixed`（顶部分组 + 侧栏
  子级），其余以现有密度/内容宽度/侧栏策略等效。
- Shell 通过 `ShellRoot layout` 的 `data-layout` 切换网格列，不复制第二套 Shell。

## D-03 页签：固定 + 操作菜单，不做拖拽

- 保持 Surface authority 的"访问顺序"；用**可聚焦操作菜单**替代右键菜单（键盘/触摸更好），
  并提供固定（置顶、不可关闭、批量关闭保留）、关闭左右/全部/刷新、中键关闭。
- 固定状态入页签 store（sessionStorage），恢复时保留。

## D-04 偏好：新增第九分类而不是扩展旧分类

- 水印/空闲锁屏属于"安全与隐私"，塞进外观或可访问性会污染语义；因此新增分类
  （`security`）+ 字段（`appearance.colorWeak/grayscale`、`navigation.layoutMode`）。
- `PREFERENCES_VERSION` 1 → 2；旧记录按字段默认补全（`validatePreferences` 已具备），
  不需要破坏性迁移；跨窗口快照要求全部分类存在，避免静默丢字段。

## D-05 不做滑块验证

- 演示登录中的滑块不增加任何真实安全性，且会制造"已做安全校验"的错觉。
- 以真实角色快捷登录 + 明确模式说明 + 可重置演示数据替代，符合
  "客户端交互不冒充安全认证"。

## D-06 锁屏是客户端锁定

- 复用现有 AuthService 做密码复核（真实走 PBKDF2 / fixture 校验），失败保持锁定。
- 文案明确：清除本地存储或新开标签页即可绕过，不改变会话有效期、不构成授权边界。
- 状态用 sessionStorage（刷新仍锁、新标签页不继承），账号切换丢弃上一账号锁定。

## D-07 水印由 Host 拥有

- 需要当前账号身份、覆盖整个 Shell 且 `pointer-events: none`；放 Host 避免
  Foundation 反向依赖身份。
- 视觉上使用 `ds-ink` + 低不透明度 + 旋转网格；`aria-hidden`，不进可访问树。

## D-08 图表自建 SVG primitive

- 不引入图表依赖（体积/主题/可访问性不可控）。`packages/ui-adapter/src/charts` 提供
  Area/Donut/Bar/Sparkline + 纯几何 `scale.ts`。
- 语义 token 上色（`chart-1..5` 已进 Design System schema 与生成物）、`viewBox` 响应式、
  `role="img"` + 隐藏数据表、数据点 roving tabindex 方向键导航、零动画（天然 reduced motion）。

## D-09 表格能力提升为共享组合

- 列设置/密度/导出原本是 page-archetypes 私有实现，不能跨插件复用。
- 提升到 `surface-foundation/collection-tools` + `core/table` 纯函数，业务页（users/audit）
  与 Showcase 同源；DataTable 扩展固定列、树形行、三档密度，但不接管请求/搜索/导出。

## D-10 演示重置保留界面偏好

- "重置演示数据"只清业务/身份记录（`clouddrive.*` 除 `clouddrive.shell`），
  避免把演示重置变成"丢失个人偏好"；重置后整页重载重新播种。

## D-11 权限呈现沿用既有 RBAC

- 不新建权限缓存或第二条授权路径：按钮级门控继续用 `useProductAccess`，系统管理插件用
  `settings.update` 判定写权限；拒绝态只读 + 原因，数据服务仍是授权边界。
- 菜单覆盖的"权限码"只决定入口呈现，不放宽任何真实权限。

## 已知限制（不伪造）

- 无后端联调：系统管理/分析/工作台数据均为演示数据，页面明确标注。
- Vben 演示后端 503，其 CRUD 细节未被观察，相关对标只基于结构与空/错态。
- 虚拟滚动、单元格/行内编辑、拖拽排序、13 色板、px 圆角/字号未实现，原因见上。

## D-12 产物预算：Route 按需加载 + HeroUI 组件级 CSS

- 现象：六类能力落地后 `performance:check` 失败 —— initial 525,476 B / maxRoute 590,082 B /
  CSS 50,176 B（预算 409,600 / 445,440 / 49,152）。
- 根因一：生成器让 Host 静态 `page` 直接 re-export 页面实现，页面依赖被提升进所有
  Route 的公共 chunk（`/system/departments` 490 KB，其中表单单选/Dialog/表格被每个
  页面首屏加载）。
- 根因二：`@heroui/styles` 全量入口把 84 个组件样式（含未使用）打入单一 CSS；新增页面
  只是让基线进一步逼近上限。
- 修复一：静态 `page` 的 Host adapter 改为 client `next/dynamic` 外壳（保留 SSR，无文案
  占位），页面模块作为独立 chunk 按需拉取；带 `generateStaticParams` 的动态 page 与
  layout/loading/error 保持 re-export（构建期枚举与 SSR 语义不变）。
- 修复二：`packages/ui-adapter/src/styles.css` 从 `@import '@heroui/styles'` 改为
  base/theme/utilities/variants + **实际使用组件的样式**（Calendar/DatePicker 相关
  `calendar-year-picker`、`scroll-shadow` 等必须保留）；`tw-animate-css` 需在 Host
  入口紧跟 `tailwindcss` 之后导入（`@apply fade-in-0` 依赖其工具类），已登记为
  `apps/web` 受治理依赖。
- 随之修复：滚动策略从"Link 点击处"提升到 `RouteTransition` 的 Route 层（命令面板、
  程序化导航也遵循同一偏好）；DataTable 表头文字改为 `text-ink`（12px 粗体在
  `surface-muted` 上对比度 4.24 不达 AA）。
- 结果：initial 406,695 B（≤409,600）、maxRoute 431,115 B `/login`（≤445,440）、
  CSS 48,567 B（≤49,152），全部通过，未提高任何阈值；`@heroui/styles` 组件清单成为
  UI Adapter 的维护项：新增 HeroUI primitive 时同步补 import，遗漏由视觉基线兜底。
- 代价：静态页首屏多一次页面 chunk 请求（管理后台内网场景可接受）；不使用
  `loading` 文案，避免引入 Host 之外的 i18n 依赖。
