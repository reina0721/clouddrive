# 后台管理闭环与账户安全

承接 [108 产品实施](../108-ui-ux-audit/product-implementation.md)，按用户确认方案完善工作台及六个管理／个人页面。

## 范围与状态

首页仅保留最近访问；用户批量状态、角色成员、审计筛选、注册策略、账户密码与会话、通知分页同步已补齐。真实后端联调延后，不将请求夹具验收记为真实服务通过。

## 审查

桌面 1440 与手机 390 七页实际打开共 14 组，均无文档横向溢出。原始画面与文字见 [实施前清单](evidence/before/inventory.json)。角色卡片缺少比较信息，审计密集记录不适合逐条卡片，首页混入偏好、开发与事件信息。系统配置实际页面标题已是注册策略，导航分类仍需调整。

## 实施与验收

复用现有 Page、Collection、DataTable、多选、表单、Dialog、State、Feedback 和 i18n。接口及验证证据随实施补充，视觉基线整批人工审阅后更新，不提高阈值。

## 页面信息架构与设计取舍

| 入口     | 原体验                                     | 当前方案与理由                                                             |
| -------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| 工作台   | 草稿、收藏、事件、偏好、开发信息混杂       | 标题与最近访问；移除草稿自动跳转及其偏好入口，旧持久化字段仅为兼容保留     |
| 用户管理 | 已有桌面表格与移动列表，逐条操作           | 当前页选择、批量状态确认与逐项反馈；失败项保留，避免虚假整体成功           |
| 角色管理 | 卡片只显示名称与权限数，成员需离开详情管理 | 同源表格／手机摘要；授权摘要与成员数供比较，详情直接增减成员并保留其他角色 |
| 审计日志 | 密集卡片，手机搜索／分页被裁切             | 桌面表格、手机重点信息，完整主体／对象／UTC 日期范围筛选与返回 URL         |
| 系统配置 | 原标题已为注册策略，导航仍归身份与访问     | 归系统管理，展示保存状态、更新时间、所选默认角色权限；不预造配置项         |
| 个人账户 | 资料与身份，缺安全任务                     | 资料、身份、安全分区；当前密码验证、会话撤销、密码变更后重新登录           |
| 通知中心 | 完整集合加载后前端分页                     | 服务端查询与分页；本地应用事件分开分页，共用已读动作与顶栏总数             |

没有用户增长／趋势指标；本轮遵从“首页仅最近访问”，没有添加无口径指标。用户、角色、通知、审计、注册策略、账户安全是可复用管理任务，行业业务与统计模型留待真实需求。

## 新增与扩展 REST 契约

下列路径基于现有 API base URL。Backend transport 使用 Cookie credentials、no-store、每次写入读取 CSRF token、15 秒超时。输入及响应严格 Schema 校验；不会降级到 Mock。401 结束会话，403 拒绝，404 不存在，409 版本冲突，422 输入错误。分页响应必须匹配请求页码和页容量，ID 不得重复。

| 路径                                | 权限与输入                                                         | 输出与业务责任                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /users/batch-status`          | users.status；`{status,items:[{id,version}]}`，1～200 项且 ID 唯一 | `{items:[{id,success:true,user} 或 {id,success:false,code,reason?}]}`；每个请求对象恰有一项结果。成功用户版本递增、状态匹配；保护自身与最后管理员；逐项写审计 |
| `GET /roles?include=memberCount`    | roles.read                                                         | `{items:[Role+memberCount]}`；成员数非负，角色 ID 唯一。原 `GET /roles` 契约保留                                                                              |
| `GET /roles/:id/members`            | roles.read 与 users.read；q/status/sort/direction/page/pageSize    | UserPage；成员必须含此角色；分页 10／20／50，与用户列表共用身份来源                                                                                           |
| `POST /roles/:id/members`           | users.roles；`{userId,version}`                                    | `{user}`；添加此角色，保留其他角色，新增授权不得超过操作者                                                                                                    |
| `DELETE /roles/:id/members/:userId` | users.roles；`{version}`                                           | `{user}`；仅移除此角色；唯一角色、自身与最后管理员受保护。冲突不覆盖最新数据                                                                                  |
| `GET /audit-logs`                   | audit.read；保留旧查询，增加 actor/object/from/to                  | AuditPage；actor/object 匹配 ID 或名称，from/to 为 UTC ISO 时间且包含边界，from 不得晚于 to；只读                                                             |
| `GET /notifications`                | 当前登录账户；q/category/read/page/pageSize                        | `{items,total,unread,page,pageSize}`；total 为筛选后的总数，unread 为本人全部未读数。q 搜索对象名称／ID或操作代码                                             |
| `GET /notifications/:id`            | 当前账户拥有该通知                                                 | `{item}`；没有权限的记录按不存在处理；支持不在当前分页中的详情                                                                                                |
| `PATCH /notifications/read`         | 本人消息；原 `{ids}`，1～200 且唯一                                | 204；幂等；禁止操作其他账户消息                                                                                                                               |
| `PATCH /notifications/read-all`     | 当前账户；`{}`                                                     | 204；仅影响执行时已经存在的本人消息，之后新消息保持未读                                                                                                       |
| `GET /auth/sessions`                | 当前登录账户                                                       | `{items:[{id,device,createdAt,lastActiveAt,expiresAt,current}]}`；仅本人有效会话、ID 唯一、恰一个 current；日期为 ISO；不得返回 token、Cookie 或凭据          |
| `POST /auth/password`               | 当前登录账户；`{currentPassword,newPassword}`                      | 204；当前密码正确，新密码 12～128 字符且不同于旧密码；原子更换凭据并撤销全部会话；审计只记录操作元数据                                                        |
| `DELETE /auth/sessions/:id`         | 当前账户拥有该会话；`{}`                                           | 204；撤销当前会话需重新登录，未知或他人会话按不存在处理                                                                                                       |
| `POST /auth/sessions/revoke-others` | 当前账户；`{}`                                                     | 204；保留当前会话，撤销已有其他会话                                                                                                                           |

批量状态示例：`{"status":"disabled","items":[{"id":"member-001","version":1}]}`。成功项的 user 为完整 User 对象，例如 `{"id":"member-001","name":"Member 01","email":"member1@community.test","status":"disabled","roleIds":["viewer"],"version":2,"createdAt":"2026-10-01T00:00:00.000Z","updatedAt":"2026-10-13T00:00:00.000Z"}`；失败：`{"items":[{"id":"mock-demo","success":false,"code":"conflict","reason":"protected-user"}]}`。

## 数据与兼容

Mock 保持 `clouddrive.auth-mock` 原键，version 5 原地迁移 v1～v4，保留账号、凭据摘要、角色、用户、通知、审计和注册策略。有效旧会话补充一条兼容元数据，新模拟登录生成可撤销会话；活动时间按恢复节流更新。密码保存盐与 PBKDF2 摘要，不保存明文。账户边界、持久化写失败、版本冲突继续使用原有机制。

真实后端尚未联调；须实现授权、成员变更与批量结果的事务边界、可信审计、服务端会话失效和密码策略。Mock 的客户端存储可被修改，也不模拟跨设备服务器认证；已有浏览器多标签统一账号机制保留。

## 验证进度

类型、架构与 Foundation 检查已通过。新增契约单测 32 项通过，覆盖 Mock 与 HTTP adapter、部分失败、成员冲突、审计时间、通知已读、密码与会话、迁移及无秘密响应。

首批浏览器记录见 [日志](evidence/browser-first.txt)：9 通过／7 失败；四项新增脚本用了隐藏输入的直接点击或错误 Dialog role，已修正为键盘与 alertdialog；审计测试旧 URL 断言已更新；工作台旧通知按钮精确名已改为包含未读数的实际名称。策略矩阵须在停止热更新后复核，不能用该首批结果宣布完成。最终全量门禁与视觉清单待补充。

日期返回／清空复核确认了必要的公共能力缺口：DatePickerField 新增字符串受控 value，未传 value 的消费者保持原行为，UI Elements 与审计同源消费。已完成外部 Form Elements 校准、官方 API 复核、33 项契约单测、320／390 实际回填与清空、Calendar／确认浮层 Axe 和焦点验证；九个 Family 使用原视觉基线通过。通知抽屉的全部已读动作保持节点，完成后切换为可执行的刷新动作，避免移除当前焦点后 Escape 无法关闭。

首次完整视觉扫描 62 项中 58 项通过，四项仅为原基线差异，见 [整批视觉对照](evidence/visual-review/index.html)。实际变化为首页删减和新增系统管理分组；四项为 overview-desktop、surface-shell-parent-navigation、surface-shell-compact-flyout、surface-shell-compact-sibling-swap。后续获整批人工认可并更新这四项基线，阈值不变。

用户已整批认可完整视觉清单，明确授权更新上述四项基线；已限定复制经过审阅的 actual 图，不修改阈值。全量扫描另发现 ui-elements-desktop 整页基线仍含早期品牌与导航，补充原图／当前图／差异图后单独获认可并更新；九个 Family 内容区仍保留原基线。

修复后的全量检查已通过 438 项单测、构建与性能：initial=371277、maxRoute=/page-archetypes/resource-list:438280、CSS=48426、largestChunk=84658 字节。浏览器扫描发现两项新标签测试仍点击删除的首页快捷入口，改为产生访问记录并点击最近访问；另一个注册策略测试仍按英文 Operator 匹配中文角色名，改为“操作员”。这些是产品变化对应的断言更新，不修改运行时、规则或截图阈值；整批扫描和集中复验结果分别保留。

最终浏览器覆盖 360 项：整批 354 通过／6 失败；五项旧断言分别涉及已删除的自动恢复开关、两个旧快捷链接、中文角色名和导航字段从 12 变为 11，另一个整页旧视觉基线如上获批。修复后集中复验六项全部通过。原全量 `pnpm check` 的浏览器阶段退出 1，未将该原始记录改写为退出 0；未再次重复整批已通过用例，单独补齐修复项和后续门禁。完整记录见 [全量日志](evidence/check-final-complete.txt)、[六项最终复验](evidence/browser-final-approved.txt) 和 [整批截图与失败诊断归档](evidence/browser-full-artifacts.zip)。

实际操作已验证首页草稿不跳转且手动恢复、当前页批量部分失败、角色成员增减、审计主体／对象／日期筛选与详情返回、注册策略关闭／开启和默认角色注册、通知检索／分页／已读与顶栏同步、密码错误／成功后重新登录、当前会话撤销及 Backend 其他会话撤销。接口单测补充最后管理员保护、版本冲突、归属边界、迁移、严格响应与禁止 Mock 回退。中文浅色／英文深色、五种宽度、键盘焦点、Overlay、Axe 与既有公共回归均保留证据。真实后端未联调。

收尾 ESLint、Prettier、docs:check 和 git diff --check 均通过。本轮生成的旧阶段截图副本归档在 evidence/existing-regressions，109 历史文件恢复；未修改规则、预算或差异阈值。现有 HeroUI PressResponder 及终端颜色环境警告仍可见，没有被隐藏；本轮测试未发现对应交互或 Axe 失败。

全量构建发现审计页首屏 JS 超出原 430 KiB 预算：新增日历和表格直接加载导致 493912 字节。日历随筛选展开加载，表格在数据就绪后加载，仍使用相同 Adapter 实现、受控日期与 URL 状态。未调整预算或隐藏检查；修复后的全量检查继续覆盖操作与可访问性。

## 下一阶段依赖与交付边界

真实后端需按上述契约提供 Cookie／CSRF 认证环境、测试账号及角色权限、可复现的并发版本冲突、批量部分失败、最后管理员保护、通知分页和新消息时序夹具。账户安全需由服务端证明密码变更原子性、全部会话撤销、跨设备会话列表与后续请求失效，审计与日志不得包含凭据。请求夹具只能证明客户端契约和交互，不能代替这些服务端保证。

新增账户安全、分页查询及成员管理使用已有入口和 URL；没有新增空页面，也没有引入平行基础组件体系。必要的公共扩展仅为 DatePickerField 的受控日期值，已由 UI Elements 与业务同源验证。当前产物预算虽通过，最重路由距上限约 2 KiB；后续新增能力应继续按使用时机拆分，不能扩宽阈值掩盖增长。
