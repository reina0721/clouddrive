# Authentication 专项审查与实施方案

2026-10-09。承接108/109与账户菜单专项；完整目标来自用户提供的认证目标文件。
页面、布局、模式、会话、身份、路由和全量验收全部保留，不以服务封装代替完成。

## 当前缺口与边界

RootLayout直接包裹AppShell，无认证服务、API Client、Session或认证路由；账户身份固定Rin。
复用现役Form Foundation、UI Adapter、Motion、Shell设备偏好和State Foundation。
认证服务/Browser Adapter/会话/Next访问控制归Web Host，不让Surface依赖HTTP或Session，
不在Plugin Contract增加认证模式/页面模板/逐路由权限配置，不创建第二Router。

## 布局与页面

共享root保留主题/i18n/Motion/错误边界；Next真实Route Groups区分：

- `(public)`：公共产品/认证说明入口，不包含后台Shell。
- `(auth)`：/login、/register、/session-expired及错误恢复，没有Sidebar/Header/PageTabs。
- `(app)`：现役Plugin路由，恢复验证后才挂载AppShell和业务子树。

生成器只改变Host输出目录，Plugin identity/mount/导航保持；不手改生成物。
匿名深链保留内部returnTo，拒绝外部/认证自身目标；已有会话访问认证页返回目标。
恢复中稳定加载，失败可重试；失效与退出先卸载受保护内容，避免闪烁/循环。

已实际浏览TailAdmin React /signin及/signup，参考其品牌区/表单区分工与标题、密码、
页间导航；不复制DOM/CSS/图片/尺寸。项目采用品牌说明+表单的桌面布局，移动端收敛；
登录邮箱/密码，注册名称/邮箱/密码/确认，密码显示切换、规则、校验、Pending与错误。
没有实际OAuth、条款/隐私文件、找回/重置/邮箱验证，不制造假入口；这些能力待后端。

## 配置和统一服务

NEXT_PUBLIC_AUTH_MODE=mock|backend，NEXT_PUBLIC_AUTH_API_BASE_URL用于Backend。
Next public变量为构建期，部署后修改须重新构建。开发缺省mock；生产必须显式配置，
缺省/非法配置失败关闭，明确mock可部署演示。Backend异常绝不回退模拟，无公有密钥。
AuthService统一restore/login/register/logout，页面不判断mode。

Mock演示：demo@community.test / CommunityDemo2026!；注册保存随机salt和PBKDF2摘要，
不保存明文密码。会话30分钟，可刷新恢复/过期/退出；客户端控制记录不是安全授权。
Backend为可替换Cookie-session提案，无真实服务器可联调；凭据由服务器Cookie保管，
当前用户只在内存。CSRF只在写请求生命周期使用，响应逐字段校验，15秒超时。

| 方法/路径（API base之后） | 契约                                                  | 接入状态 |
| ------------------------- | ----------------------------------------------------- | -------- |
| GET /auth/csrf            | `{token:string}`，写请求带X-CSRF-Token                | 待联调   |
| POST /auth/login          | `{email,password}`；204并设置会话Cookie               | 待联调   |
| POST /auth/register       | `{name,email,password}`；204并建立会话                | 待联调   |
| GET /auth/session         | `{user:{id,name,email},expiresAt:number}`，毫秒时间戳 | 待联调   |
| POST /auth/logout         | `{logout:true}`；204并销毁服务器会话                  | 待联调   |

credentials include/no-store；401、403、409、网络/超时/协议/服务不可用保持独立错误语义。
后端需实现CORS credentials、Origin/CSRF检查、Secure/HttpOnly/SameSite、授权与失效。
依据[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
和[CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)。
当前接口封装与受控测试不等于真实后端安全认证已验证。

## 状态与身份

统一Host Store管理恢复/提交/失效/退出；旧请求结果不得覆盖新会话，重复提交受控。
统一计时、可见性恢复重新验证。身份UI来自session.user；无资料页面不增入口，退出
调用服务。退出/切换清除工作台、草稿、页签和私有通知，主题/语言作为设备偏好保留。
当前无额外权限业务，不制造权限引擎；Backend 403保留Access Denied反馈。

## 验收与当前状态

覆盖Mock注册/摘要/失败/恢复/损坏/过期/退出，Backend CSRF/正常/401/403/409/网络/
超时/协议/不回退；配置与returnTo。浏览器覆盖匿名深链、注册/登录/刷新/退出/失效/
已有会话/跨用户隔离、两mode共用UI、320/390/平板/1440/2048、Dark/English/大字号/
Reduced、键盘/焦点/Axe及全部状态。完整pnpm check与既有回归，新截图仍须人工确认。
真实Backend端到端标记待联调。布局、生成器、页面、会话与身份已接入；Mock 15 项
流程/五视口/大字号输入验证与 Backend 3 项受控浏览器契约已通过。用户确认本轮7项视觉
后限定更新，完整项目 `pnpm check` exit 0：403单元、329浏览器、构建、原预算与全部
门禁通过；最终数字及失败过程见验证记录。

公共密码输入先核对 HeroUI InputGroup 官方公开 anatomy，并实测 TailAdmin Form
Elements 的密码切换、正常/错误/禁用状态。沿用原 form-field export、现役表单桥接
与 Token，不新增交互状态系统；新增同源 `/ui-elements/forms` Showcase。320px
确认密码 suffix 导致的固有宽度溢出已在 Adapter 通过 flex 收缩修复，未改普通字段。

Host 已登录身份切换先清理持久化私有记录，再保持后台卸载直到新文档加载，防止旧
Plugin 内存缓存被下一账户复用。跨标签页会话写入也重载，Mock 每次操作读取最新
持久化快照。未知版本/损坏记录报错且保留原值；不自动删除演示账户。

大字号英文注册页额外检查发现文字式密码切换将 320px 确认密码输入宽度挤至
45px；改用具有完整可访问名称的 Eye/EyeOff 图标，输入空间与键盘操作均复验通过。
账户菜单新增退出项后，短窗口需要独立滚动：由 HeroUI 提供可用高度，Adapter
外部具名可聚焦区域承载滚动，不改 Collection 焦点契约；键盘 End 可到达退出项。

认证启动采用中性加载页，不显示后台骨架。Auth Runtime、服务、错误页、账户菜单
按使用阶段加载，认证文案经现有 i18n 实例的增量资源接口注册，避免全局首包携带
完整认证界面。原性能预算不变；完整回归的最终数字以验证记录为准。

全量验收确认 Tabs 首次挂载叠加 Content Swap 导致详情短暂低对比度。现役
Transition 只在真实 key 替换后进入，Tabs 惰性 Panel 传递选择变化生命周期；
原键盘和布局保持，初始内容不再执行替换动画。Backend 登录/退出通过无身份数据的
BroadcastChannel 信号让同源标签重新验证会话；没有该 API 时仍由焦点恢复验证。
