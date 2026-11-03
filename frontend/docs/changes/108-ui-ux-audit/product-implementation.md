# clouddrive 产品实施账本

承接 [M0 审计基线](product-readiness-m0.md)。2026-10-12 用户明确要求继续 M1，M0 确认门已满足。后续阶段持续更新本账本，不重复建立相同报告。

## M1：产品信息架构与工作台

状态：M1 已完成；M2–M7 前端实施与累计联合验收已完成。2026-10-13 完整 `pnpm check` 退出码 0，427 项单元测试、350 项浏览器测试及全部静态/构建/预算/格式/文档门禁通过。导航视觉变化已按人工授权更新，真实后端仍待联调。下文保留阶段历史，以最终联合验收结果和累计交付说明为准。

### 问题、设计与改动

原首页展示路由数、插件数、Host 数、工程质量与建设轨迹；图标与参考资源混在正式管理入口。现改为工作空间、个人、开发中心三组，首页称“工作台”，设置入口称“个人偏好”，明确当前设置是浏览器个人体验而非系统级配置。开发中心按 UI Elements→Page Patterns→Page Archetypes→参考资源→图标→Foundation/Motion/States 排列。

只移动 Navigation Contribution 的归属与顺序；保留全部 38 Plugin URL、routeId、navigationId、隐藏详情/edit query、持久化 key/version 和认证协议。删除不再有消费者的 reference Group Alias；不改变 Framework Contract 或 Router。修改后由 codegen 生成 catalog，未手改生成物。全局搜索继续使用同一导航模型，结果说明补充当前分组及父级；页签仍使用实际分类/实体标题，旧首页标题呈现为当前工作台名称。收藏与最近访问保留原 href，已知入口标题随当前语言呈现。

工作台组合现役 Page/PageHeader/Section、RouterTextLink、Action、NotificationCenter、i18n 和 Motion。数据直接消费已有身份与 Host Store：

- 当前会话身份作为问候，不另建用户资料。
- 收藏与最近访问提供可跳转目标、真实时间与明确空态；最近访问隐藏偏好继续生效，根首页自身不作为工作入口重复显示。
- 非空创建草稿提供恢复入口；保存后消失，自动恢复偏好保留。源码确认仅创建草稿拥有可靠目标，未提供失去实体身份的编辑草稿入口。
- 最近应用事件来自同一通知 Store，提供单项/全部已读、关联页面与同源通知 Drawer，顶部计数同步；不预填通知，不当作后端审计。关闭应用内通知偏好时隐藏此区段。
- 外观、导航、语言地区、操作草稿四个偏好入口均直达已有功能。
- 开发工具明确放在独立开发中心区段；无业务任务或统计来源时不放图表、假计数或尚未完成模块的按钮。

未新增 Universal Token、公共 UI Element、Page Pattern 或 CSS，没有 TailAdmin 校准触发的公共组件改动。已有 HeroUI Overlay、Focus、Keyboard 与 Host 页面动效继续复用；账户退出隔离和 Browser API 所有权不变。

### Mock / Backend 状态与依赖

本阶段只消费既有会话、浏览器工作记忆、草稿与前端事件。Mock 认证可实际登录；认证 Backend Adapter 现有状态不变，真实后端待联调。Reference 资源仍是刷新恢复 fixture 的开发示例，事件关联的新资源在刷新后可能失效，已有缺失对象恢复态承接；M2 需要统一业务仓储与生命周期。没有新增或假称存在 REST 管理接口。

用户/角色摘要、服务端通知和审计活动依赖 M2 与 M3–M5，完成后再按权限和同一数据来源接到首页。系统配置归 M6；本轮不把个人偏好重命名成系统配置。

### 验证与未完成事项

浏览器已实际执行本地演示登录、创建草稿→回工作台→恢复内容→提交→工作台事件→全部已读→通知 Drawer 同步；验证旧创建 URL 与实体 query 保留。截图和 DOM 保存在 [product-m1 证据](evidence/product-m1/)。未改线上部署。

新增 Playwright 覆盖产品 IA/旧 URL/全局搜索/历史、真实草稿及事件同步，以及英文 Dark 在 390/768/1440/2560 的响应式、手机导航与 Axe。现有账户菜单、页签、导航记忆、自动恢复、收藏与最近访问流程保留并按产品入口名称更新定位，未放宽断言。首轮发现页签入口名覆盖分类标题，已修复；首轮结果保留，不作为最终通过证据。

完整 `pnpm check` 已执行：Foundation、Architecture、Dependency、两项 Codegen、Lint、TypeScript、403 项 Vitest、Next production build 与产物预算通过。浏览器 344 项中 326 通过、18 失败，故完整命令退出 1，不能声称全绿。失败分别为 11 个视觉测试（15 张截图）、6 个过期入口定位，以及 1 个截图输出文件写入错误。过期定位按产品名称更新后，全部 7 个非视觉失败独立补跑通过，包含两种新页面打开方式、滚顶开关、导航滚动、动态 Sticky 与 Compact rail；保留原检查及补跑日志。

新增 M1 的 3 个端到端用例已通过；完整套件还验证了全部 38 Plugin 路由在手机与桌面的标题/主体及无横向溢出、关键手机 Axe WCAG AA、已有收藏/最近访问/页签/离开保护/草稿/通知行为。英文 Dark 工作台在 390/768/1440/2560 保存了截图。当前最大路由 gzip 约 428.4 KiB（预算 430 KiB），CSS 约 47.2 KiB（预算 48 KiB）；预算余量较小，后续管理模块需继续测量。

视觉对照与具体范围见 [审阅清单](evidence/product-m1/visual-review.md)。2026-10-12 用户明确确认视觉变化并授权更新对应基线；定向 11 个视觉测试全部通过，更新清单对应 15 张截图，不扩大 diff 阈值。清单中的既有文案/可见位置已与当前源码和交互验证核对，日期用例额外固定 Date 时间并保留计时器运行，避免执行日期漂移。线上 404 翻译问题仍保留 M0 CC-16 跟踪，本阶段未部署修复。

获准更新后的第一轮全量浏览器回归 343/344 通过，全部视觉比对通过；唯一失败为写认证证据 PNG 的 Windows `UNKNOWN: open` 错误，见 [输出失败日志](evidence/product-m1/check-file-output-failure.txt)。此前另一个证据文件也出现相同错误，而独立补跑成功；磁盘空间与文件属性正常。测试工具增加 `saveEvidenceScreenshot`：仅捕获一次图像，对 `open` 系统调用的 `UNKNOWN/EBUSY/EPERM` 写入错误最多尝试 3 次，持续失败仍抛出；不重复页面操作、Axe 或视觉断言，也不修改截图阈值。现有证据截图消费者统一复用此保存逻辑，完整门禁重新验证。

最终完整 `pnpm check` **退出 0**：全部静态、类型、单元测试、构建、预算、**344/344 浏览器测试**、Prettier 与 Docs 检查通过，见 [最终完整日志](evidence/product-m1/check-passed.txt)。关键新流程和旧路由兼容已由现役源码、实际浏览器操作与完整测试共同证明；没有未收口的 M1 门禁失败。Backend-contract 项目只验证受控认证协议 fixture，不代表真实后端联调完成。

英文切换实测：当前入口和工作台静态文案即时翻译；已有实体/隐藏分类历史标题及通知正文是发布时保存的内容，可能仍为原语言。本阶段未改通知持久化 Contract，后续若要求历史事件重新翻译，应在 M2/M5 明确语义 message key/参数与已有记录兼容，而非 Shell 反向引用 Plugin 私有 namespace。

M1 的视觉审阅与门禁已收口；2026-10-12 用户更新目标，明确合并执行 M2–M3，实施见下文。

## M2–M3：数据契约、用户管理与个人账户（合并执行）

状态：实施与验证中；尚未登记阶段完成。真实后端未提供，REST 路径是基于现役 `/auth/*`、Cookie/CSRF 和 `NEXT_PUBLIC_AUTH_*` 配置延伸的待确认契约，不声称已联调。

### 审查与最小扩展判断

现役 AuthService、模式配置、Backend Cookie/CSRF、状态持久化、账户退出隔离已具备；Reference 资源只是内存 fixture，不能承担正式用户仓储。已复用现有能力，没有新建 Runtime Host、请求库、全局 Store Registry、Router、UI 框架或占位管理页。

- 请求层在 Web 内共用 `json-client`：Cookie、no-store、写请求 CSRF、15 秒超时与网络/HTTP/协议错误。现役认证 Adapter 复用它，不改变认证 URL 和 session 形状。
- Product Surface 增加具体 `identity` 模型/Schema/Port/Provider 作为用户、个人账户与 Host 的共享产品契约；不是万能 Service Locator。它不实现 HTTP、Storage、Session 或后端授权。Web 注入实现，公开导出与实验性成熟度沿用 Surface registry，并补实际 authority 与契约测试证据。
- Mock 将原 `clouddrive.auth-mock` v1 原地迁移到 v2，同一份数据保存账户摘要/盐、会话和用户目录。保留既有账号/会话，拒绝损坏与未知版本；不静默换 key。Browser 存储只作为标记清楚的模拟业务真相，不把真实 Backend 响应或秘密持久化。
- Mock User 写操作同时更新目录、登录资料与当前会话身份；姓名/邮箱编辑、禁用和角色分配由同一记录及 version 决定。独立 Service 实例和页面刷新读取最新持久化快照。Web Locks 可用时串行写入；真实后端必须独立实现原子写、版本冲突与授权。

### 当前实现与复用

新增 users/account 两个 Plugin，固定 URL `/users`、`/users/create`、`/users/detail?id=…`、`/users/edit?id=…`、`/account`，兼容当前静态部署。原 38 Plugin URL 均保留。导航沿用 Surface Group Alias、生成器、全局搜索与页签；个人账户同时从账户菜单进入。

用户目录使用现役 Page/PageHeader、Collection/FilterBar、SearchBox、SelectField、DataTable 和手机列表组合，实现姓名/邮箱搜索、状态/角色过滤、排序、分页、明确空态与恢复。创建、编辑和个人账户复用 FoundationForm、受控 Field、FormActions、离开保护与统一通知；密码仅创建时进入内存表单，不放入草稿。详情复用 DescriptionList、StatusPill、收藏 Port 与 ConfirmDialog，处理角色分配、状态修改、自身保护、权限不足、Pending、失败恢复和版本冲突。

M2–M3 初始角色目录只读并支持分配现有角色；后续 M4 已将其扩展为持久化角色与授权，见下文。个人账户修改姓名/邮箱，角色和状态只读，并刷新真实 UserIdentity。未制造行业业务、无结果按钮或虚假用户统计。

### 验证、剩余事项与依赖

第一批 19 项契约/认证兼容测试通过：同一 contract suite 对 Mock 与 Backend Adapter 验证查询→创建→详情→编辑→状态→角色→登录身份闭环，以及邮箱重复、版本冲突、受限身份、旧数据迁移、损坏/未知版本保留、写入失败、非法响应、网络/超时。架构与 Foundation 检查通过。类型、浏览器实际操作、响应式/Axe/视觉与完整 `pnpm check` 仍在进行，完成后补最终证据和成绩。

下一步建立单一 REST 对接文档与 Backend 契约浏览器 fixture，完成管理员和受限身份的用户/个人账户任务实测，再执行阶段门禁。真实 REST 服务仍待联调，不以契约 fixture 成功替代真实服务验证。

## M4–M5：角色授权、通知中心与审计（合并执行）

### M2–M5 联合验收进展（2026-10-12）

用户已明确恢复验收，范围是累计 M2–M5；此前“暂不检查”不再约束验收。本阶段仍未登记完成，下面区分已取得的证据与尚待收口的项目。

1. **发现的问题**：缺少正式业务仓储、可变角色授权、服务端通知与审计契约。首轮门禁发现 SearchBox 回调名、PageHeader 必填描述、类型 import 与测试文件空数组访问错误，已修复。产物预算暴露 Shell 错误类型入口与页面参数解析同时带入全量业务 Schema；已分离纯渲染契约和按需校验，但最大路由仍超预算。
2. **复用**：现役 Cookie/CSRF/Auth、state-foundation、Plugin/Next 路由生成、Page/Section/Collection、DataTable、FoundationForm、正式字段、ConfirmDialog、离开保护、i18n、通知反馈和 HeroUI Focus/Overlay。没有更换基础框架或降低规则。
3. **页面功能**：用户与个人账户、角色与权限目录、角色成员关系、完整通知及详情、只读审计查询/详情；导航、全局搜索、工作台和账户菜单接入同一产品数据关系。
4. **设计原因**：采用当前 Surface × Web Host 边界，具体 Product Port 共享模型，Host 承担请求/仓储；使用固定详情 URL + id query 保持静态部署。渲染入口 `/identity/runtime` 不加载 Schema，数据 Adapter 和参数/表单操作按需加载同一 Schema，保留全部校验。页签关闭时不加载显示模块；通知抽屉首次打开时加载并保留实例，让 HeroUI 继续管理关闭动效与焦点。
5. **Mock/API**：17 项当前契约测试通过，覆盖两种 Adapter 的用户/角色、有效授权变化、保护规则、通知隔离/批量、成功/失败审计、v1/v2 迁移、写入失败、网络与协议错误及并发创建。Mock 同文档写入新增队列，Web Locks 可用时再串行跨文档写入；无 Web Locks 不承诺跨文档强一致。Backend 浏览器契约用例已通过真实 Adapter/UI 的受控 HTTP 请求，确认 CSRF、409 草稿保留/重新读取、角色创建、通知和审计，以及不写 auth-mock。它不是实际后端服务联调。
6. **浏览器操作**：完整 Mock 用户创建→编辑→角色创建/分配→成员查询→审计列表/详情→通知全部已读与顶部同步→新用户凭据登录→获授权访问审计→用户越权拒绝→个人资料保存/刷新/账户菜单同步已通过。受限账户入口隐藏/直达拒绝、自己的通知和账户也通过。中文 Light/英文 Dark 在 390/1440 的 11 个页面共 44 次无横向溢出、Axe AA 与证据截图检查通过；后续加强到等待数据骨架退出，当前源码的复查已启动。新测试中修正了导航未提交就 reload、模糊重复标题定位及冷编译导航等待，未放宽视觉差异阈值。
7. **未完成/风险**：首轮完整 check 通过静态、类型和 420 项单元测试，构建曾因新增测试文件类型错误失败；修复后生产构建成功。最新已测首页 gzip 378886 bytes，CSS 48440 bytes，最大路由 `/page-archetypes/resource-list` gzip 445009 bytes，超过 440320 bytes 预算约 4.6 KiB。预算仍失败，未提高限额。新源码的完整 check 与工作台/页签/管理页面复查已启动；全量浏览器、视觉审阅和最终格式/文档检查未收口，不能宣称无回归。
8. **下一阶段依赖**：先完成 M2–M5 联合验收、预算修复及人工视觉确认；真实后端依据契约联调。M6 的系统级配置需要明确实际配置范围，不在当前验收中预造配置项。

当前过程日志位于任务主机 TEMP 的 `m25-*` 文件，测试证据位于 `test-results/playwright/`；收口后将最终结果与正式审阅证据归档到本 change 下。过程通过成绩只对应当时源码，后续修改必须由最终门禁重新确认。

当前源码的管理/工作台/页签联合浏览器复查 **11/11 通过**（`m25-browser-current.txt`），其中响应式与 Axe 在数据骨架退出后扫描，覆盖中文 Light/英文 Dark。Backend 浏览器契约 **1/1 通过**（`m25-browser-backend.txt`）。新 fixture 的未使用 password 解构变量已移除，不保存或输出密码。一次并行门禁扫描命中了 Playwright 活跃 trace 的临时 CSS，属于运行顺序冲突；浏览器已结束后重新启动顺序门禁，没有添加排除规则。

全量浏览器回归本轮结果为 **341/348 通过、7 项失败**（见 `evidence/product-m25/browser-full-first.txt`），不作为最终通过证据。两项导航视觉基线存在差异，尚未人工确认或更新。其余失败涉及认证恢复前读取标题/布局、Backend 认证 fixture 将新增 GET access 误记为写请求，以及磁盘耗尽导致缓存/trace 写入失败；另见旧 Reference 路由模块解析报错，需在环境恢复后复查。已修正等待应用导航就绪的采样条件，并为认证 fixture 增加有效 access 响应及严格 HTTP method/path 分类，保留原断言。停止本任务的 4173 开发服务后，将约 14 GB 的 `.next/dev` 缓存迁移到 `C:\Users\xiaol\.codex\attachments\m25-next-cache-20261012`，D 盘可用空间恢复至约 14 GB；没有删除失败日志或修改门禁规则。5 个非视觉失败用例正在补跑。

2026-10-12 用户指令：“先不检查门禁等审查，直接继续m4 ~ m5”。本轮直接实施，不开展浏览器验收、测试、Lint、类型检查、构建、预算或视觉基线审查；以下是源码实现记录，不代表阶段验收通过。M2–M3 尚未收口的验收继续保留，M6–M7 未展开。

### 现役能力复用与最小扩展

角色与成员复用 M2–M3 的 Product Identity Port、统一 Cookie/CSRF 请求层、用户目录、版本冲突和状态持久化；不用新的 Router、请求库、UI 框架或权限 Store。角色/通知/审计各自拥有 Plugin 私有页面，跨页面只共享具体产品模型与语义 hook。Page、PageHeader、Section、FoundationForm、TextField、CheckboxField、SelectField、ConfirmDialog、DescriptionList、StatusPill、Action、离开保护和统一反馈继续消费现役实现；无新增公共 Element、Token 或 CSS。

Mock 数据库仍使用 `clouddrive.auth-mock`，升级到 v3。v1、v2 分别迁移保留原账户摘要、会话、用户及序号，并加入系统角色、通知和审计集合；无历史事件预填，损坏或未知版本仍拒绝写入。Backend 响应只留在请求结果内，不落入浏览器持久化 Store。

### M4 实现

- `/roles`：真实角色列表与名称搜索，显示系统/自定义角色和实际权限数。
- `/roles/detail?id=…`：权限清单、当前成员总数与成员入口；“全部成员”进入已有用户列表的角色筛选，分配继续使用用户详情中的版本与确认操作。
- `/roles/create`、`/roles/edit?id=…`：角色名称与资源/操作权限配置，表单校验、未保存离开保护、授权影响确认、保存反馈、冲突和显式重新读取。
- `/roles/permissions`：资源 → 操作 → 实际已授予角色的关系目录，每个角色可进入详情；与编辑表单使用同一 `permissionCodes` 及角色数据。
- 系统角色不可编辑；不能编辑自己所属角色、改变自己的角色/状态或移除最后一名有效管理员；不能创建/编辑/分配包含自己未持有权限的角色。角色权限变动由当前数据库重新计算，不依赖固定角色常量授权。
- 侧栏与全局搜索使用同一个按当前权限过滤的导航集合；用户、角色、审计页面和动作仍单独确认权限。授权感知负责前端体验，真实后端必须为每次请求独立授权。

### M5 实现

- `/notifications`、`/notifications/detail?id=…`：通知列表、文本与分类/未读过滤、每页 20 条、详情、单项/本页/全部已读、关联页面和失败反馈。
- `useProductInbox` 合并当前账户的管理事件与现役应用事件。顶部 Drawer、完整页面和工作台消费同一集合与标记操作；Drawer 展示最近 10 条并进入完整中心。管理操作不再重复发布同一条本地成功事件。
- 管理通知按接收人隔离，Mock 的创建/编辑/状态/角色/个人资料操作成功时真实生成，不随机、不预填；Backend 使用服务端通知集合。权限不足时不提供关联管理入口；移除 Plugin 的历史应用事件仍可阅读，未知跳转目标不渲染链接。目标实体后来删除时由目标页面缺失记录状态承接。
- `/audit-logs`、`/audit-logs/detail?id=…`：只读查询、操作主体/对象搜索、操作类型/结果过滤、分页、详情及权限拒绝状态。记录含真实 actor、object、operation、time、result 与失败错误码；不收集密码、输入内容或凭据。
- Mock 成功操作和通知/审计随业务写入同一次持久化提交；权限拒绝、冲突、校验失败、记录缺失的写操作只追加失败元数据，不改变业务记录。失败审计无法持久化时保留原操作失败。生产审计真实性、原子性与保留政策属于后端，前端没有审计编辑接口。
- 写入后失效相关读取；Mock 跨窗口数据库变动与重新聚焦触发刷新。真实 Backend 目前为读取/手动刷新/聚焦刷新，没有声明实现服务端推送。

### 当前交付状态

后续实施继续保留“暂不检查”的指令：通知搜索、分类、全部/已读/未读及页码现在进入 URL；从列表进入详情再用返回入口，可恢复原筛选位置。详情增加实际阅读状态、未读总数和手动刷新，管理关联入口先通过同一 Identity Port 读取记录，记录不存在、权限拒绝或读取失败时保留通知内容并提供相应恢复反馈。

通知展示 ID 对服务端来源增加 `product:` 命名空间，防止与应用事件 ID 碰撞；已读请求仍发送原始服务端 ID。初始实现的原始管理通知详情 ID 继续可解析。单次已读操作用同步 in-flight guard 防止快速重复提交，批量操作去重并跳过已经读取的项；错误可通过刷新清除并重新读取。

角色分配的版本冲突恢复入口已改为实际重新读取用户，读取期间暂停写动作。角色详情补无成员/无成员读取权限状态，自己的角色不显示编辑入口。角色授权确认显示新增/移除的具体权限及读取时成员数；不能新增超出自身范围的授权，但允许移除已有的超范围授权。

Host 为每次 Mock 请求绑定开始时的操作人，异步密码摘要或数据库等待期间切换账号不会把待处理写请求重新归属到新账号；旧账号请求返回 unauthenticated 时，只在当前身份仍为原操作人时过期认证，避免旧请求使新登录失效。这些仍是实现说明，尚未通过延后的验收验证。

路由由现役生成器装配，当前为 14 Plugins / 52 Routes，保留既有 URL。代码生成第一次与开发监听并发发生 `ENOTEMPTY`，后续生成已成功恢复；未修改生成器或手写生成物。

本轮功能代码及下列 REST 契约已落地；未新增“全绿”证据，未更新视觉基线，未部署。桌面/移动/键盘/Axe、Mock 完整任务、Backend fixture 与真实联调、类型/构建/性能预算仍待后续验收。既有 M1 的通过记录只证明 M1，不覆盖本轮改动。

## M6 范围确认与实施依据（2026-10-12）

用户最新目标为 M2–M7，并明确选择“注册策略：是否开放注册、注册账号默认角色”。源码核实：现役 `/register` 具备完整表单与 Mock/Backend 注册行为；Mock 的 `saveAccount` 在同一业务数据库写入账户及用户，注册默认 viewer 由 `fromIdentity` 固定，尚无系统级可修改策略。现役 `/settings` 为个人偏好，不应承担管理员配置。

M6 将基于真实注册场景增加独立系统配置入口、受权限限制的读取/版本化更新、关闭注册的影响确认、未保存保护及冲突恢复。公开注册策略只暴露注册可用状态，默认角色配置及管理员信息不向匿名用户暴露；默认角色在注册提交时由 Mock 仓储或 Backend 判定，不接受客户端指定注册权限。老版本数据库迁移保留当前开放注册 + viewer 的行为，已有账户不随策略变更自动改角色。配置成功/失败需纳入现役审计与反馈。真实 Backend 仍按明确契约待联调，不以 fixture 代替实际服务验收。

环境恢复后的非视觉补跑结果：滚动呈现、四级视口 Archetype、顶部进度条及 Backend 认证 **4/4 通过**；页面层级在设置 10 路由冷编译总时限后 **1/1 通过**（原页面断言不变）。两项导航视觉差异再次复现，已归档对照图，未更新基线。M6 实施、性能预算、最终全量门禁及人工视觉确认仍未完成。

### M6 注册策略实现与契约

新增独立 `/system-settings` Plugin（当前生成 15 Plugins / 53 Routes），复用 Page/Section、FoundationForm、SelectField、SwitchField、ConfirmDialog、FormActions、离开保护及统一反馈。`/settings` 继续作为个人偏好。管理员可以读取、版本化保存注册开关和默认角色；只读授权不能保存；无权限的导航与直接访问均受控。409 保留编辑输入并允许显式重新读取。表单 reset 后后续编辑仍启用未保存保护。

| Method | Path                        | 权限              | 请求/响应                                                                                                               |
| ------ | --------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/auth/registration-policy` | 匿名可读          | `{ "enabled": true }`，严格只含公开可用状态                                                                             |
| GET    | `/system/registration`      | `settings.read`   | `{ "settings": { "enabled": true, "defaultRoleId": "viewer", "version": 1, "updatedAt": "2026-10-12T00:00:00.000Z" } }` |
| PATCH  | `/system/registration`      | `settings.update` | body `{ "enabled": false, "defaultRoleId": "viewer", "version": 1 }`；返回 `{settings}`，version 必须增加               |

以上路径均基于已有 API base，管理写请求沿用 Cookie/CSRF、no-store、15 秒超时和 Schema 校验。PATCH 的 version 必须匹配当前记录，否则 409；未知或不允许的角色 422；无权限 403；匿名管理请求 401。默认角色必须存在，权限不得超过操作人的有效权限，且不能包含 `users.roles / roles.create / roles.update / settings.update`，避免公开注册获得授权管理或系统写能力。已被选为注册默认值的角色不得再添加这些权限；管理员需先选择另一个合适的默认角色。

`POST /auth/register` 不新增客户端 roleId/permissions 字段：服务端在提交时检查注册开关并分配当时的默认角色。关闭注册必须拒绝请求，浏览器隐藏表单只改善体验，不是授权机制；禁止用管理员创建用户接口绕过公开注册策略。策略变更不修改已注册用户角色，管理员创建账号继续遵守已有创建权限规则。

Mock 数据库沿用原 key，v4 迁移保留 v1/v2/v3 记录，默认策略为开放 + viewer。只有迁移后的受保护 administrator 角色补入 `settings.read/update`，其他角色不自动提权。策略成功写入、通知和 `settings.update` 审计单次原子提交；拒绝、校验及冲突写入失败审计，不改变策略。公开注册在同一串行写队列内再次校验当前开关/角色，解决读取策略后被关闭的竞态。匿名页策略读取失败提供重试；不提供账号角色或管理员配置信息。

已取得证据：TypeScript、Lint 通过；两种 Adapter 累计 **22 项契约测试通过**，包含策略实际角色分配、关闭拒绝、已有角色不变、冲突与失败审计、权限拒绝、高权限角色保护和 v3 保真迁移。Backend 配置 UI/CSRF、刷新恢复与原有 3 项认证浏览器用例 **4/4 通过**；Mock 注册策略完整流程 **1/1 通过**，包含初始 Axe AA、关闭注册、匿名页无表单、重新开放 + operator、新账号进入用户管理且直达系统配置被拒绝。首轮 Switch 测试点击隐藏 input 被可见 label 拦截，改为键盘 Space 和可见标签点击；末次拒绝标题断言改为现役“没有操作权限”。均未改变组件行为或降低视觉阈值。最终全量门禁、性能预算、窄屏/深色/英文和新增配置页边界验收仍待收口。真实后端未提供，全部新增 REST 仍为待联调契约，不能把受控 HTTP fixture 称为真实服务验收。

## M7 联合验收与性能收口（2026-10-12）

首轮 M6 后最大路由 gzip 445763 bytes，超预算 5443 bytes。评估全部消费者后，先将 Host 离开确认与 Reference 批量导出确认改为首次请求加载，保留导航 resolver、确认语义和使用后的组件实例；最大路由降至 444413 bytes，仍超预算。随后将 UI Adapter 的 FeedbackProvider 拆分为同步 HeroUI ToastQueue 与首次反馈加载的内部 Region，未改动 Toast anatomy/Portal/Focus/Token。全局真实 Provider 位于 Host，用户/角色/系统策略表单、Reference、UI Elements 与偏好预览等消费者仍使用同一个 useFeedback Contract。完整门禁要求 Suspense 不能使用空 fallback，因而 Host/Reference 确认加载及 Toast 首次加载均增加正式 BusyIndicator，放入既有语义层级的固定浮层，不改变页面空间；Provider 增加由装配方本地化的 loadingLabel，Host 和唯一直接测试消费者均同步。

公共组件变更前，实际进入 [TailAdmin Notification](https://react-demo.tailadmin.com/notifications) 复核 Announcement、带关闭/操作的 Toast、成功/信息/警告/错误通知，并实测关闭（证据 `evidence/product-m25/tailadmin-notification-calibration.png`）；只校准层级和操作规律，没有复制组件、样式或素材进产品。项目 `/ui-elements/feedback` 仍使用同一 Provider 与原有视觉。

初始拆分的性能门禁通过：首页 gzip **371518 bytes**，最大路由 `/page-archetypes/resource-list` **437661 bytes**，低于 **440320 bytes** 限额；CSS **48440 bytes**，最大 chunk **84658 bytes**。初始性能修复并未删除业务功能、取消 Schema 校验或修改预算。

当前定向证据：离开保护、批量导出取消/直接执行、复制反馈及收纳偏好、3 秒/8 秒 Toast 时长 **10/10 浏览器通过**；Toast 打开态 Axe、Toast/Destructive Confirm/Compact 的既有视觉基线通过；Backend 配置 409 保留 draft、取消确认、显式读取最新值、重新保存和刷新恢复通过。系统策略矩阵在 320/768/1440/2048、中文 Light/英文 Dark 共 8 个场景验证 Page、禁用高权限选项的下拉框、确认框 Axe AA、键盘焦点、取消保留草稿、重置恢复与截图。首轮在 Modal 入场中采样得到临时对比度 4.45:1，改为调用现役 waitForVisualReadiness 等待有限动效完成后通过；未改颜色、标准或扫描规则。

统一记录缺失文案从“用户”改为“记录”，适用于用户、角色、通知关联和审计详情；Auth README 同步 v4 及注册策略真实职责。注册配置的错误契约补齐 enabled/defaultRoleId 字段。最新完整 pnpm check、累计浏览器回归及新增导航的人工视觉确认仍未收口，以上是定向证据，不能替代最终验收。

用户已审阅 `evidence/product-m25/navigation-review.html` 的 M2–M6 桌面/手机对照，明确回复“认可导航变化，更新这两项基线”。仅更新 `surface-shell-parent-navigation` 与 `mobile-navigation-open` 两项，使用获准的原始实际截图，没有提高 diff 阈值。全量回归随后还发现两项收缩侧栏 Flyout 截图差异；交互、键盘与焦点断言通过，额外基线仍待完整清单审阅，没有随本次批准一起更新。

### 累计 M2–M7 联合验收记录

完整 `pnpm check` 通过 Foundation、Architecture、Dependency、Codegen、Lint、TypeScript、**427 项单元测试**、生产构建与性能预算。包含正式 BusyIndicator fallback 的当前产物：首页 gzip **371650 bytes**、最大路由 **437832 bytes**、CSS **48460 bytes**、最大 chunk **84658 bytes**；所有预算保持原限额。全量浏览器 **347/350 通过**，3 项失败均为导航截图差异，没有其他断言失败；其中展开导航测试在用户批准并更新之前已经执行，手机导航在更新之后执行并通过。该次命令仍以失败退出，不是最终全绿证据。完整日志与 96 项浏览器产物归档在 `evidence/product-m25/m7-check-before-visual-review.txt`、`evidence/product-m25/m7-full-before-visual-review/`。独立格式和文档检查通过。

收缩侧栏新增菜单后，Page Archetypes 首次位于视口下边界之外。诊断复现 Playwright 自动定位使侧栏 scrollTop=299、主页面 scrollY=52；在导航容器内先将被裁剪条目滚入视口后再 hover，侧栏同样滚动而主页面 scrollY=0。测试按此流程修正，并增加主页面保持顶部的断言；未修改产品布局或导航组件。剩余两张截图需按修正后的真实状态审阅，再决定是否更新；未批准的基线继续保留。

修正后定向复测 **3/4 通过**（`evidence/product-m25/m7-navigation-final-review.txt`）：获准的展开导航与手机打开态均通过；兄弟菜单切换通过原基线，未更新该 PNG。唯一失败是 Hover Flyout 的截图差异，所有后续悬停/点击/Enter/Escape/焦点恢复断言通过。触发器随新导航项下移，浮层继续由现役视口约束定位；主页面 scrollY=0。最终剩余视觉清单已集中到 `navigation-review.html` 的唯一待确认项，使用 `m27-surface-shell-compact-flyout-*` 原始对照，不纳入此前两项授权。

用户随后完整审阅剩余清单，明确回复“认可完整清单，更新该基线并统一完成最终门禁”。已将 `m27-surface-shell-compact-flyout-actual.png` 原样更新为唯一剩余的 `surface-shell-compact-flyout` 基线；兄弟菜单切换原基线保持不变，全部 diff 阈值保持不变。源码与基线冻结后，一次性启动最终完整 `pnpm check`；本记录的最终通过状态将在该命令结束后补充。

获批后的全量运行通过同一静态/单元/构建/预算门禁，浏览器 **348/350 通过**（`m7-check-approved-first.txt`）；两项失败分别为 warm 导航进度条观察过晚、UI Elements 目录入场尚未稳定时截图。Trace 中进度条确有 pending/completing，原测试等待目标标题后再轮询，错过短暂周期；改为导航前逐帧采集真实尺寸/位置/容器及 fill opacity，并保留最终退出断言。视觉等待补充可见 reveal item 的观察器完成和有限动效退出，UI Elements 在契约目录可读后再次等待。没有修改产品 Motion、放宽像素断言或更新额外基线。相关管理/注册策略/进度条/全部视觉场景统一复测 **22/22 通过**（`m7-batch-sampling-verification.txt`），随后针对原时序失败重复 warm 用例，再执行最终完整门禁。原始失败现场及复测产物保存在对应 ZIP；早期完整现场原始包为 `m7-full-before-visual-review-original.zip`，展开的 JSON/Markdown 只按仓库格式规范调整空白。

warm 用例连续 **5/5 通过**（`m7-warm-progress-repeat.txt`），像素可见与最终退出断言均保留。之后一次性重新执行完整 `pnpm check`，期间不修改源码、视觉基线、测试阈值或预算。

下一次完整运行浏览器 **349/350 通过**（`m7-check-before-backend-sync.txt`），两个采样问题已通过，仅 Backend 首次登录跳转失败。Trace 证明 session 已返回 401、客户端已请求正确的 `/login?returnTo=…&_rsc=…`，但开发 Host 首次冷编译的 RSC 响应在原 URL 断言窗口内尚未返回，受保护内容始终隐藏。测试增加实际目标 RSC 响应同步与成功状态断言，并在等待期间验证私有账户入口不存在；原 URL/CSRF/无 Mock 持久化断言及测试总时限不变。认证与管理 Backend 联合复测 **4/4 通过**（`m7-backend-sync-batch.txt`）。失败与复测原始产物均保存为 ZIP，最后再次运行完整门禁，最终成绩待命令结束确认。

**最终联合验收（2026-10-13）**：完整 `pnpm check` **退出码 0**；Foundation、Architecture、Dependency、两项 Codegen、Lint、TypeScript、**427 项 Vitest**、生产构建、性能预算、**350/350 Playwright**、全库 Prettier 和 Docs 门禁全部通过。最终原始日志为 [m7-check-complete.txt](evidence/product-m25/m7-check-complete.txt)，浏览器原始产物为 [m7-final-browser-evidence.zip](evidence/product-m25/m7-final-browser-evidence.zip)。本轮仅更新人工获准的展开导航、手机打开态、收缩 Hover Flyout 三项基线；兄弟菜单及其他基线保持原版，全部阈值和预算保持不变。

最终产物首页 gzip **371650 bytes**，最大路由 `/page-archetypes/resource-list` **437832 bytes / 440320 bytes**，CSS **48460 bytes / 49152 bytes**，最大 chunk **84658 bytes**。最大路由余量 2488 bytes、CSS 余量 692 bytes，后续扩展继续执行原预算。

最终覆盖审计另合并补核角色编辑、用户状态与通知详情回返（独立 Mock 浏览器上下文，未修改业务实现）：用户停用取消保持原状态、停用后刷新仍停用、启用后保留原凭据；编辑真实角色的名称与权限，确认显示实际 1 位成员及移除授权，保存/刷新后详情一致，新成员登录后被移除的 audit 权限实际拒绝；通知详情单项已读、关联角色跳转、浏览器后退和返回列表保留 q/category/read/page 全部条件。四组断言全部通过，结果为 `m7-lifecycle-browser-audit.json`，日志、可复现脚本 ZIP、角色与通知截图保存在同一证据目录。首次补核脚本误在每次导航重置初始化存储，随后改为上下文仅初始化一次；第二次 URL 断言错误假定 id 必须位于第一项，改为解析 pathname 与实际查询字段后通过。两者均为补核脚本问题，不是产品修改或门禁放宽；失败日志保留。

| 范围 | 对照要求与最终证据                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2   | 同一 Identity Port、严格 Schema、Cookie/CSRF/no-store/超时、分页排序筛选和错误语义；22 项两 Adapter 契约测试包含迁移、并发、失败与策略规则，已纳入最终 427 项。REST 方法、字段、校验、状态码、权限与示例见本账本下方契约。 |
| M3   | `product-management.spec.ts` 验证真实用户创建、编辑、角色分配、登录授权、个人资料与账户菜单同步、受限账户和持久化；用户/账户响应式与 Axe 纳入 44 场景矩阵。                                                                |
| M4   | 同一管理任务验证角色创建、实际授权变化、成员筛选及权限目录；契约测试覆盖编辑授权生效、版本和系统/自身/最后管理员保护及授权上限。最终补核通过真实角色编辑、成员影响确认、刷新及新成员实际拒绝被移除的权限。                 |
| M5   | 同一任务验证审计查询/详情与通知批量已读、顶部同步；契约测试覆盖个人隔离、幂等/分批及成功/失败审计。审计 Port 只有读取，未提供前端编辑或删除。                                                                              |
| M6   | `product-system-settings.spec.ts` 验证关闭/开放注册、当前默认角色与已有账户隔离、越权拒绝；8 场景覆盖读取、保存、取消、重置、下拉/确认框、焦点和 Axe，Backend 联合流程验证 409 保留草稿、显式重读、保存及刷新。            |
| M7   | 完整 350 项覆盖全部路由、桌面/平板/手机/超宽、中文 Light/英文 Dark、控件/浮层/键盘/Axe、Motion/滚动/持久化及旧开发中心；4 项 Backend HTTP 浏览器契约通过。它们不是实际后端服务验收。                                       |

累计交付说明：

1. **发现与处理的问题**：业务管理缺口、授权变更后的实际访问、通知来源一致性、失败审计、版本冲突草稿、旧数据库迁移、关闭注册提交竞态，以及 Shell 常驻加载全量 Schema/确认框/Toast Region 导致的预算超限均已处理。全部导航视觉变化已人工确认。
2. **已有能力复用**：Product Identity Port、Cookie/CSRF 请求层、state-foundation、Plugin/Next 装配、Page/Section/Collection、DataTable、FoundationForm、正式字段、ConfirmDialog、离开保护、HeroUI Overlay/Focus、i18n 和统一反馈。没有新增平行 UI 库、Router、全局 Token 或业务 CSS。
3. **页面与功能**：用户列表/创建/编辑/详情/状态/角色分配、个人账户、角色列表/编辑/详情/成员/权限目录、完整通知与详情、只读审计与详情、独立系统注册策略；工作台、顶部通知、导航与全局搜索连到同一数据关系。现为 15 Plugins / 53 Routes，既有路由保留。
4. **设计与实现理由**：保留 Surface × Runtime 边界和固定详情 URL，业务 Port 共享具体产品契约，Host 承担仓储与 HTTP。系统配置独立于个人偏好，公开注册只读可用状态，角色由提交时策略决定。按需加载只改变加载时机，继续使用现役 Schema、HeroUI 和反馈实现。
5. **Mock 与 API**：Mock v4 已实现可持久化业务关系、版本化更新、迁移与串行提交；两种 Adapter 的 22 项契约测试通过。Backend UI 受控 HTTP 流程通过，证明真实 Adapter 的请求/CSRF/响应校验及失败恢复，不代表实际服务器验收。所有新增后端 endpoint **待联调**。
6. **实际浏览器验证**：完整管理任务、授权变化/受限身份、自己的通知、个人资料同步、筛选返回、已读同步、审计详情、注册关闭/开放/默认角色、409 保留与重新读取、保存/取消/重置/刷新、未保存离开与页签关闭、键盘焦点、Axe AA、多视口、中文 Light/英文 Dark、动效与持久化；旧开发中心、Reference、全部 UI Element Family 和现役浮层回归也完成本轮扫描。
7. **未完成与风险**：前端实现、人工视觉确认与最终完整门禁已收口，本轮自动化范围内未发现功能回归。实际后端、生产授权/审计可信性/事务和通知保留策略仍待联调；无 Web Locks 的环境不承诺 Mock 跨文档强一致。当前未实现服务端实时通知推送，完整 inbox 规模需后端确认。产物预算余量较小，后续功能需持续测量。
8. **下一阶段依赖**：依照本文件 REST 契约接入实际服务，确认新增路径、权限、版本错误语义、通知集合规模与审计保留政策，再开展生产联调与部署验收。当前前端不需要再引入新的页面架构。

## M2–M5 REST 对接契约（实现稿，待后端联调）

源码 authority 为 `surfaces/src/identity/model.ts`、`apps/web/src/identity/backend-service.ts` 与既有 Auth Contract。当前没有真实管理后端，不声称这些新增 endpoint 已在线存在。

### 模式与传输

现役 `NEXT_PUBLIC_AUTH_MODE=mock|backend` 同时选择认证和管理数据模式。Backend 使用 `NEXT_PUBLIC_AUTH_API_BASE_URL`；无效配置显示配置错误，不回退到 Mock。全部请求 `credentials: include`、`cache: no-store`；写请求先读取既有 `GET /auth/csrf` 的 `{ "token": "…" }`，再发送 `X-CSRF-Token` 与 JSON body。CSRF 和实际请求共享 15 秒超时，不自动重试写操作。

沿用现役 `/auth/session`、`/auth/login`、`/auth/register`、`/auth/logout` 认证 Contract，不新增 Bearer/localStorage token。服务端配置 Cookie、CORS、CSRF 和会话生命周期；前端的权限检查不能代替后端授权。

### Endpoint 与权限

以下路径相对 API Base URL。GET 成功 200、创建成功 201、PATCH 成功 200；通知已读成功为 204 空 body。返回体必须符合严格 Schema，不可随意加入字段。

| 方法 / 路径                 | 权限与用途                             | 请求 / 响应                                                                                          |
| --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET `/auth/access`          | 当前有效账户                           | `{user, permissions}`；权限是角色授权并集                                                            |
| GET `/me`                   | 当前有效账户                           | `{user}`，必须等于当前会话 user ID                                                                   |
| PATCH `/me`                 | `account.update`                       | `{name,email,version}` → `{user}`；禁止 role/status/password 字段                                    |
| GET `/roles`                | 当前有效账户的可用角色目录             | `{items: Role[]}`；有 `roles.read`、`users.read` 或 `settings.read` 可获完整目录，否则只返回自身角色 |
| GET `/roles/:id`            | `roles.read`                           | `{role}`                                                                                             |
| POST `/roles`               | `roles.create`，且授权范围不能超出自身 | `{name,permissions}` → `{role}`                                                                      |
| PATCH `/roles/:id`          | `roles.update`，且授权范围不能超出自身 | `{name,permissions,version}` → `{role}`；系统角色/自己的角色拒绝                                     |
| GET `/users`                | `users.read`                           | 下述 Query → `{items,total,page,pageSize}`                                                           |
| GET `/users/:id`            | `users.read`                           | `{user}`                                                                                             |
| POST `/users`               | `users.create`                         | `{name,email,password,roleIds,status}` → `{user}`                                                    |
| PATCH `/users/:id`          | `users.update`                         | `{name,email,version}` → `{user}`                                                                    |
| PATCH `/users/:id/status`   | `users.status`                         | `{status,version}` → `{user}`                                                                        |
| PATCH `/users/:id/roles`    | `users.roles`，授权范围不能超出自身    | `{roleIds,version}` → `{user}`                                                                       |
| GET `/notifications`        | 当前有效账户，只返回自己的通知         | `{items: ProductNotification[]}`，新到旧；完整当前 inbox，前端分页/筛选                              |
| PATCH `/notifications/read` | 当前有效账户，只更新自己的记录         | `{ids: string[]}`（1–200，不重复）→ 204；已读操作幂等，未知/别人的 ID 拒绝，不部分提交               |
| GET `/audit-logs`           | `audit.read`                           | 下述 Query → `{items,total,page,pageSize}`，时间降序并用 ID 决定并列顺序                             |
| GET `/audit-logs/:id`       | `audit.read`                           | `{record}`；没有前端编辑/删除 endpoint                                                               |

创建用户的非 `viewer` 初始角色额外需要 `users.roles`，初始 disabled 需要 `users.status`。禁用账户不能继续登录/恢复会话；角色、状态、个人资料和邮箱变更在同一身份数据关系内生效。授权变化对未来请求立即生效，不仅改变侧栏。

### 字段、查询与响应校验

- Identifier：1–100 位 `[A-Za-z0-9][A-Za-z0-9_.:-]*` opaque ID；姓名/角色名称 trim 后 1–80 字符；邮箱 trim/lowercase 后有效邮箱、最多 254 字符；密码仅创建请求，12–128 字符。
- User：`id,name,email,status,roleIds,version,createdAt,updatedAt`；status=`active|disabled`；roleIds 为不重复有效 ID，1–20 项；version 为正整数；时间是 UTC ISO datetime。
- Role：`id,name,permissions,protected,version,createdAt,updatedAt`。permissions 是下述受控 code 的不重复集合，允许空集；protected=true 不可变。修改必须检查 version 并增加版本，不接受客户端 protected/id/time。
- 权限目录：`users.read/create/update/status/roles`、`roles.read/create/update`、`account.update`、`audit.read`、`settings.read/update`（斜线表示多个独立 code）。资源与操作在 UI 分组展示；角色的 permissions 是授权关系，access 是当前角色并集。只授予写权限不隐式赋予读权限，配置时应一并考虑所需读权限。`GET /roles` 在拥有 users.read、roles.read 或 settings.read 时可提供配置所需角色目录，否则只返回自己所属角色；完整角色详情继续检查 roles.read。
- Users Query：`q` ≤100，`status=all|active|disabled`，`roleId=all|ID`，`sort=name|email|createdAt`，`direction=asc|desc`，`page=1..100000`，`pageSize=10|20|50`。缺省空搜索/all/all/name/asc/1/20；排序以 ID 作为稳定并列键；分页越界返回空 items 和真实 total。
- Audit Query：`q` ≤100（匹配 actorId/actorName/objectId/objectName），`operation=all|受控操作`，`result=all|success|failure`，page/pageSize 同 Users；缺省空/all/all/1/20。
- AuditRecord：`id,actorId,actorName,objectId,objectName,operation,createdAt,result,errorCode?`。operation 为用户 create/update/status/roles、account.update、roles.create/update、settings.update；errorCode 仅失败记录。操作主体由服务端会话确定，客户端不能提交 audit record。
- ProductNotification：`id,ownerId,operation,objectId,objectName,category,createdAt,read`；category=`success|failure|system`；operation 同 Audit；接收人必须是当前账户。通知标题由语义 operation 和对象名在当前语言生成，Backend 响应不落入本地事件 Store。
- 通知页面 URL Query（当前是前端集合筛选，不改变 GET `/notifications`）：`q` ≤100，`category=all|system|success|failure|warning|task`，`read=all|read|unread`，`page=1..100000`，每页 20 条。category 的 warning/task 来自已有应用事件；详情同时带 `id` 与列表 Query，返回时恢复筛选。页面 ID 的 `product:` 来源前缀不进入 REST body。
- Page 响应：total 非负整数，page/pageSize 与请求一致；items 不超过 pageSize、ID 不重复且 total 不小于 items 长度。单实体响应 ID 必须匹配请求；写响应 version 必须增加。

### 冲突、受保护操作与错误

HTTP 401 使认证过期；403 只呈现权限拒绝，不切换到 Mock；404 呈现记录缺失；409 用于邮箱/角色名重复、版本冲突和保护规则；422 用于不合法字段；网络、超时、非法 JSON/Schema 分别保留 network/timeout/protocol 语义。

错误体：`{"error":{"code":"conflict","reason":"stale-version","fields":[{"field":"version","reason":"stale"}],"requestId":"req-123"}}`。

code 必须与 HTTP 状态一致；reason 可选 `duplicate-email|duplicate-role|stale-version|protected-user|protected-role|last-administrator`；fields 中 field 为 name/email/password/roleIds/permissions/status/version/query/enabled/defaultRoleId，reason 为 required/format/length/duplicate/protected/stale/unknown；requestId 最多 128 字符，不含秘密。409 保留当前输入并提供显式读取最新记录，不自动覆盖或重试。

通知策略：用户/个人资料写入通知操作人及被操作用户；角色写入通知操作人及该角色现有成员，接收人去重。成功业务写入、版本更新、凭据/会话资料同步、通知生成与成功审计必须由后端原子提交。失败审计独立记录授权主体、受控对象 ID 与错误语义，禁止密码、凭据或原始 body。Mock 仅模拟这些业务规则，浏览器可修改的数据不提供生产授权与审计可信性。

### 示例

创建自定义只读审计角色：`POST /roles`，body `{"name":"Audit reviewer","permissions":["audit.read","account.update"]}`；响应 `{ "role": { "id":"role-42","name":"Audit reviewer","permissions":["audit.read","account.update"],"protected":false,"version":1,"createdAt":"2026-10-12T00:00:00.000Z","updatedAt":"2026-10-12T00:00:00.000Z" } }`。

给其他用户分配角色：`PATCH /users/member-001/roles`，body `{"roleIds":["role-42"],"version":1}`；返回 `{user}`，version 增加。此后该用户 access 包含 audit.read/account.update，其审计入口可见；编辑个人资料仍不能改变角色。

查询失败日志：`GET /audit-logs?q=member-001&operation=users.roles&result=failure&page=1&pageSize=20`；返回只读分页。通知已读：`PATCH /notifications/read`，body `{"ids":["inbox-42"]}`，成功 204；读取集合后同一 ID 的 read=true。

后端上线前需确认新增路径、权限 code、Inbox 的完整集合规模与保留政策、审计保留和分页稳定性。当前没有 SSE/WebSocket 推送或通知删除 API；未来服务端分页 inbox 需要同时约定准确未读总数与筛选/批处理语义，不能仅返回最近一页冒充完整集合。

M6 实施后第一次完整门禁（evidence/product-m25/m67-check-first.txt）：Foundation/Architecture/Dependency/Codegen/Lint/TypeScript 通过，427 项单元测试通过，生产构建成功；performance:check 仍失败。最新首页 gzip 379640 bytes、CSS 48440 bytes、最大路由 /page-archetypes/resource-list gzip 445763 bytes，超过 440320 bytes 限额 5443 bytes。后续全量浏览器、格式/文档门禁尚未由该次 check 执行，M7 仍进行中。未修改预算或视觉阈值。
