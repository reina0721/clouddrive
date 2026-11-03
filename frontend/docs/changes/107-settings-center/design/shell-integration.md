# Shell 集成：导航保护、标签、收藏/最近与工作恢复

## 1. 目标与边界

让 Shell（apps/web + surface-foundation 表现）消费 capability-ports.md 的能力并落地：
启动目标、页面标签、收藏/最近入口、首页工作区段、离开确认、关闭标签策略。**顶部标签是
Shell 表现层**（surface-foundation 若成为跨后台公共 Pattern 需走 Contract 门禁），页面
身份/状态在 Host store（不缓存 React 树）。

## 2. 启动目标（Home/Boot）

首次进入根入口（`/`）时按序解析：

1. 有效的工作恢复目标（若"自动恢复工作"开且存在）→ 2. 最近页面 → 3. 用户指定首页
   → 4. 默认区域首入口 → 5. 当前首页。

- 直接深链接（非 `/` 的显式路径，含 `/settings?category=…`）优先，**不被启动偏好重定向**。
- 失效目标（页面被删/不存在）跳过并落到下一优先项；解析在 Host boot 逻辑（纯函数可测）。

## 3. 页面标签

- 语义：标签 = 页面入口（Route Target + 实体标识），切换仍调用真实 Next Router；
  筛选/排序/分页变化不创建重复标签（标签 key = 页面身份，不含查询态）。
- UI：顶栏标签条（新 surface-foundation 表现组件，若有跨页复用价值走 Contract 门禁，
  否则 Host composition）；每标签 显示 label + 关闭按钮；当前标签高亮。
- 状态（Host store，persist 白名单只存可序列化标签引用：pageId + 静态 href 校验）：
  - 开启标签功能后，访问静态可解析页面产生标签；直达/隐藏页按产品规则决定是否开标签；
  - 关闭当前标签策略：最近使用 / 右邻优先 / 左邻优先（可配）；
  - 最后一个标签关闭 → 回默认首页；
  - "恢复上次打开的标签"默认关；开启后重启恢复标签（只恢复有效页面，失效过滤）。
- 不缓存页面树：标签切换是路由导航，恢复的是本地状态（workspace Port）不是组件树。

## 4. 新页面打开方式

- 偏好：当前页面 / 浏览器新标签页 / 顶部页面标签；只作用于**声明允许**的入口（Plugin/
  页面显式标注 open-behavior 支持），未声明入口保持"当前页面"原生语义。
- 保留原生语义：Ctrl/Cmd+点击、下载、外部链接、表单提交不因偏好改变（用真实 `<a>`
  href + target 表达新标签页，经 Host Navigation Port 的 renderLink 扩展）。

## 5. 收藏/最近

- Host store：收藏（favorites: stable 页面引用数组）、最近访问（recents：带时间戳的
  LRU，上限固定）。收藏/最近记录与显示分别可关（偏好字段）；"关闭记录"停止后续记录，
  **不删除已有内容**。
- 侧栏/首页消费：收藏入口、最近入口、常用命令入口、可恢复工作区段（首页组合见 §7）。

## 6. 离开确认（Leave-confirm）接线

- 页面经 `registerDirtySource` 上报 dirty/提交中/恢复信息（capability-ports.md §3.5）；
  页面自身按既有 form-foundation/surface `requestFoundationFormLeave`/`requestPageLeave`
  契约提供 dirty 判定（它们已存在，现无 Host 消费方）。
- Host 导航统一入口（navigation-lifecycle `shouldProceedWithNavigation` 之前/之内扩展）：
  存在 dirty source → 先弹确认（复用 DialogSurface/ConfirmDialog 语义，非浏览器原生框，
  除非导航来自浏览器 UI）；确认通过才 proceed；**取消不改变路由/标签/进度**；导航结果
  complete/cancel/fail 由既有导航事务层收敛（103 产物），leave-confirm 只加前置询问。
- 刷新/关闭：仅当存在未提交输入时注册 `beforeunload`（returnValue/阻止默认给浏览器提示）；
  接受平台限制（[MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)）：
  不承诺覆盖全部关闭场景，配合草稿恢复兜底（workspace Port）。
- 应用内任何导航入口（侧栏/命令菜单/标签/账户/文本链接/Port navigate）都过统一判定，
  避免"只防侧栏不防其它"。

## 7. 首页工作区段与命令

- 首页（`apps/web/src/app/page.tsx` 现为 Overview）扩展为含：收藏、最近访问、常用命令、
  可恢复工作区段的"工作台"首页——复用现有 Page/Section/Card 组合，不做可拖拽设计器。
- 可恢复工作区段数据 = workspace Port 的恢复目标列表（仅列出可恢复且页面仍有效者），
  点击跳转并按页面恢复规则还原（URL 优先）。
- 常用命令 = commands 注册表中 scope 适配首页/全局的命令子集（同一执行函数与可用性）。
- 首页文案与空态（无收藏/无最近/无可恢复）齐备；若"默认首页"偏好 = 该首页则启动落在
  `/`。

## 8. 快捷键统一注册（Shell/Host）

- Host 键盘监听统一层（替代 app-shell 内散落的 Ctrl+K 处理与未来新增）：注册表消费
  commands 能力；输入框/输入法组合期间避让普通导航命令（isTypingTarget 判定 +
  composition 事件检查）；保存只在当前表单可提交时生效（dirty source + 可提交判定）。
- 保留 `Ctrl/Cmd+K` 打开命令菜单；其余 `Alt+Shift` 组：搜索、新建、保存、返回、页面切换、
  关闭当前标签（不占用浏览器 Ctrl+W 关闭标签页语义）。
- 快捷键列表查看/搜索/提示开关节落在设置"快捷键"分类；关闭快捷键后全局监听停止（注册
  保留但不可用，恢复即开）。

## 9. 验证方案

- 单测（纯函数）：启动目标解析（含失效跳过/深链接优先）、标签 key 唯一（筛选变化不重复）、
  关闭策略选择、recents LRU 上限、恢复过滤失效页面、快捷键组合/避让。
- Host/e2e：离开确认取消不改路由与进度、连续导航、浏览器返回、beforeunload 仅在 dirty
  注册、双窗口草稿冲突、关闭标签最后一枚回首页。
