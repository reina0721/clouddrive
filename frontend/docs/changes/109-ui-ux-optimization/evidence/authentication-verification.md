# Authentication 实施进度与证据

2026-10-09，前端目标完成验收，真实后端待联调。

最终 `auth-check-approved-final.txt` 完整 `pnpm check` exit 0：403 单元、329 浏览器、
生产构建、原性能预算及全部治理/类型/Lint/格式/文档门禁通过。329 项含 15 项 Mock
认证与 3 项 Backend 受控协议、全部共享组件与既有流程、已批准 7 张新/变更基线。
预算 initial 374019、maxRoute 439158、CSS 47963；没有放宽阈值或规则。

已阅读完整目标并审查Next root布局、Plugin codegen、Store/Provider/Form和Adapter边界。
浏览器实际查看TailAdmin React登录及注册，方案与契约见
[认证审查](../design/authentication-review.md)。原108审查和109入口/任务表已补充。

Public/Auth/App真实Route Groups、38个生成器Host adapters、登录/注册/过期/欢迎页面、
统一身份菜单与退出已接入。Host-owned契约、非法生产配置失败关闭、内部returnTo
校验、Mock加盐PBKDF2/恢复/过期与Backend Cookie/CSRF/超时/错误均复用统一服务。
当前用户唯一内存Store拒绝过期请求与重复提交；退出前立即隐藏受保护内容，跨用户
清理私有记录、跨标签页重载，并保留设备偏好。共享启动加载面已移除后台骨架。

专项测试auth-service-unit.txt覆盖注册摘要无明文、同源跳转、生产模式、后端CSRF/
登录后恢复/401/网络/协议/超时、模拟身份与过期，以及会话控制器退出/恢复竞态/失败。
独立Web类型检查首次遇到四条临时生成模块解析失败；确认文件存在，禁增量复验通过，
不是修改生成物或放宽边界。测试可空索引、Promise写法和控制字符规则已修复。
当前类型/Lint检查日志auth-typecheck.txt、auth-lint.txt；后续每次改动继续按范围验证。

`auth-unit-current.txt`扩为17项通过，包含真实持久化快照、损坏/版本保留与修复恢复、
密码输入值/自动填充/禁用/错误/显示语义；随后增加两项身份重载和清理失败保护测试。
`auth-browser-integrated.txt`17项全部通过：14项Mock/布局/键盘/恢复/深链/损坏/退出/
过期/跨标签页/设备偏好和私有清理，以及3项Backend模式受控API契约，包含注册Pending/
成功、退出失败隐藏与重试。320/390/768/1440/2048四公共页面布局/Axe，以及320/1440
英文深色Reduced。实际注册身份截图在authentication/manual-registered-identity.png。

公共PasswordField先实测TailAdmin Form Elements正常/错误/禁用和密码切换，采用
HeroUI公开InputGroup anatomy，并在UI Elements/forms同源展示。320px确认密码输入
溢出已通过Adapter flex收缩修复，不改普通TextField默认。原失败日志保留；英文主题
测试按真实名称修复后单独与综合复验通过，不增加超时。

完整auth-check-initial.txt中治理、Lint、类型、全部单元和生产构建通过，但最重路由
452301B超出原440320B预算，未进入全量浏览器。随后按需加载认证状态/404/会话运行时/
身份菜单，复用中性启动面；各次构建、失败和测量保存在auth-build/auth-performance
系列日志。部分诊断测量发生于新构建完成前，仅最终已完成构建的测量作为对应证据。
认证文案使用现役i18n新增受控资源注册，仍共用同一运行时与语言。

最新 `auth-check-final-retry.txt` 已通过治理、Lint、类型、403 项单元、生产构建和
原性能预算：initial 374019B，最重 resource-list 路由 439160B（上限 440320B），
CSS 47957B。328 项全量浏览器回归进行中，不提前记作全部通过。
此前完整检查的临时类型错误与本次菜单滚动静态误报均保留失败日志。

大字号英文 320px 注册输入的可用宽度和 Axe 已复验；密码切换使用带完整名称的
图标。菜单具名滚动区域经过短窗口布局、Axe、触屏与键盘 End 到退出项验证，
最终专项日志 `authentication/auth-menu-scroll-region.txt` 与
`authentication/auth-menu-keyboard-scroll-final.txt`。仅滚动区域属性有 W3C ACT
依据的 lint 误报注释，未修改全局 lint、Axe、截图阈值或预算。

`auth-check-final-retry.txt` 最终为 300/328 通过、28 失败（exit 1），不是完整通过。
失败包含旧 404 文案、会话恢复前提前读取/快捷键/滚动，首次 Tabs 内容重复淡入的
对比度问题，以及服务短暂拒绝连接导致的末段截图与工作台检查失败。原失败 PNG/MD
归档在 `authentication/full-regression-failures/`，原日志保留。
就绪判断改为等待真实内容，未增加超时；`auth-browser-regression-retry.txt` 74/78
通过，剩余为新就绪断言中错误的设置标题、Tabs 对比度与两项新 Form 截图差异。
设置标题按实际“外观”修正；Tabs 初始不再替换淡入，仅选择变化播放。
`auth-tabs-initial-verify.txt` 23 项通过（exit 0），含四级视口全部七类 Archetype Axe、
初始/切换/返回 Tab、设置预览及原 Motion 流程。随后已纳入当前源码完整复验。

新增认证桌面/移动端和英文深色大字号共 5 项视觉比较；全局 `updateSnapshots:none`
禁止未确认的首次基线自动写入。授权前仅归档候选，不创建或更新 golden。

当前 `auth-check-pre-visual-review.txt` 与 `auth-check-pre-visual-review-retry.txt`
两次都通过源码门禁、类型、403 单元、生产编译与静态页面生成，但 export 删除
`apps/web/dist` 时报 EBUSY，exit 1，未进入预算及浏览器阶段。只读进程检查确认
PowerShell 30312 的当前目录停留在该输出目录；已请求用户切回根目录，没有终止
用户进程或更改构建/预算规则。用户确认已切回根目录后，
`auth-build-after-directory-release.txt` 生产构建通过（exit 0）；
`auth-performance-after-directory-release.txt` 预算通过（exit 0）：initial 374019、
maxRoute 439158、CSS 47963，未修改预算。

`auth-browser-pre-visual-review.txt` 完整 329 项复验为 323 通过、6 个用例失败（exit 1）。
其中 5 个用例仅涉及 5 张新认证基线缺失与 2 张 Form 展示页预期变化；另一个进度条
布局检查在会话恢复完成前读取 Header，before 为 null。改为等待 Header 可见后再
测量，保持原尺寸相等断言；`auth-top-progress-restoration-verify.txt` 全部 8 项通过（exit 0）。
全部 Backend 受控协议 3 项通过，包含新增跨标签退出检查。
7 项独立视觉候选、旧基线、差异及 SHA-256 归档在
[Authentication 视觉确认](authentication/visual-differences/index.html)，尚未写入 golden。

用户于 2026-10-09 在打开本批对照时回复“确认”，授权本轮全部 7 项。已在写入前
校验全部候选与旧 golden SHA-256，仅创建 5 张认证新基线、更新 2 张 Form 基线。
原图与差异保留；[更新记录](authentication/visual-differences/baseline-update.json)
记录范围及前后校验值。`auth-check-approved-final.txt` 最终完整检查通过，exit 0。

本轮全部前端范围通过，原失败日志和对照保留。此前28项Scroll Reveal
和4项账户菜单批准独立于本轮7项批准。配置与待联调API契约见
[Web Authentication](../../../../apps/web/src/auth/README.md)。Backend受控契约测试不代表
真实API、服务器授权或安全Cookie/CORS/CSRF已完成联调；最终不得宣称真实Backend已验证。
