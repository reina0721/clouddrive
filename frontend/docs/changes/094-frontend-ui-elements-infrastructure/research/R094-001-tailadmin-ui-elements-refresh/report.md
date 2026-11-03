# R094-001 TailAdmin React Demo UI Elements 逐页复核

## 1. 研究问题与方法

需要验证 TailAdmin 当前版本真实存在的 UI Elements 页面、示例分组和可见交互，而不是依据附件描述、截图或旧文档推断。

2026-08-30 使用浏览器读取首页侧栏，确认并逐页访问：Alerts、Avatar、Badge、Breadcrumb、Buttons、Buttons Group、Cards、Carousel、Dropdowns、Images、Links、List、Modals、Notification、Pagination、Popovers、Progressbar、Ribbons、Spinners、Tabs、Tooltips、Videos。逐页提取标题、示例分组、可见动作和内容结构；另实际打开 Dropdown 的 Default Account Menu。现有 `frontend/docs/ui-visual-calibration.md` 的 22 页矩阵与本轮页面一致，因此本报告只记录刷新证据和对 094 的影响，不复制该 authority 的整张矩阵。

## 2. 已验证事实

### 2.1 动作、身份与导航

- Buttons 按 Primary/Secondary、左右 Icon 分组；Buttons Group 展示连续按钮的首尾边界和左右 Icon。
- Avatar 展示 Default 与 Online/Offline/Busy 指示，说明身份图像、fallback 和 presence 是不同职责。
- Breadcrumb 展示 Default、Icon、Divider 与 Dotted Divider；稳定语义是层级、当前位置和可导航项，不是分隔符造型数量。
- Pagination 展示 Text、Text+Icon、Icon 三组，均包含 Current、Previous/Next、Ellipsis 与页码序列。
- Tabs 展示 Default、Underline、Icon、Badge、Vertical；Tab 本体负责 View Selection，内容 Surface 由外层组合负责。

### 2.2 反馈、状态与异步

- Alerts 以 Success/Warning/Error/Info 四个 tone 重复相同结构，并分别展示有/无 Learn more 动作。
- Badge 以 Light/Solid、左右 Icon 和颜色枚举构成矩阵；这能校准视觉完整度，但没有区分普通 metadata 与对象 lifecycle status。
- Notification 同页混合 Announcement Bar、Cookie-like Toast 和四种语义 Notification，证明反馈渠道需要分契约，不能合并成万能组件。
- Progressbar 展示默认、多个 size、外部 label 和内部 label；Spinner 展示四种视觉 Spinner 与 Button Loading。

### 2.3 Surface、Overlay 与内容

- Cards 展示图片、横向图片、Link、Icon 等组合，但主要是成品示例，没有提供项目可直接采用的稳定 Compound API。
- Dropdowns 展示 Default、Divider、Icon、Icon+Divider；本轮打开 Default Account Menu 后可见四个操作项。页面 DOM 更接近简单按钮列表，不能据此降低项目对 Menu Role、Keyboard、Focus 和 Escape 的要求。
- Modals 展示 Default、Centered、Form、Fullscreen 和基于 Modal 的四类 Alert；这些是场景分类，不等于一个组件应公开所有布尔 Variant。
- Popovers 以 Default/Button/Link 内容和四方向分组；Tooltips 以 Light/Dark、方向、Border/Arrow 分组。Popover 与 Tooltip 即使底层定位相近，内容交互语义仍不同。
- Carousel、Images、Ribbons、Videos 主要验证媒体比例、布局或装饰与容器关系；没有证据支持当前项目建立通用播放器、轮播引擎或 Ribbon Wrapper。
- List 同页混合 ordered/unordered、button、icon、horizontal、checkbox、radio，证明“List”不是单一公共组件语义。

## 3. 推断与项目适配

- 【推断】值得吸收的是分类、Anatomy、状态矩阵、父子 Surface 层级和 Showcase 组织方式；颜色枚举、所有 placement、所有媒体 Demo 不应直接扩大项目 API。
- 【推断】Badge/Status、Alert/Toast/Notification/Banner、Dropdown/Select、Popover/Tooltip、Dialog/Confirm/Drawer、Content Tabs/Workspace Tabs 必须保持语义分离，即使视觉或底层 primitive 相近。
- 【推断】Buttons Group 只有在“相关动作”或“互斥选择”真实存在时才应落地为 Action Group 或 Toggle Group；不得只为复刻菜单补空组件。
- 【推断】Carousel、Images、Ribbons、Videos 在当前任务中的完成方式是形成明确的 Feature Composition 边界，而不是创建零调用方公共实现。

## 4. 局限与剩余未知

- 没有把 TailAdmin 每个示例的所有 hover、focus、dark、mobile 和嵌套组合逐像素量化；这类数值不应成为项目规范来源。
- Modal/Popover 的外部打开态没有形成足以推导可访问性契约的稳定证据；本计划改用 HeroUI 官方/已安装实现与项目 Playwright 作为交互 authority。
- TailAdmin 是外部可变样本，结论只对 2026-08-30 页面快照有效。

## 5. 对 094 的影响

- Showcase 按 Actions、Feedback、Identity/Display、Navigation、Overlay、Async、Forms、Data、Composition 重新形成完整权威面。
- 全部 22 页都进入保留、扩展、新建、Pattern/Feature Composition 或明确不公开的裁决，不以优先级省略低优先级项。
- 项目继续使用自己的 Semantic Token 和 UI Contract；不复制 TailAdmin，也不增加其运行时依赖。
