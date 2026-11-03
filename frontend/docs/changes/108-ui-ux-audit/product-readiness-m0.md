# clouddrive 产品补齐：M0 审计与实施基线

审计日期：2026-10-12（Asia/Shanghai）。本报告承接 [108 审查](README.md) 与 [109 优化账本](../109-ui-ux-optimization/tasks.md)，保留历史结论并补充当前源码和浏览器证据。当前指令只授权 M0；M1–M7 是待确认计划，本轮没有修改产品代码、架构、导航或视觉基线。

## 1. 结论与证据边界

**现有项目已经具有可复用的后台产品 Foundation、实际生效的个人偏好和完整的前端认证流程；尚未形成通用管理业务的数据、授权与操作闭环。** 首页、开发导航及 Reference 内容不能作为用户管理、角色管理或审计系统的完成证明。建议保留现役体系，在明确的数据边界上逐模块增加业务，不更换 UI、Router 或状态管理。

本次核对了真实 Next 路由文件、generated catalog、Shell、认证两种 Adapter、五类 Host Store、设置模型、Reference Store、UI/Pattern 实现、测试和当前 authority。仓库根本身就是统一前端根，实际位置为 `apps/`、`packages/`、`surfaces/`；这里没有额外 `frontend/` 子目录。未读取 legacy product 或后端仓库。

线上入口：[授权演示站](https://console-proxy.admin3808.workers.dev/)。实测显示为 Mock 认证环境。使用演示身份登录；没有修改密码、授予权限、发送消息、开启桌面通知授权或接触真实业务数据。本地 `http://127.0.0.1:4173` 亦实测登录、首页与资源列表。线上构建版本没有公开可核对的 commit 标识，因此不能断言线上产物与本地 HEAD 字节一致。

38 个 Plugin 路由均逐页打开并保存 DOM，另检查首页和认证/公共/未知路径。入口重定向、缺失资源标识、登录 Gate 单独分类；并不将能打开页面等同于完成所有交互和全部状态验收。桌面 1440×1000、手机 390×844、平板 768×1024 用于关键交互采样；完整多视口、Axe、视觉与 Backend 受控协议由项目原有门禁提供独立证据。真实 REST 服务未提供，真实后端联调未完成。

浏览器原始记录：[路由 DOM](evidence/product-m0/online-routes.json)、[公共/认证页](evidence/product-m0/online-public-auth.json)、[创建结果](evidence/product-m0/online-create.txt)、[编辑后详情](evidence/product-m0/online-edit-detail.txt)、[刷新边界](evidence/product-m0/online-create-reload.txt)、[批量已读](evidence/product-m0/online-notifications-read.txt)、[手机详情](evidence/product-m0/online-mobile-detail.txt)、[本地首页](evidence/product-m0/local-home.txt)、[本地资源](evidence/product-m0/local-resources.txt)。最终检查见 [验证记录](evidence/product-m0/verification.md)。

## 2. 全部路由与页面分类

权威来源为 `surfaces/generated/catalog/catalog.ts`（9 Plugins / 38 routes）和 `apps/web/src/app` 的 Host 页面。总计 **43 个具体 URL 路由**：38 Plugin + 首页 + 4 公共/认证页。Next `not-found` 是未知 URL fallback，不额外算业务路由；不存在 `/users`、`/roles`、`/permissions`、`/notifications`、`/audit-logs` 或个人账户管理路由。首页的“39 页面路由”只统计 Plugin 与首页，未包含 4 公共/认证页，不能作为管理功能数量。

| URL                                | 当前用途与实际边界                                     | 分类                  | 后续处置                                 |
| ---------------------------------- | ------------------------------------------------------ | --------------------- | ---------------------------------------- |
| `/`                                | 架构指标、能力说明、建设轨迹；收藏/最近是真实本地记录  | 说明型首页，待产品化  | 工作台替换内容，保留真实工作入口         |
| `/welcome`                         | 独立公共欢迎页                                         | 正式公共入口          | 保留，随产品定位校正文案                 |
| `/login`                           | 邮箱密码、校验、显示密码、Pending、错误、内部 returnTo | 正式认证              | 复用；Backend 待联调                     |
| `/register`                        | 姓名邮箱密码注册与成功反馈                             | 正式认证（Mock 可用） | 保留显式演示；正式是否开放注册按后端策略 |
| `/session-expired`                 | 会话失效恢复入口                                       | 正式异常流程          | 保留，与业务请求 401 联动                |
| `/foundations`                     | Universal/Surface/Host 地图和约束                      | 说明/开发 authority   | 开发中心                                 |
| `/motion`                          | Content Swap、Disclosure、Reveal 与 Inspector          | 开发 authority        | 开发中心，保留同源 Recipe                |
| `/states`                          | Loading/Empty/Error/Offline/Denied 等示意              | 开发 authority        | 开发中心；不当作授权计算                 |
| `/system-tools/icons`              | 图标查询工具                                           | 开发辅助              | 移到开发中心导航，保留 URL               |
| `/reference-resources`             | 三个 fixture 与本地新增结果                            | 可操作开发示例        | 开发中心，保留演示边界说明               |
| `/reference-resources/create`      | 本地创建、校验、草稿、成功去向                         | 可操作开发示例        | 保留验收流程                             |
| `/reference-resources/detail?id=…` | 真实选中资源、收藏、复制、详情                         | 可操作开发示例        | 保留 query；缺失/无效 ID 有恢复入口      |
| `/reference-resources/edit?id=…`   | 本地更新、重置、离开保护                               | 可操作开发示例        | 保留；不宣称服务端保存                   |
| `/settings`                        | 外观：主题/强调色/密度/字号/宽度/动效/对比度           | 正式个人偏好          | 保留 URL，入口称“个人偏好”               |
| `/settings/navigation`             | 导航/页签/侧栏/最近/收藏/工作恢复                      | 正式个人偏好          | 保留及兼容旧记录                         |
| `/settings/data-display`           | 表格/列状态记忆/阅读偏好                               | 正式个人偏好          | 复用到管理列表                           |
| `/settings/actions`                | 保存去向/草稿/确认/聚焦/刷新/搜索                      | 正式个人偏好          | 复用，不改变全局默认                     |
| `/settings/locale`                 | 界面语言/地区日期时间格式                              | 正式个人偏好          | 保留，补业务文案                         |
| `/settings/notifications`          | 提示与通知渠道/收纳偏好                                | 正式个人偏好          | 保留；与通知数据页面区分                 |
| `/settings/accessibility`          | 焦点/辅助与交互偏好                                    | 正式个人偏好          | 保留                                     |
| `/settings/shortcuts`              | 快捷键偏好                                             | 正式个人偏好          | 保留，命令 availability 随权限调整       |
| `/page-archetypes/overview`        | 固定摘要、参考审查队列                                 | 完整页面示例          | 开发中心，不改成真实工作台               |
| `/page-archetypes/resource-list`   | 48 条确定性工作流；筛选/排序/分页/列/详情/导出         | 完整页面示例          | 复用组件与组合经验，业务数据重新拥有     |
| `/page-archetypes/detail`          | 固定实体与活动示例                                     | 完整页面示例          | 开发中心                                 |
| `/page-archetypes/create-edit`     | 复杂配置/审批本地表单场景                              | 完整页面示例          | 开发中心；不新增虚构审批业务             |
| `/page-archetypes/settings`        | 配置表单组合示例                                       | 完整页面示例          | 开发中心，与正式偏好区分                 |
| `/page-archetypes/master-detail`   | 固定资源主从呈现                                       | 完整页面示例          | 开发中心                                 |
| `/page-archetypes/operation`       | 本地操作生命周期演示                                   | 完整页面示例          | 开发中心，不作为后端任务队列             |
| `/page-patterns/layout-navigation` | Page/Header/Toolbar/布局组合                           | Pattern authority     | 开发中心，真实业务同源                   |
| `/page-patterns/collections-data`  | Collection/筛选/批量/分页组合                          | Pattern authority     | 开发中心，真实业务同源                   |
| `/page-patterns/forms-actions`     | FormActions/Sticky/生命周期                            | Pattern authority     | 开发中心，真实业务同源                   |
| `/page-patterns/states-feedback`   | StateRegion/Operation 恢复示意                         | Pattern authority     | 开发中心，真实业务同源                   |
| `/page-patterns/detail-settings`   | EntitySummary/Timeline/SettingsLayout                  | Pattern authority     | 开发中心，真实业务同源                   |
| `/ui-elements`                     | Next replace 到 actions-selection                      | 正式开发入口重定向    | 保留，非空白占位页                       |
| `/ui-elements/actions-selection`   | Action/IconAction/ToggleGroup                          | UI authority          | 开发中心                                 |
| `/ui-elements/feedback`            | Alert/Badge/NotificationCard/Toast                     | UI authority          | 开发中心                                 |
| `/ui-elements/status-async`        | 状态/进度/骨架/LiveRegion                              | UI authority          | 开发中心                                 |
| `/ui-elements/identity-display`    | Avatar/UserIdentity/Image/DescriptionList              | UI authority          | 开发中心                                 |
| `/ui-elements/navigation`          | Link/Breadcrumb/Pagination/Tabs/Tree                   | UI authority          | 开发中心                                 |
| `/ui-elements/data`                | DataTable、Selection、Sort、列宽                       | UI authority          | 开发中心                                 |
| `/ui-elements/surfaces`            | Card/Panel/embedded composition                        | UI authority          | 开发中心                                 |
| `/ui-elements/forms`               | Fields/Pickers/ErrorSummary                            | UI authority          | 开发中心                                 |
| `/ui-elements/overlays`            | Menu/Popover/Dialog/Confirm/Drawer/Command             | UI authority          | 开发中心                                 |

未发现以“用户管理/角色管理”等标题包装的空白路由；主要问题是正式业务缺席和开发内容混在产品入口，而非存在大量空页面。Reference 直接打开 detail/edit 不带 ID 的缺失状态是有效恢复体验，不应误算为路由坏了。Showcase 的固定活动、权限场景、任务演示有明确验证用途，不应删除，也不能作为业务功能完成。

## 3. 已有能力与缺口逐项复核

| 能力           | 已实现且可复用                                                                                               | 当前缺口/影响                                                                  | 源码依据                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Shell/Router   | Next 唯一 Router、三类 route group、Plugin codegen、导航进度、移动 Drawer、Compact Flyout、leave confirm     | 正式业务导航、权限可见性和直达 Gate 未实现                                     | `apps/web/src/shell/`、`host/`、`surfaces/generated/`                                   |
| 全局搜索       | 从同一导航树生成入口，注册页面/全局命令；实测筛选跳转                                                        | 不是服务端实体搜索；未来需按可用权限过滤命令与入口                             | `shell/app-shell.tsx`、`host/commands-port.ts`                                          |
| 页签/最近/收藏 | PageTabs sessionStorage v2、workbench localStorage v1；query 目标记录和限量                                  | 新实体 identity、旧标题随 locale 更新、失效目标恢复需覆盖                      | `state/use-page-tabs-store.ts`、`use-workbench-store.ts`、两个 recorder                 |
| 个人偏好       | 八分类、即时生效、语义预览、字段搜索、恢复确认、迁移及受控 partialize                                        | 未提供系统级共享配置；不是 API 配置管理                                        | `surfaces/src/preferences-model.ts`、settings Plugin、`use-shell-store.ts`              |
| 认证           | 唯一 AuthService/controller、Guest/Protected Gate、Mock 登录注册/恢复/退出/过期；Backend Cookie/CSRF Adapter | 真实后端待联调；身份无角色/权限/头像/状态字段；无 Profile 更新和密码维护       | `apps/web/src/auth/contract.ts`、两 Adapter、controller、README                         |
| 账户菜单       | 姓名邮箱来自当前会话，语言/主题显式选择、设置和退出                                                          | 无个人账户页；不得另建固定用户资料源                                           | `shell/account-menu.tsx`                                                                |
| 账户隔离       | 身份切换前清理私有记录/Host Store，新文档丢弃 Plugin 缓存，设备偏好保留；跨标签失效通知                      | 新 Mock 系统数据的生命周期需评估，不能被宽泛前缀清理误删                       | `auth/account-boundary.ts`、`runtime.tsx`                                               |
| 通知           | 前端事件发布、Drawer、未读角标、单项/全部已读，50 条本地保留，关联 Route Target                              | 无完整路由、详情/分类查询、服务端通知和读状态；不支持分页或服务失败            | `shell/notification-center.tsx`、`state/use-notifications-store.ts`、notifications Port |
| Reference 资源 | 真正本地 create/edit/list/detail 同步、草稿、校验、离开保护与通知                                            | 内存 Store 刷新回 fixture；无请求/权限/服务器分页；不能作为通用管理 API Mock   | `surfaces/plugins/reference-resources/stores/resources.ts`、`src/resource-form.tsx`     |
| 数据工作台     | 48 条可复现 fixture，搜索/排序/分页/列布局/列宽、批量反馈、手机详情                                          | 领域是验证工作流，不是用户；Offline/Permission 是选择的场景；刷新不查询 API    | `page-archetypes/src/resource-list-page.tsx`、`reference-scenarios.ts`                  |
| 请求与 Mock    | 认证真实 fetch Adapter；MSW createMockServer 仅 test/显式预览                                                | 没有全业务模式配置、HTTP 协议、管理仓储、分页/错误 Schema、授权关系、业务 Mock | `auth/config.ts`、`backend-adapter.ts`、`apps/web/src/test/mock-server.ts`              |
| 403/404/错误   | auth forbidden 反馈、session-expired、根 not-found 与恢复入口、Error Boundary/StateSurface                   | 无资源/操作级权限、业务 401/403 联动；静态部署未知 URL 回源行为需验收          | `auth/status-surface.tsx`、`app/not-found.tsx`、`host/error-boundary.tsx`               |
| i18n/Motion    | 唯一语言 runtime/formatter、Host Page Enter、Page items Reveal、Reduced Motion、Adapter Overlay              | 英文首页仍含中文入口与门禁文案；新业务需完成文案和格式映射                     | `packages/i18n`、`overview-page.tsx`、`apps/web/src/i18n/resources.ts`                  |

关于历史结论：108 首轮“无认证”、§22 当时“无邮箱/会话”已被 §23 与现役实现替代；手机导航、设置分类 Drawer、移动详情也已补齐，不再照搬旧缺陷。旧报告和失败日志保留，当前状态由本报告与本轮验证明确限定。

## 4. 浏览器实际操作与新发现

1. 匿名访问线上首页进入 `/login?returnTo=%2F`；演示账户登录后到首页。本地同一路径亦通过。没有把登录表单存在误判为真实服务器认证。
2. 桌面命令搜索输入“设置”，出现设置、设置原型、详情与设置三个结果，选择正式设置进入 `/settings`。设置搜索“语言”出现字段结果，点击“界面语言”进入 `/settings/locale#settings-localeRegion-language`，焦点在当前语言控件。导航与搜索均已可用。
3. 账户菜单显示同一身份的姓名/邮箱，切换 English 后 Shell 与主要文案实时变更，菜单选择正确。首页的“组件规范/页面模式/完整资源流程”、门禁项和建设轨迹仍保留中文；属于本次确定的 i18n 内容缺口。恢复简体中文。
4. 创建空名称触发 1–80 字符错误，焦点回名称输入；填写专用演示名称后列表出现第四条。进入编辑改名，返回详情前出现未保存确认，Escape 关闭并保留值、焦点回触发链接；保存后按当前偏好留在编辑，返回详情显示新名称。
5. 创建/保存分别产生通知，角标从 1 到 2；Drawer 展示实际成功事件与目标，全部已读后未读标签及批量入口消失。**刷新新资源详情后资源消失但通知记录保持**：内存资源与 durable 通知目标生命周期不同。对于明确标注的 Reference 可接受，正式产品必须通过持久 Mock/后端及失效目标恢复解决。
6. 手机数据工作台选择 `REF-001` 打开同一记录 Drawer，摘要与 Tabs 可读取；移动主导航打开为独立浮层，选择设置后关闭且到正确路由。未重新完成整套焦点圈定矩阵，不将退出动画中瞬时焦点测量作为稳定焦点结论。
7. 手机设置分类有独立 Drawer 与八个分类。切换深色后刷新，深色单选保持；随后恢复原“跟随系统”。平板导航设置可读取，实测 document scrollWidth 未超 viewport。
8. 本地工作台状态过滤从 48 到 16 条；输入专用不匹配词并搜索变 0，空态有“清除筛选”恢复。清除后可切第 2 页，数据行发生变化。原始证据为 [筛选](evidence/product-m0/local-filter.txt)、[空结果](evidence/product-m0/local-empty.txt)、[分页](evidence/product-m0/local-page2.txt)。
9. 线上退出后检查四个公共/认证页，均有独立内容与有效入口。未知路径 `/m0-unknown-page` 返回项目 fallback，标题/说明/按钮却显示 `auth.notFoundTitle`、`auth.notFoundDescription`、`auth.enterWorkspace`，稍后复查仍然如此；按钮可回到登录入口。本地开发环境相同未知路径显示正常中文。见 [线上 DOM](evidence/product-m0/online-unknown.txt)、[线上截图](evidence/product-m0/online-unknown.png)、[本地 DOM](evidence/product-m0/local-unknown.txt)。这是明确的部署环境文案缺陷，原因需对齐部署版本与生产按需语言注册时序后确认，不能直接认定版本不一致或本地已复现。

审计结束后线上恢复简体中文、跟随系统及匿名状态；本地退出本轮登录；临时 viewport override 已清除。演示资源仅在本次内存中存在，刷新已恢复 fixture。测试专用浏览上下文与原有设备偏好不混为正式账号配置修改。

404 定向续查：再次直接打开未知 URL 仍出现 key，点击现有语言切换后恢复正常英文，再切回正常中文（[前后 DOM](evidence/product-m0/online-404-language.txt)）。因此不是缺少这些翻译内容。源码中 not-found 的文字在父组件计算，而 AuthFrame 按需加载才执行 install-translations；i18n.addResources 增加 bundle。这提示应检查资源注册后的订阅/父组件重渲染与生产拆包时序，属于**基于源码和行为的排查推断**，尚未通过生产复现测试证明根因；M0 不修改公共 i18n 或部署配置。

截图：[创建](evidence/product-m0/online-create.png)、[未保存确认](evidence/product-m0/online-unsaved.png)、[事件通知](evidence/product-m0/online-notifications.png)、[手机详情](evidence/product-m0/online-mobile-detail.png)、[手机导航](evidence/product-m0/online-mobile-nav.png)、[深色偏好](evidence/product-m0/online-mobile-dark.png)、[平板设置](evidence/product-m0/online-tablet-settings.png)。截图是检查证据，未经人工批准不会写入 golden。

## 5. 组件复用判断：无需重建基础体系

| 管理任务       | 优先复用的正式能力                                                                                          | 业务层仍必须实现/验证                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 页面与概览     | Page/PageHeader/Section/Toolbar、Card outlined、Timeline                                                    | 指标口径、查询、允许的动作、真实活动；不复制 overview 原型业务              |
| 用户/角色列表  | Collection、FilterBar、SearchBox、SelectField、DataTable、PaginationControl、BulkActionBar                  | URL 查询、服务器排序/分页、稳定 ID、选择跨页策略、每项结果与权限            |
| 手机列表/详情  | Collection.narrowContent、SplitView、DrawerSurface、TabsView、EntitySummary                                 | 手机摘要卡/必要列 composition、返回位置、实体一致性；无须改全局 Table 默认  |
| 创建/编辑      | useFoundationForm/FoundationControlledField、TextField/Select/Combo/Checkbox、FormErrorSummary、FormActions | 领域 Schema、异步查重、服务字段错误映射、提交版本冲突与 Pending             |
| 角色分配/权限  | Select/Combo/Checkbox/Tree、DescriptionList、Tabs、ConfirmDialog                                            | 资源×操作目录、grant 关系与 protected role；Tree 是呈现，不能充当 RBAC 引擎 |
| 危险操作       | ConfirmDialog/DestructiveConfirmDialog、Action pending、leave-confirm Port                                  | 明确影响、不可撤回范围、失败仍可重试、禁止最后管理员等业务规则              |
| 通知/审计      | DrawerSurface/NotificationCard/Badge、Collection、Timeline、DescriptionList、日期控件                       | 服务端事件/未读状态、日期范围、actor/object/result、只读审计权限            |
| 系统配置/账户  | SettingsLayout、Section、FormActions、UserIdentity、PasswordField                                           | 配置 Schema、save/reload/dirty/error、会话资料更新；密码能力依后端协议      |
| 异常/反馈      | AsyncRegion、StateRegion/StateSurface、PageLoadingSurface、FeedbackProvider、LiveRegion                     | 区分查询 loading、写入 pending、空结果/无权限/离线/失败和恢复路径           |
| 偏好/状态/文案 | state-foundation、preferences/workspace/commands/notifications Port、i18n formatter                         | 只持久 durable 白名单；业务真值归数据层；不把 Server State 搬入偏好 Store   |

DataTable 当前公开受控 selection、sort 和 columnWidths，PaginationControl 独立组合，已足够支持管理列表。不能误认它会自动请求、排序数据或保存权限；这些都由业务查询负责。Form Foundation 已有提交防重复、dirty/pending/reset/首错聚焦，无需自建表单状态机。Overlay 继续由 HeroUI Adapter 提供焦点和键盘语义。

现有 Reference 的列设置、搜索历史与手机 Drawer 编排可作为交互依据；先按业务 composition 使用，不将其全部复制到新 Feature、不扩展为万能 CRUD Page。共享能力若真的缺失，先查全部消费者，再按 Element→Variant→Composition→Pattern→Feature 与 Contract 门禁扩展。M0 无公共 UI 修改，不触发 TailAdmin 新 Element 校准；后续修改公共交互时必须检查相应外部具体页面和内部 authority。

复用不代表全部契约都是 stable：当前 Contract registry 将 UI Adapter/Surface Foundation 登记为 stable，而 state-foundation、plugin-framework 和具体 Surface workspace 仍为 experimental。后续按其现役公开 API 使用，并保持成熟度与验收证据一致；M0 不擅自提升成熟度。Registry 实际源码明确不提供 permission/breadcrumb/command 展示模型，不能因为文档架构摘要提到这些词就判断已具备授权引擎。

## 6. 产品缺口与优先级

P0 表示产品化/Backend 上线的前置条件，不表示现有演示站完全不可运行；P1 是完成管理任务所必需；P2 是闭环后的增强。

| ID / 优先级 | 具体缺口与完成条件                                                                         | 阶段/依赖                         |
| ----------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| CC-01 / P0  | 统一业务 Mock/Backend 选择、领域服务与响应 Schema；Backend 故障不得返回 fixture            | M2，复用认证配置原则              |
| CC-02 / P0  | 当前身份→角色→资源/操作授权关系；隐藏入口、直达与操作都一致，后端独立授权                  | M2 起基础，M4 完整                |
| CC-03 / P0  | Mock 可复现数据与 CRUD 持久性、通知/审计一致事务；与登录账户资料统一                       | M2→M3/M4/M5                       |
| CC-04 / P1  | 产品导航、工作台、开发中心；搜索/页签/最近/收藏兼容                                        | M1，CC-01 后接真实摘要            |
| CC-05 / P1  | 用户列表/查询/分页/详情/创建编辑/状态/角色分配/错误及受保护操作                            | M3，CC-01/02/03                   |
| CC-06 / P1  | 个人账户读取修改并同步会话/UserIdentity；失败不改资料                                      | M3，身份与用户单一事实源          |
| CC-07 / P1  | 角色 CRUD、权限矩阵、成员、系统角色保护、变更影响反馈                                      | M4，用户关联可读                  |
| CC-08 / P1  | 完整通知页/详情/分类/分页/批量已读与顶部一致；服务失败可恢复                               | M5，统一通知领域服务              |
| CC-09 / P1  | 只读审计查询/详情/actor/object/time/result；操作真实生成日志                               | M5，写操作与权限                  |
| CC-10 / P1  | 系统配置与个人偏好分离；读取/保存/校验/冲突/权限/dirty                                     | M6，配置协议与 CC-02              |
| CC-11 / P1  | 业务 401/403/404/离线/协议错误、请求竞态及跨身份缓存清理                                   | M2 持续，各阶段测试，M6 收口      |
| CC-12 / P1  | REST 对接文档：方法/路径/字段/Schema/错误/权限/示例/实现状态                               | M2 建立，各阶段同步，M7 联调      |
| CC-13 / P1  | 桌面/平板/手机、英文/Dark/Reduced、键盘/Axe、全部浮层与任务闭环                            | 每阶段适用检查，M7 全量           |
| CC-14 / P2  | 当前英文首页混合中文、开发术语产品文案；旧记录标题语言恢复                                 | M1 与各阶段 i18n                  |
| CC-15 / P2  | 大数据与长期偏好体验，按真实需求考虑高级搜索/导出                                          | M7 后依据实际使用，非本轮预造     |
| CC-16 / P1  | 线上 404 显示翻译 key，本地正常；对齐部署版本/生产资源注册，验证匿名与登录态直达及恢复路径 | M1 或 M6 边界修复；补生产环境回归 |

本轮没有证据证明需要新 Host、新 UI 框架、Router、全局 Store Registry 或通用权限 Provider。找回密码、邮箱验证、OAuth/MFA、租户、组织、订单/审批、消息推送和复杂图表不自动纳入目标。只有真实协议/需求明确时再评估，避免创造行业业务。

## 7. 建议信息架构与兼容策略（待确认）

正式侧栏按管理任务组织：**工作台；身份与访问（用户、角色、权限）；通知中心；审计日志；系统设置；开发中心**。个人账户和个人偏好由账户菜单进入；保留侧栏个人偏好入口亦可，但必须与系统设置明确区分。页面名称使用面向用户的中文/英文，不把插件数量和 Runtime 名称放在产品首页。

这是最终 IA 的目标图。M1 只为已经实现的能力提供可执行入口，新增管理模块在相应阶段完成操作闭环后再加入导航；不先创建占位路由或无结果按钮来填满侧栏。

开发中心在现有三层 Group→Parent→Child 模型内按能力分组：UI Elements、Page Patterns、Page Archetypes、Foundation/Motion/States、参考资源与图标工具。无需为视觉 IA 更改 Plugin Contract 或增加 page pattern/motion metadata。分组 alias 的变化只在 Surface IA 定义与 i18n 发生，codegen 产物由生成器更新。

兼容优先采用 **移动导航归属而保留 URL/routeId**：`/system-tools/icons`、`/reference-resources*`、`/ui-elements*` 等继续可打开；`/settings*` 保留作个人偏好，系统配置采用独立语义入口（具体新路径在 M2/M6 确定）。不为了“开发中心”前缀批量改名。现有深链、收藏/最近/query、通知 target、homeTarget、自动草稿恢复和页签仍可解析。若后续确需改 URL，需有显式 alias/redirect 和持久化 version/migrate，不能静默换 key。

Shell 搜索继续派生同一导航数据源，新增业务命令经现役 commands Port；权限 availability 同时作用搜索与动作，直达路由另外验证。页签沿用 Host 原生 Router 和 recorder；新实体页面需明确 pathname+query 与实体标签身份，不引入第二个 history。面包屑组合正式 PageHeader，保留未保存离开保护。

现役 PageTabs 按 pathname 去重，href 可保留 query，含义是同一路由换实体时更新同一页签；最近记录的实体 query 目前只明确处理 Reference detail/edit 两条。M3 新用户详情需要先决定沿用“页面入口页签”还是确实要求多实体并列，并补 recorder/restore/prune 的最小兼容修改；不要直接假定已有多实体页签支持，也不为筛选变化重复开标签。

工作台建议仅呈现有实际来源的模块：当前身份可执行的用户/角色入口、用户状态摘要、未读通知及关联入口、允许查看的最近审计活动、真实收藏/最近与未完成草稿。统计必须说明口径/时间范围，可点击到相同筛选列表；无权限不透露统计。无数据/部分失败保持真实状态，不显示假的成功数。没有现成业务任务来源时不放“待审批/收入/增长”图表。

**顺序依赖需明确**：M1 可以完成 IA、产品首页结构和现有收藏/最近等真实模块；用户/权限/通知摘要依赖 M2 及对应模块。M1 不以固定数字或不可执行入口假装首页闭环，M3–M6 接入可用模块后再逐项验收其摘要与导航。

## 8. 数据、认证与权限的最小扩展判断

当前两种运行模式只属于认证，没有覆盖管理业务。M2 先复用 AuthService 的模式无关调用与 Backend 失败关闭原则，再定义产品所需的领域服务，Mock 与 Backend 同契约。暂不决定新增 Package/HTTP library；先完成首个真实调用方与边界评审，再按现有目录所有权落地。

现役 Surface/Plugin 守则禁止请求、Session 或后端 DTO，Universal 禁止业务权限计算。因此不能直接在 Plugin import Host auth/fetch，也不能往 Core/Foundation 塞用户 API。真实限制是缺少管理领域的运行时数据能力：建议产品拥有领域模型/操作契约，Host 装配 Browser/HTTP Adapter，经正式能力边界供 Plugin 消费；传领域语义和明确错误，不透传原始 HTTP 对象、Host Store 或任意 `Record`。新增能力仅针对实际业务调用，按 §9 完成 authority、契约登记与证据；不提前造泛型 service locator。

保留现有 `AuthUser{id,name,email}` 与登录 Cookie-session 协议；Profile 更新后统一重新读取/更新当前会话。用户管理 Mock 必须与登录身份使用同一账户记录关系，不能再创建一份“Rin”固定资料。角色/权限可能是独立 authorization snapshot 或身份协议扩展，M2 定向决定，避免未经确认改掉 `readSession`。最终真授权归后端；前端仅可感知/提示，Mock 也要执行同一规则并可复现不同身份。

`account-boundary.ts` 当前清除除设备与 auth 之外的 `clouddrive.*` 记录，这是既有私有状态策略。若新增系统 Mock 仓储，不得直接用同前缀 durable key 然后在退出时被删除；M2 需明确系统数据与用户私有草稿/工作记忆所有权、清理白名单和回归，保留隔离保证而避免破坏跨用户管理数据。Mock fixture、时钟/ID 策略、reset/version、损坏恢复和操作→通知/审计结果均需定义，不靠每次随机造数据。

## 9. API 契约基线与待确认事项

已核对的现有 API 仅认证五项（base 是配置值，不强行 `/api/v1`）：

| 现有方法/base 后路径  | 已实现的协议                                          | 当前状态                               |
| --------------------- | ----------------------------------------------------- | -------------------------------------- |
| GET `/auth/csrf`      | `{token:string}`                                      | Backend Adapter + 受控测试；真实待联调 |
| POST `/auth/login`    | `{email,password}`，204 建立 Cookie，会后再读 session | 同上                                   |
| POST `/auth/register` | `{name,email,password}`，204 建立 Cookie              | 同上，开放策略待后端确认               |
| GET `/auth/session`   | `{user:{id,name,email},expiresAt:number}`，Unix 毫秒  | 同上                                   |
| POST `/auth/logout`   | `{logout:true}`，204 销毁 Cookie                      | 同上                                   |

写请求先 CSRF，`credentials:include`/`cache:no-store`；单次调用含 CSRF 共享 15 秒期限；保留 credentials/expired/forbidden/account-exists/network/timeout/protocol/unavailable 语义。后续接入不要未经兼容处理把认证响应改成通用 envelope。完整现役说明见 [Web Authentication](../../../apps/web/src/auth/README.md)。

M2 必须建立的契约内容（本表是待实现清单，不是假称存在的 API）：

| 领域      | 最低资源/操作                              | 必须明确的规则                                                                                          |
| --------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 管理查询  | 用户、角色、权限目录、通知、审计           | q/filter/sort/page/pageSize 或 cursor、total/count、稳定排序、时区/日期范围、空页、边界值               |
| 用户/账户 | 列表/详情/创建/编辑/状态/角色分配、me 资料 | ID/email 唯一性、字段限制、disabled 含义、自身与最后管理员保护、资料同步                                |
| 角色/授权 | 列表/详情/创建/更新/权限关系/成员          | resource/action/grant 模型、系统角色保护、成员影响、授权变更生效与会话重验                              |
| 通知      | 查询/详情/未读数量/单项与批量已读          | 对象 owner、幂等、批量范围、顶部与列表一致、无权目标/已删除目标恢复                                     |
| 审计      | 只读查询/详情                              | actor、object、operation、occurredAt、result、筛选权限与敏感字段边界；无用户编辑接口                    |
| 系统设置  | 读取/保存                                  | 可写字段白名单、版本/并发冲突、权限与危险影响、保存失败保持 dirty                                       |
| 错误/授权 | 业务错误结构与状态码                       | 401 会话重验/失效、403 权限、404 对象、409 冲突、422 字段（若采用）、429/5xx 与 requestId；不吞字段错误 |

M2 产出供后端实施的契约文档/可验证 Schema：每项路径、方法、query/body/response、字段校验、权限、状态码及成功/失败样例，逐项标注 `proposed / mock implemented / backend adapter implemented / real integration verified` 等明确状态。M3–M6 每阶段把真实实现补入同一份契约，避免多份规范漂移。列表响应形式、鉴权 permission 命名和新 API 路径在实际模型设计时确定；M0 不提前写死未经后端确认的完整 OpenAPI。

静态部署默认 `WEB_DEPLOYMENT_MODE=static`，当前固定 detail/edit + query 可访问任意 ID，已经足以作为首个管理模块选择。若采用 request-time `[id]` 则必须切到 server；static-enumerated 仅适用于构建期有限实体，不能为运行时新增用户枚举所有 ID。这个选择依据部署需求评估，不要求任务开始即重构 Host。静态 REST Cookie 的同源代理/跨源 CORS/CSRF 与未知 URL fallback 均纳入联调。

本轮生产检查测得 gzip 首屏约 365.0 KiB、最大工作台路由约 428.1 KiB、CSS 47.25 KiB，分别仍通过原 400/430/48 KiB 预算。最大路由与 CSS 余量很小，后续应按需加载 Feature/编辑/权限和细节内容，避免首页静态导入全部管理能力。此处是产物预算风险，不是线上 Web Vitals 测量；不能提高预算掩盖增长。

## 10. M1–M7 分阶段实施计划（待 M0 确认）

| 阶段                 | 实际交付与复用                                                                                                              | 验收条件 / Mock 与 Backend 状态                                                                                    | 前置依赖                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| M1 信息架构/工作台   | 重组 navigation alias/contributions；开发内容保留 URL；产品命名/搜索一致；Page/Section 与真实工作记忆组成首页               | 导航/搜索/页签/最近/收藏/旧深链、手机 Drawer、英文/Dark；无假统计。业务摘要明确随后接入                            | 本报告确认；现役 Shell               |
| M2 数据/API/权限基线 | 审查配置后扩展产品模式、领域服务与 Adapter；确定首个用户 Schema/查询/错误/授权 snapshot；确定性 Mock 仓储；建立单一契约文档 | 同一 contract suite 对两 Adapter；非法响应/超时/401/403/重复/竞态、损坏版本、账户切换；真实服务仍待联调            | M1 IA；最小边界评审，无预设重构      |
| M3 用户/个人账户     | Collection+DataTable/Form/Detail/Confirm；完整列表→创建→详情→编辑→状态→角色分配；账户菜单通向 me                            | Mock 刷新/跨页一致、查重/取消/冲突/权限/危险确认、资料同步 UserIdentity；Backend 请求契约证明，真实待联调单列      | M2；角色选项读取最低契约先具备       |
| M4 角色/权限         | 角色 CRUD、权限目录/授权编辑、成员；系统角色与最后管理员保护；同源 UI 组合                                                  | 改权限→身份重验→导航/直达/动作状态一致；失败不更新；Mock 管理者/受限者两个身份闭环；后端独立授权待验证             | M3 用户/角色关联；M2 授权规则        |
| M5 通知/审计         | 领域通知数据源，顶部与完整页共享；列表/详情/分类/批量已读；审计只读查询详情                                                 | 操作生成对应审计和通知（按事件策略）、未读/页签/刷新一致；日志不可编辑；查询/403/目标失效/时间格式                 | M3/M4 已有真实操作和权限             |
| M6 系统设置/边界     | 保留八类偏好；独立系统配置读写与字段 Schema、dirty/确认；业务会话失效、403/404 等收口                                       | 保存/刷新/失败保持内容、版本冲突/危险影响/无权限；所有入口触发离开保护；Cookie 会话重新读取                        | M2 配置服务、M4 权限、M5 审计        |
| M7 体验/API 验收     | 管理者与受限身份完整任务，Dashboard 摘要同来源；后端契约逐项补齐；适用全量门禁                                              | 桌面/超宽/平板/手机、英文/Dark/Reduced、键盘/Axe、浮层打开、Mock reload/账号切换；真实 Backend 有服务才标 verified | M1–M6 每阶段完成，无统一末尾补假流程 |

每阶段必须更新同一实施账本并说明：发现、复用、具体功能变化及设计理由、Mock/Backend 状态、实测任务、未完成/回归/风险及下一阶段依赖。新功能先实现一条完整任务链，再扩展状态和视觉；不要一轮铺出所有空页。共享能力修改先列真实消费者、区分应随变与不应变；对应 authority、Contract、DOM/键盘/Axe/视觉及 `pnpm check` 均作为门禁，不降低规则或自动批准 golden。

## 11. 本阶段交付与下一步

本阶段交付为上述路由分类、能力/组件复用矩阵、16 项缺口、兼容 IA、API/边界判断、分阶段验收计划与本轮证据。没有新增管理页面或更换架构，现有未提交修改保持原样；代码生成/构建只使用原检查链。真实后端与真实设备验证明确未完成，线上源码版本亦未声称一致。

质量证据需按实际执行解释：`pnpm check` 在第 284 项浏览器测试后中断，后续测试及格式/文档门禁分别补跑通过；两段日志逐项覆盖 341 个唯一浏览器测试，但没有一次完整根命令成功退出记录。受控 Backend 测试出现 React Aria PressResponder 警告，来源待查。详见验证记录，不把受控协议、无失败或合并覆盖说成真实后端联调、零警告或单次全绿。

下一步先确认本报告的产品范围、保留 URL 的 IA 和按阶段数据闭环，再开始 M1；M2 的数据服务边界、授权 snapshot、Mock 系统仓储清理与后端协议需定向落实。M0 不据此擅自开始 M1–M7。
