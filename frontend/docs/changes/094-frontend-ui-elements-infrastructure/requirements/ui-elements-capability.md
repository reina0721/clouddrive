# UI Elements 能力需求

## 1. 使用者与场景

### 1.1 页面开发者

页面开发者需要组合列表、详情、表单、设置、Dashboard、Toolbar 和 Overlay，而不必自行决定基础控件高度、颜色、圆角、焦点、键盘和错误状态。

### 1.2 最终用户

最终用户需要在鼠标、键盘、触屏、窄屏、Dark Mode 和内容扩张下获得一致且可理解的操作、状态、导航和反馈。

### 1.3 维护者

维护者需要通过 Showcase、真实 Reference 页面和自动化测试同时判断公共变更是否破坏 Variant、组合、页面和可访问性，而不是等业务页面出现局部补丁。

## 2. 可验收能力

### REQ-094-001 Foundations

颜色、文字、Surface、Border、Radius、Shadow、Control/Icon Size、Focus、Motion、Density 与 Layer 必须由统一语义 Token 控制；页面不得通过硬编码颜色、任意尺寸、深层选择器或 `!important` 修复公共组件。

### REQ-094-002 Actions

普通动作、图标动作、危险动作、Loading、Disabled、左右 Icon、尺寸和互斥选择必须有明确语义。纯图标动作必须有可访问名称；可见动作必须具有真实行为；导航不得伪装成命令动作。

### REQ-094-003 Feedback 与 Status

Inline Alert、Banner、Toast、静态 Notification、Badge、Status、Progress、Skeleton、Empty/Error/Offline/Permission State 必须按作用域和生命周期分离。动态反馈按影响选择播报强度，静态内容不得机械进入 Live Region。

### REQ-094-004 Identity 与 Display

用户图像、fallback、initial、presence、姓名/说明组合必须有稳定身份语义；结构化键值信息与 Card 内容不再由每个页面重复拼装。普通 Badge 与生命周期 Status 保持分离。

### REQ-094-005 Navigation

Breadcrumb、Content Tabs、Pagination、普通文本导航与 Host Router 导航必须表达各自职责。当前位置、当前页、Selected、Disabled、Ellipsis 与键盘操作可被识别。Workspace Tabs 只有真实多页面生命周期出现时才与 Content Tabs 分轨，不把两者混成 Variant。

### REQ-094-006 Overlay

Dropdown/Menu、Select、Popover、Tooltip、Dialog、Confirm Dialog、Destructive Confirm、Drawer 和 Command 必须保持语义分离，并统一处理 Trigger、Focus Trap/Return、Escape、Outside Click、Viewport Collision、Scroll 与嵌套组合。可见确认或菜单项不得无行为。

### REQ-094-007 Async

Button Pending、局部 Spinner、确定/非确定 Progress、Skeleton、内容 Loading 与页面 Loading 按作用域选择；不得用全屏 Spinner 代替所有等待，也不得伪造未知百分比。

### REQ-094-008 Form

Input、Textarea、Select、Combobox、Date、Checkbox、Radio、Switch、Search、Field Layout 和 Filter Composition 共享 Control/Label/Hint/Error/Disabled/Focus 契约。外层 Field 只拥有一次 Label、Description、Error 和 Surface，不出现 Field/Input/Search 多层成形嵌套。

### REQ-094-009 Data 与 Table

Table Element 负责行列、Header、Cell、Density、Overflow、Sort 和选择语义；搜索、筛选、分页、批量动作、Loading/Empty/Error 属于真实集合 Pattern。分页和批量动作必须连接真实集合状态，不得成为静态 Demo。

### REQ-094-010 Surface 与 Composition

Layout Surface、Page Section、Card、Dialog Surface、Drawer Surface 与嵌入区域必须各有唯一视觉 owner。Card 支持适用的 Header/Content/Footer Anatomy；普通 Section 不因外观相似被强制变成 Card。一个组合只能有一层负责 Background、Border、Radius、Shadow 和外部 Padding。

### REQ-094-011 Showcase 与真实页面

Showcase 必须按组件 Family 展示 Variant、Size、Tone、Icon、Disabled、Loading、Selected、长内容、Edge Case、Dark 与窄屏；全部现有页面必须迁移并验证，不能只有 Showcase 正常。列表、详情、表单、设置、Dashboard、Toolbar 和 Shell 都要提供真实组合证据。

### REQ-094-012 可替换性与质量

HeroUI 只能存在于底层 Adapter；上层只依赖项目语义。HeroUI v3 必须承担成熟控件的交互、可访问性与状态管理；Tailwind CSS v4 可在整个 `/frontend` 使用，并必须通过项目 Semantic Token 承担布局、响应式、主题、密度与视觉组合。只有 Tailwind styling HeroUI compound parts 的结合面受 Adapter 边界约束，两者不得重复实现对方职责。完整架构、依赖、Lint、类型、单元、构建、性能、浏览器交互、Axe 与视觉门禁必须通过；视觉捕获本身必须稳定，不能把测试抖动当作可接受失败。

## 3. 全量裁决的完成含义

低优先级不代表省略。Carousel、Image Grid、Ribbon、Video 等每项都必须完成场景与边界裁决；当前没有真实跨 Feature 用例的能力以“保留为 Feature Composition，不建立公共 Wrapper”关闭。只有出现真实用例和独立状态/验证价值时才重新立项，不创建空壳、假数据或无调用方抽象。

## 4. 非目标

- 复制 TailAdmin 页面、代码、资产、DOM、CSS 或具体数值。
- 新增第二套 UI Library、媒体引擎或重量级组件文档系统。
- 接入真实后端、修改 API/数据库/权限、把新前端接入根 Go 构建或发布。
- 用永久 compatibility wrapper 保留被替换的旧 UI API。
