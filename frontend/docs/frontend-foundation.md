# Universal Frontend Foundation

Universal Foundation 只承载跨 Product Surface 成立的契约。

| Workspace         | 当前职责                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `design-system`   | Light/Dark、Density、Contrast、Layout 与 Motion Token；跨 Surface Motion Primitive                                       |
| `ui-adapter`      | UI Element、Overlay、Accessibility、Keyboard、Focus；唯一 HeroUI/React Aria 边界                                         |
| `form-foundation` | Schema 驱动的 dirty/pending/reset/首错聚焦/字段桥接；唯一 RHF/Resolver 边界                                              |
| `i18n`            | runtime、Provider、translation hook 与日期/数字/相对时间格式化                                                           |
| `core`            | 不依赖 React/Host/数据源的纯语义判断                                                                                     |
| `schemas`         | Universal Schema 类型、结构化 issue 与 Schema-Controlled Authority Runtime（`./runtime`），不保存 Product/Reference 字段 |
| `types`           | 已证明跨 Workspace 稳定的共享类型                                                                                        |

Universal 禁止出现 Product Page、Product Workspace、Next Router、Browser/Desktop API、后端 DTO、权限计算和业务状态机。UI authority 为 `/ui-elements/*`，Motion authority 为 `/motion`。

### Schema-Controlled Authority（`@clouddrive/schemas/runtime`）

正式 Authority 可以把自身事实收拢为**一份** Authority Schema
（`packages/design-system/design-system.schema.json` 是第一例，覆盖 Token 与
Motion Language facts），由 `@clouddrive/schemas/runtime` 统一提供校验、RFC 6902
Patch（内容哈希 etag 并发冲突）、确定性生成与 freshness：

- Authority Schema 使用 Draft 2020-12；`x-clouddrive` 是正式注册的 extension
  keyword（Ajv strict，不关闭校验）。`source` 实例结构由 `$defs.authoritySource`
  定义；**所有可配置值只在 `source` 下**，facts/Artifact mapping 只经 Source
  Pointer 引用，Source 内 Token 间引用为结构化 ref（不保存 `var(--*)` 等 CSS 表达）。
- `contractRef` 指向 `tooling/foundation-contracts.json`（RFC 6901 转义 pointer）；
  layer/owner/maturity/exports/evidence 仍以 registry 为唯一 Source，Schema
  **不得重新声明** registry-owned 字段。
- 内置 Generator 只做通用映射：`css-token-regions-v1` 按 Artifact mapping 的
  模板/名称规则只重写 tokens.css 的受控 marker 区段（marker 外字节原样保留）；
  `css-motion-language-v1` 从受控 Motion Language（opacity/width/translate
  operation）整文件生成 motion.css。两者均带 generated header / freshness 门禁。
- 工作流：`pnpm codegen:design` 生成、`pnpm codegen:design:check` freshness
  （纳入 `pnpm check`）；`pnpm dev` 启动 Schema Watcher 与 Plugin Watcher、
  Next dev 并行，Schema 变更自动重新校验并生成 CSS。

Vendor 类型不得穿透公共 Contract；具体 Surface 通过内容、状态、资源和 Port 组合这些能力。

HeroUI 的 Trigger 与 React Aria Components 的 Provider 必须解析到同一个 `react-aria`
交互实例。仅满足各自的版本范围不足以保证上下文相连；`dependency:check` 会检查实际安装图。
UI Adapter 的 RAC 当前由锁文件解析为 `1.22.1`，与 HeroUI 的交互实例一致。紧凑侧栏的 hover、
focus、Escape 和原生链接导航由同一浏览器用例验收，禁止以自制 Tooltip 绕过失联问题。

### 外观 Profile 的所有权

Design System Schema 的 `source.tokens.appearanceProfiles` 管理既有 density、fontScale、
contentWidth 和 contrast Profile，生成 `tokens.css` 的受控区段。数值仍采用原有
compact/default/comfortable、small/default/large、standard/wide 与 contrast 规则；
本次权威化不改变用户偏好、数值、选择优先级或持久化 key。Host 只装配已选 Profile，
Page 不创建第二份数值表或手改生成 CSS。

默认控件使用语义 control-height 随 density 变化；明确的 small、embedded 变体保留
其用途尺寸，不把紧凑配置行变成所有 Radio/Switch 的默认。字体、内容宽度和高对比度
与 density 是独立维度，组合验收归 `/ui-elements` 和真实 Settings 消费者。
实施/迁移与当前验证见 [质量与证据](quality-evidence.md)。

Universal 之下是 [Surface Foundation](surface-foundation.md)（可复用产品视觉/Pattern）、
[Plugin Framework 与 Surface File Routes](plugin-framework.md)（契约/Registry/Host Capability/Codegen）
与 `surfaces` 插件实现；它们与 Universal 的边界由 `tooling/foundation-policy.json`
与 `tooling/foundation-contracts.json` 机器校验。

### Form 的异步提交生命周期

Form Foundation 在异步校验与提交期间只接受一次提交，校验失败或提交结束后释放；
原生 Enter/requestSubmit 与按钮使用同一入口。表单卸载后尚未完成的校验不再调用
业务提交回调，避免过期写入和导航。RHF 继续拥有 dirty、errors、isSubmitting 与
首错定位，Feature 使用正式控件 Pending/Disabled，不复制表单状态机制。

已经开始的业务操作由其 Owner 管理取消和资源清理；本地示例的 Browser Adapter
清理定时器并结束等待，卸载后不发布旧 UI 反馈。消费者和行为证据见
[质量与证据](quality-evidence.md)。

`FoundationForm` 可提供原生 `id`，让 Dialog 固定页脚中的 `Action form={id}` 通过同一个
Schema、提交锁和错误焦点入口提交。受控字段的 `ref` 是注册回调；它连接实际输入控件，
不把 RHF 对象传出边界。存储限额与名称规则是实际使用方，外部按钮与嵌套字段焦点有独立回归。

### 按需语言资源

`@clouddrive/i18n/format`提供无React的瞬间格式化、有效时区和运行环境候选；文件瞬间先按所选时区求日期再按用户格式显示，纯日历日期继续保持原语义。`@clouddrive/i18n/temporal`独立封装现有Adobe日期库的壁钟时间转换，第三方对象不出边界；跳过时间拒绝，重复时间显式选择早/晚。转换模块不从主入口重导出，分享等惰性消费者按需加载；不得在Feature复制偏移计算或Intl格式器。

`FrontendI18nRuntime.addResources(TranslationResources)` 通过 i18n 内部公开的资源
注册能力深合并文案，保持单一运行时、原资源与当前语言，不向 Host/Feature 暴露
i18next 实例。所有语言在写入前按 supportedLocales 校验，非法资源不部分写入。
用于独立加载的产品界面和 Plugin 文案；目前 Web Authentication 在界面加载时注册，
管理 Shell 也在自身运行时加载时注册。账户菜单的双语消息随菜单自身加载，文件工作区直接进入时不依赖管理 Shell 先挂载，也不提前载入整个管理 Shell 词典。启动仅保留启动、文件入口和认证实际使用的 Host 文案；
登录页不加载快捷偏好、导航操作和锁屏说明。语言切换 API 不变。
锁屏也随组件安装自己的双语消息；密码显隐与认证错误使用 Host Auth 的窄消息模块，由登录与会话密码复核共同消费。只携带会话 Cookie 的新运行时直接进入文件区，也能得到完整锁屏、空密码和服务不可用提示，不依赖之前打开认证页。验证见[文件入口锁屏回归](../file-tests/file-lock.spec.ts)。
Host 的控件语言边界消费同一 i18n runtime 的当前 locale，并传入已选周起始日；UI Adapter 接到 React Aria 的 locale context 和日历起始日，不再让浏览器初始语言覆盖应用选择。日期分段、内置辅助名称与月份同步切换；日期事实及用户选择的纯日期输出格式分别保持原所有者。验证见[控件语言与审计日期](../apps/web/e2e/control-locale.spec.ts)。
验证见 i18n 单元及认证双语言/两模式浏览器；不引入第二套翻译 Provider。

页面自身拥有的补充文案使用 `FrontendMessages resources={模块常量}` 包住消费者。
它通过同一个 runtime 的 `addResources` 安装资源，安装前显示 `fallback`，安装失败进入
现有错误边界；切换 runtime 时重新安装，卸载取消尚未开始的安装。资源对象须保持稳定，
顶层键由该页面所有者独占，不能覆盖其他所有者的词。该组合不读取网络、不持有路由或用户偏好，
也不引入第二套翻译 Provider。系统工具的存储策略和运行状态是实际消费者，
`/foundations` 展示同一组合；登录初始包不再携带这两页的完整文案。
