# 前端开发守则

> 请先明确 `tmp/` 下的规则

## 1. 适用范围与目标

本文件约束 `/frontend` 内的人工开发与 Coding Agent。这里是全新的统一前端根目录，与根 `webui/`、`old-frontend/` 及其它 legacy product 完全隔离。基础建设阶段不得复制旧系统的 DOM、CSS、组件、页面结构或交互实现，也不得研究后端接口来反向塑造新架构。

技术基线是 React 19、HeroUI v3、Tailwind CSS v4 与 Next.js 16。Next.js 属于 Web Host 与 Product Surface 的 Plugin `routes/`（真实 Next App Router 子树，route 模块在受控白名单内可用 `next/link`/`next/navigation`），不得进入 Feature、Core、Schema、Surface Foundation、UI Contract 或 `plugin-framework`。

## 2. 架构地图

```text
Universal Frontend Foundation
  design-system / ui-adapter / form-foundation / i18n / core / schemas / types
        ↓
Current Product Surface
  packages/surface-foundation  可复用 Layout、Pattern、State、Motion、Shell 表现
  packages/plugin-framework    Plugin Contract、Route Target、Registry、Host Capability
  surfaces                     唯一 Surface 的 Shell、Composition、Plugin 与生成物
        ↓
Application = Product Surface × Runtime Host
  apps/web                     Next.js、Browser Runtime、Host Port 实现、Composition Root
```

Product Surface 与 Runtime Host 是正交职责。当前只有一个后台产品 Surface 和一个 Web Host，因此位置直接使用 `packages/surface-foundation`、`packages/plugin-framework`、`surfaces` 与 `apps/web`：位置表达 Scope，名称表达 Responsibility，package 表达 Capability。只有出现真实并列产品时，才允许引入用于区分同级 Scope 的产品限定词。Universal 禁止依赖 Surface/Host；Surface 只能依赖 Universal 和自身 Surface；Host 只负责装配 Surface。机器可读分类以 `tooling/foundation-policy.json` 为准。唯一真实 Router 是 Next.js App Router；Framework 不读取 pathname、不维护 history、不复制 Next Route Runtime。

文档入口固定为 `frontend/README.md -> docs/README.md -> 主题 authority -> 局部 README/AGENTS`；任务研究、需求与实施证据只保存在 `docs/changes/<seq-num-name>/`，不作为当前架构 authority。

## 3. Host 与共享边界

- `web` 是当前唯一 Runtime Host；未来只有真实 Product Surface 与 Runtime 同时出现时才创建新的 Host，不预造空 Desktop 契约。
- Host 拥有启动入口、Shell、路由或窗口结构、平台生命周期、Error Boundary 和平台 Adapter 装配。
- DOM、History、Storage、Next Router 与 View Transition 生命周期只留在 `apps/web` 或明确 Browser Adapter；Surface Foundation 只能消费 Router/Leave Confirmation 等 Port。
- 同一 Product Surface 的 Web/Desktop 未来共享对应 Surface Foundation 与 Feature；不同 Surface 不为表面复用强塞进万能 Pattern。
- 不得复制两套近似逻辑；也不得为共享而把平台对象、条件分支或最低公分母接口塞入 Core。

## 4. Design System 与样式

- 色彩、Typography、间距、尺寸、圆角、边框、阴影、层级、控件高度、状态色、动画时长和缓动只能由 `packages/design-system` 的语义 Token 管理。
- 页面使用 `bg-surface`、`text-ink-muted`、`rounded-panel` 等语义 class，不硬编码 hex、rgb、阴影、圆角和动画时长。
- 禁止 arbitrary value、深层选择器、样式穿透、`!important` 和针对 HeroUI 内部 DOM 的修正。
- 合理差异先通过 Variant、size、density、state、slot、composition 或 context 表达；不得为一个页面修改全局默认 Token 或公共组件默认行为。
- 复杂组合避免成形组件套成形组件。已有外壳进入 Panel、Dialog、Sidebar 或 Form 时，优先使用 primitive、embedded、inset 或 slot composition。
- TailAdmin React Demo 左侧 `UI Elements` 是长期外部视觉校准基准；新增或修改公共基础组件前，必须进入对应具体页面检查完整状态，不得只浏览首页，也不得复制其源码、DOM、CSS、图片或具体尺寸。
- HeroUI 负责 Accessibility、Keyboard、Focus、Overlay 与 Portal，TailAdmin 用于校准后台产品视觉，项目最终规范由 Semantic Token、UI Adapter 和 `/ui-elements` 的 9 个 Family 页面决定。具体矩阵与复核触发器见 [UI 视觉校准基线](docs/ui-visual-calibration.md)。

### 4.1 HeroUI v3 与 Tailwind CSS v4 官方互补基线

- HeroUI v3 官方建立在 Tailwind CSS v4 与 React Aria Components 之上。新增或修改交互组件时，必须先选择正确的 HeroUI primitive、compound anatomy 和可访问状态，再使用项目 Token 与 Tailwind composition 表达产品视觉；禁止用 Tailwind 或自研 React 状态重复实现 HeroUI 已提供的 Selection、Collection、Keyboard、Focus、Overlay 和 Pending/Disabled 机制。
- 只有 HeroUI 的直接 import，以及对 HeroUI compound parts 的 Tailwind styling，必须收口在 `packages/ui-adapter`。允许的结合点是 HeroUI 官方公开的 `className`、compound parts、documented data attributes/render props 和 responsive utilities；禁止依赖未公开 slot、内部 DOM 层级、深层选择器或把 vendor props/class 向 Feature、Page 透传。
- Tailwind CSS v4 可在整个 `/frontend` 使用。其 `@theme`、CSS theme variables、utilities 与 variants 负责把项目 Semantic Token 映射为 Light/Dark、Density、Responsive、Container、Focus、Contrast 和 Reduced Motion 等视觉规则；需要 utility 的 Token 使用 `@theme`，不应生成 utility 的运行时变量使用受控 CSS variable。Feature、Page、Host 与公共包可以消费项目语义 class，但不得用 Tailwind selector 穿透 HeroUI DOM 或绕过 Token 所有权。
- 多维 Variant 或 compound slots 在 UI Adapter 内优先复用已安装的 `@heroui/styles` `tv` 与官方 component variant 基线，再收敛为项目语义 props；局部单态样式直接使用 semantic utility，不得为了形式统一机械引入 Variant Wrapper。
- 以上规则的当前官方依据是 [HeroUI v3 Introduction](https://heroui.com/en/docs/react/getting-started)、[HeroUI Styling](https://heroui.com/en/docs/react/getting-started/styling)、[HeroUI Migration](https://heroui.com/en/docs/react/migration)、[Tailwind Theme Variables](https://tailwindcss.com/docs/theme) 与 [Tailwind States and Variants](https://tailwindcss.com/docs/hover-focus-and-other-states)。HeroUI/Tailwind 版本、官方 styling/compound API 或浏览器基线变化时，必须定向复核官方文档并同步本规则与项目 UI authority，不得沿用过时集成方式。

### 4.2 Motion 分层与治理

Motion 主题的唯一当前权威文档是 [Motion Foundation 与语义动效分层](docs/motion-foundation.md)，本条款只保留长期稳定底线：

- Motion 属于 Design System 的语义基础能力。Duration、Easing、位移距离、Scale、Opacity 与 Reduced Motion Policy 由 `packages/design-system` 统一定义，页面和 Feature 不得硬编码动画时长、缓动曲线或关键帧参数；业务代码使用用途语义 Token（`--motion-duration-*`、`--motion-distance-*`、`duration-*` utility），不直接书写数值。
- 动效按职责分层：Universal 管 Duration/Easing/Distance、Reduced Motion、Content Swap/Disclosure 等 Primitive；Surface Foundation 管产品特有 Screen/Shell/State Recipe；Host 只提供路由与 View Transition 生命周期。Overlay 的 Enter/Exit 继续由 `packages/ui-adapter` 与 HeroUI 统一管理。
- 禁止万能动画容器：不得建立同时承担 Layout、Loading、Presence、Navigation 与 Overlay 的动画 Wrapper；动画容器不得隐式改变页面高度、滚动容器、定位上下文或 Layout Contract（动画层与空间层分离）。
- 页面不得以 `fade`、`slide-left`、`scale-in` 等实现型动画作为长期业务 Contract，应优先使用 `screen`、`overlay`、`feedback`、`disclosure`、`content-swap` 等语义 Transition，由底层映射具体 Motion 实现。
- `prefers-reduced-motion` 必须由 Motion Foundation 统一处理；Feature 与 Page 不得各自实现 Reduced Motion 判断。
- 新增动效必须先按 Motion 决策树（权威文档 [Motion Foundation 与语义动效分层](docs/motion-foundation.md) §9）判断变化来自什么生命周期（路由→ScreenTransition、异步状态→AsyncRegion、视口首现→ViewportReveal、挂载/卸载→Presence、折叠→Disclosure、浮层→Adapter Overlay 内部、反馈→Feedback 组件、组件交互→组件自身），再选择对应语义组件；禁止直接写动画类或选择 fade/slide/scale 等实现型动画作为业务 Contract。

## 4.3 架构通用性与产品设计规范边界

核心原则：**架构提供通用能力，AGENTS 规定当前项目如何正确使用这些能力。**

- 架构层（Plugin Framework、Next Route Contract、State Foundation、UI Adapter、Surface Foundation 等）**不得**因当前某一个具体页面风格，把具体视觉、动画或页面模板硬编码进 Plugin Contract 或公共契约。Plugin Contract 只承载 identity/mount/navigation 等装配信息，不要求声明 page motion / page pattern / animation type / concrete UI library / visual style。
- 当前 Web Host 承载唯一后台管理产品：业务页面、Plugin、Feature 开发**必须优先复用和组合项目已有**的 Design Token、UI Element、Page Pattern、Motion Recipe、State Pattern、Feedback Pattern 与 i18n，不得重新发明平行实现。
- Plugin ownership 独立 = 业务 ownership 独立，**不等于**视觉/交互/状态/Motion/Page Pattern 可脱离当前后台产品设计体系。
- 只有现有能力确实无法表达合理的新场景时，才允许扩展 Foundation；扩展前先评估是否具有通用价值，并走 §9 扩展门禁。禁止在单一业务页面用局部 hack 绕过现有设计体系。
- `/foundations`、`/motion`、`/ui-elements`、`/page-patterns`、`/page-archetypes`、`/states` 是当前设计与架构能力的 Authority/Showcase；Showcase 展示的能力必须与真实业务页面使用同一套实现，禁止「Showcase 一套、业务另一套」。

### 4.4 Page Foundation 与页面进入体验

- 权威页面抽象是 `packages/surface-foundation` 的 `Page`/`PageHeader`/`Section`/`Toolbar` 等。正常业务/展示页面顶层使用 `Page`（产出统一 section spacing），区段使用 Header/Section/Panel 等标准组合；禁止手写平行页面骨架（裸 `space-y-*` + 自绘 header 的整页结构）。
- **Page Enter 是统一页面体验，由 Host 自动提供**：`RouteTransition` 在路由变化时对 `.surface-route-content` 设 `data-route-enter`，CSS 仅对非持久 PageHeader 做轻量转场；Page 内语义内容项由统一 Scroll Reveal 按视口进入触发；正常页面无需、也不得手工为整页包裹 ViewportReveal 或自定义 page-enter 动画。
- **方向过渡（forward/back 语义）由 `data-route-kind` + Motion Token 的纯 CSS 驱动**：导航前进时非持久 PageHeader 做克制右入（`surface-enter-forward`，位移 `--motion-distance-enter`）；后退/无方向做轻量抬升，标题保持可读。**禁止依赖 React `ViewTransition` 组件**——stable react 不导出该 API（canary 专属），运行时为 undefined；方向语义一律走 token/recipe + data-route-kind。
- **同路由内容替换（TabsView 等）用 `ContentSwapTransition`**：contentKey 驱动子树重挂 + `.ui-content-swap-surface` CSS 淡入（`data-motion-swap` 门控）；不依赖 View Transition。
- **ViewportReveal 是统一语义内容项呈现能力**：Page 自动启用 items scope；首屏按阅读顺序短错峰，后续独立 Card、Settings Row、List Item 和信息模块首次进入视口时逐项呈现。Section 标题和内容项分别触发，禁止整个多项 Section 套一次 Reveal；恢复位置、快滚和焦点进入直接稳定，不承担、也不代替 Page Enter。reduced-motion 由项目级 Motion Policy（Host）统一控制，页面不自行判断。
- Page/Pattern 只做组合（使用 Recipe 提供的动效），不定义第二套 animation system；业务/Plugin 页面禁内联硬编码 animation/transition 时长或自定义 keyframes（gate 强制）。

### 4.5 Design Token 分层消费与产品语言收敛

产品视觉语言（Accent/Neutral/Surface/Radius/Elevation/Typography/Spacing/Density/Motion/State）由正式 Authority 收敛，页面不各自发明视觉：

- **Token 分层**：Primitive 原始尺度 → Semantic 产品语义 → Component/Pattern 消费。业务消费顺序：已有 Semantic Token / 正式 Element / Pattern 优先；只有真实多消费者 + 稳定语义的值才提升为 Token，禁止 Token Explosion（不为消灭数字制造无意义 Token）。
- **颜色/圆角/阴影/动效**是产品 Visual Signature 的组成部分：业务层禁止直接 hex、raw palette class、`rounded-[..]`/`shadow-[..]`/`text-[#..]`/`duration-[..]` 等 arbitrary design value（gate 强制，UI Adapter 收口 vendor 的受控写法豁免）。写成 Tailwind 不改变"它是硬编码设计值"的事实。
- **Typography 层级**：页面标题用 `PageHeader`、区块标题用 `Section`/`CardHeader` 等组件槽位，不跨页面自定标题字号（同语义标题尺寸漂移即污染）。
- **Surface 层级**优先由 spacing / background contrast / border / typography 表达；shadow 只用于真实脱离页面平面的层级（浮层/弹层），普通页面容器不因嵌套加 shadow。禁止 Card 套 Card 制造层次。
- **Radius/Border** 语义收口：控件、容器、浮层各自有语义圆角；同一组件类别不因页面不同而圆角漂移。
- **Showcase 与业务同源**：`/ui-elements`、`/page-patterns`、`/page-archetypes`、`/states`、`/motion` 展示的 Element/Pattern/Recipe/State 必须是业务真实使用的同一实现，禁止 Demo 一套、业务另一套。
- **公共能力修改规则**：修改 Token / Element / Foundation / Pattern / Recipe 前先查全部真实消费者，回答"是否公共问题、哪些应随变、哪些不应变、是否需要新 Variant、是否只是单场景 composition 错误"；禁止修 Page A 顺手改变 Page B/C/D。单业务场景差异留 Plugin composition，不污染公共组件。
- **Override 是 Architecture Smell**：当业务页需要大量 className override、高 specificity 或自定义 CSS 来塑形时，先检查是否用错了组件层级、是否缺正式 Contract/Pattern，再决定扩展 Pattern——而不是继续堆 override。CSS 主要属于 Design System / UI Adapter / Foundation / 正式 Pattern；Plugin / Page 原则上不新增独立 CSS 文件，优先组合正式 Element / Pattern / Semantic Token 与正常 Tailwind layout utility。

### 4.6 State Management（应用状态）

**Authority**：`@clouddrive/state-foundation`（Universal）。它提供 Store 创建约定（`createAppStore`/`createPersistStore`）、Persistence Contract（`definePersistConfig`：name/version/migrate/partialize 白名单/skipHydration/onRehydrateStorage）、Storage Adapter（`createLocalStorage`/`createSessionStorage`/`createMemoryStorage`/`createIndexedDBStorage`，SSR-safe lazy + unavailablePolicy）、Namespace（`clouddrive.<scope>.<store>`，防裸 key）、hydration lifecycle（`rehydrateStore` 命令式 / `useHydratedStore` React 门控）、testing 工具（`/testing` subpath）。

**决策链**（新增状态先回答）：

1. 谁拥有这个状态？（Component 本地 → React state；Navigable → Next params/searchParams；Server-visible → Runtime/Cookie；Server State → Next/数据层；Business Truth → Backend）
2. 需要跨组件/跨刷新共享 → state-foundation Store；需刷新后恢复 → persist + 显式 `partialize` 白名单。
3. Storage 选择：durable preference → localStorage；current-tab session → sessionStorage；large/async durable → IndexedDB；测试/SSR fixture → memory。
4. 持久化是 opt-in：只持久化显式 durable 字段（preference/配置/draft），禁止持久化 loading/error/transient UI/raw API response/auth secret。

**规则**：

- `zustand`（含 middleware/vanilla）只允许 `packages/state-foundation` import（gate 强制）；业务经 `@clouddrive/state-foundation` 消费，禁止裸 import zustand。
- Store 属于 Owner（filesystem ownership）：Host store → apps/web、Shell store → surfaces shell、Plugin store → `surfaces/plugins/<plugin>/stores/*`；无 Store Registry/Catalog，Plugin 无需中央登记，ADD/REMOVE 不要求改中央配置。
- Plugin 可拥有私有 store（用 state-foundation）；禁止 import Host/Shell/其它 Plugin 私有 store；跨 Host/Plugin Runtime boundary 的能力经正式 Port（plugin-framework 的 locale/navigation 模式），不因 state-foundation 给每个 store 建 Port。
- `@clouddrive/state-foundation/testing` 只允许测试/测试工具消费（production 禁止 import，gate 强制）。
- **UI State Pattern ≠ Application State Store**：`StateSurface`/`AsyncRegion`/`productStates`/Loading/Empty/Error/Feedback 是 surface-foundation 的 UI 状态呈现；state-foundation 管数据/应用状态机制。二者可同页消费但职责不同。
- 迁移/兼容：persist key 变更必须保持老用户数据兼容（用 version/migrate 渐进），禁止静默换 key。

## 5. UI Contract 与组件职责

- `packages/ui-adapter` 是唯一允许直接导入 `@heroui/*` 的边界，Web 入口只导入其聚合后的 Adapter stylesheet。
- UI Adapter 只保护长期高影响能力，不机械封装每个 HeroUI 组件，也不重新制造自研组件库。
- Adapter 对外 props 必须是稳定产品语义，禁止透传 HeroUI props、DOM 结构、slot 名和内部 class。
- Primitive 负责交互基础；通用 UI Component 负责可复用语义；Layout 负责空间骨架；Composite 负责复合交互；Feature/Domain Component 负责业务；Page/Screen 只做路由级编排与状态选择。
- Page 不直接访问第三方 UI、HTTP Client 或 Host 私有实现，不把大段可复用逻辑留在路由文件。

## 6. Core、Schema 与 Types

- Core 必须可独立测试，不依赖 React、UI Library、运行环境、后端或全局可变状态。
- Schema 负责运行时不可信输入、表单模型、配置与未来 API 契约校验。验证失败必须保留可判断的错误语义。
- Types 只保存真正跨模块稳定的 TypeScript 类型；仅在一个 Feature 使用的类型留在 Feature 内。
- 禁止用 `Record<string, unknown>`、任意字符串或断言逃避可明确表达的核心契约。

## 7. i18n 与产品状态

- 所有用户可见文本、日期、时间、数字、相对时间、复数和单位都通过 i18n 基础设施，不在页面硬编码。
- 新功能至少判断 Loading、Empty、Error、Success、Warning、Disabled、Pending、Offline 与 Permission Denied 中适用的状态。
- Skeleton 必须保留目标内容的大致结构；错误状态提供恢复路径；禁用状态说明原因；Pending 与 Loading 不得混用。
- 共享 UI 或 Layout 改动必须先在 Reference/UI Elements 页面中验证正常、长文本、Locale 扩张、窄屏和嵌套组合；状态与组合缺陷优先修复 Token、Variant、Slot 或 Layout Contract，不在页面增加特例 CSS。
- `/ui-elements` 是 Button、Alert、Badge、Card、Dropdown、Modal、Form Control、Notification 与全部 Overlay 的项目级当前权威。业务页面优先复用内部规范，只有缺少合理能力时才回到外部参考扩展基础体系。
- UI Element 分类、Form Control、Anchored Overlay、Overlay Surface、Option State 与 Composition 的当前契约统一见 [UI Element System](docs/ui-element-system.md)；Feature 新增基础能力前必须先按该文档判断复用、Variant、Composition 或新 Element。

## 8. 明确禁止的架构污染

- 在 UI Adapter 外导入 HeroUI，或在业务页穿透第三方 DOM。
- 使用原生 `<select>`/`<option>` 绕过 UI Adapter，或让 Menu、Popover、Tooltip、DatePicker、Command、Dialog、Drawer 等浮层脱离 HeroUI 的 Overlay/Focus 管理。
- 公共包导入 Host，Core 导入 React/网络/浏览器/Desktop API。
- 为单页新增全局 Token、修改公共组件默认样式或增加全局 CSS hack。
- 跨层深相对路径、万能 `utils`/`common`、共享可变全局状态、万能 Provider 或 Service Locator。
- 复制 Web/Desktop 近似组件，或把 Host 条件分支扩散到共享层。
- 占位页面、假接口、空分支、无调用方抽象、无边界价值 Wrapper 和无完成条件 TODO。

## 9. Foundation 扩展与生命周期门禁

- 业务需求必须依次尝试 `Element → Variant → Composition → Pattern → Feature Component`；只有缺失能力具有跨业务通用价值且现有方式无法合理表达时，才允许扩展 Foundation。
- Foundation 新增必须完成：语义分类 → Contract → Token/Motion/State 对齐 → Vendor 边界检查 → Showcase/Reference → Accessibility → Responsive/Dark/Content → Tests/Gates。缺少任一环节不得登记为 stable。
- 页面视觉或业务特例不得扩展 Universal Token、公共 Variant、组件默认行为或万能 Pattern；当前产品专属 Token/Recipe 归 `surface-foundation`，不得回流 Universal。
- 公共导出必须登记在 `tooling/foundation-contracts.json`，成熟度只能为 `experimental / stable / replacing / retiring`，并具备 owner、authority route 与验证证据。替换完成后单轨删除旧实现，Git 保存历史。
- `/ui-elements` 与 `/motion` 是 Universal authority；`/page-patterns` 是 Page Pattern Contract authority；`/page-archetypes` 只证明完整 Page Archetype，不反向成为公共 API。

## 10. 质量门禁

每次改动至少执行与范围匹配的检查；交付前执行：

```powershell
pnpm check
```

`foundation:check` 校验 Workspace 分类、Surface × Runtime 命名、依赖方向、公共 exports、成熟度、authority/evidence 与 RHF/i18next/Next/Intl 边界。`architecture:check` 强制 HeroUI 隔离、原生表单控件禁用、Adapter 内部 Element 样式隔离、Host API 隔离、跨 Workspace 深相对引用、arbitrary value、`!important` 与颜色 Token 归属。新增或修改公共 Element 还必须用 Contract/DOM/Playwright/Axe/Visual 证据证明交互与可访问语义未被破坏。`dependency:check` 校验每个运行时依赖的职责和允许 Workspace；`performance:check` 校验 gzip 产物预算。TypeScript、ESLint、Vitest、Next build 与 Prettier 分别验证类型、静态规则、纯规则、Host 构建和格式。

Playwright 必须覆盖关键 Reference 流程、键盘/焦点、Axe WCAG AA 扫描，以及桌面、超宽屏、移动端、Dark Mode、英文扩张和全部 Floating Layer 打开态。视觉基线只能在人工确认变化合理后更新，不得用提高 diff 阈值掩盖回归。

门禁失败必须修复根因，不得降低规则、增加无条件排除或使用断言掩盖。修改共享基础设施、Token、UI Adapter、Core 或公共组件前，先评估全部调用方；局部差异可由 Feature Composition 解决时不得改全局契约。
