# R002 TailAdmin 参考适配性与技术边界

## 1. 参考对象澄清

用户提供的是 TailAdmin Vue 官方仓库和 React Pro Demo，二者不是同一可直接复制的代码基线。Vue 仓库使用 Vue 3、Vue Router、TypeScript、Tailwind CSS 4；在线 Demo 对应 React 版本，官方 React 仓库使用 React 19、React Router 和 Tailwind CSS 4。

因此本任务把 Vue 仓库用于核对结构和状态模型，把 React 官方实现用于交叉核对同一布局在 React 中的表达，把在线 Demo 用于视觉与交互观察。三者都只是参考证据，不成为当前项目 authority。

## 2. 可复用设计事实

### 2.1 Shell 结构

Vue `App.vue` 用 ThemeProvider、SidebarProvider 和 RouterView 组织全局状态；AdminLayout 把 AppSidebar、Backdrop、AppHeader 和内容容器拆开。对应 React `AppLayout.tsx` 采用相同分解，SidebarContext 单独持有 expanded、mobileOpen、hovered 和 submenu 状态。

这说明值得吸收的是“状态 owner 与视觉区域分离”，而不是 Vue Provider 或 Tailwind class 本身。

### 2.2 布局与 motion

官方实现把 desktop sidebar 设为 290px/90px 两档，内容 margin 与侧栏使用同一 300ms ease-in-out 时间轴；mobile sidebar 使用 transform 和 backdrop。在线 Demo 的可见观察确认：

- 390px 视口中 Header 约 65px，hamburger 打开 290px 抽屉并出现遮罩；
- sidebar transition duration 为 300ms；
- 页面背景为接近 `#f9fafb`，主品牌色接近 `#465fff`，字体为 Outfit；
- 首页以大圆角、轻边框、弱阴影、较充足 padding 的统计卡与图表 surface 建立层次；
- desktop/tablet 收起侧栏约 90px，内容区保持独立最大宽度和统一 gutter。

### 2.3 不能照搬的缺点

在线 DOM 中部分菜单 button 缺少可读 aria-label，移动抽屉打开后 body 仍可见 `overflow: visible`；这些现象不能因为来自参考站就复制。当前项目既有 focus trap、inert 和状态页边界必须保留并加强。

## 3. 技术候选判断

### 3.1 保留 React/Vite/React Router 与项目 UI SDK

当前项目与 React 参考同属 React 19/Vite 路线，现有 generated registry、HostRuntime、i18n、module-owned page 和 SDK 边界已经解决项目特有问题。保留并重构能直接复用这些事实，是默认方案。

### 3.2 不引入 Tailwind CSS

Tailwind 是参考项目的样式实现手段，不是实现侧栏状态、overlay 生命周期或无障碍的必要条件。当前项目已有 token、平台 CSS、模块 CSS Module 和 architecture scan；引入 Tailwind 会同时产生第二套样式表达、构建配置、class merge 规则和模块迁移成本，而本任务没有证明这些成本带来比整理当前 CSS 更高的收益。

结论：本任务保留 CSS custom properties 与语义 class，格式化并按区域组织当前 platform authority，不新增 Tailwind/PostCSS 依赖。

### 3.3 不引入动画运行时

目标动效都是 sidebar、submenu、popover、dialog、toast、skeleton 和页面容器的 transform/opacity/尺寸协调。CSS transition/keyframes、`matchMedia` 和现有 React state 足以实现；没有拖拽、物理弹簧、时间轴编排或跨页面共享元素需求，新增 Framer Motion 等运行时缺少可验证收益。

### 3.4 退役未使用的 HeroUI

`@heroui/react` 已声明为 dependency，但当前 WebUI 和 module source 没有 import。059 已明确选择项目自有 UI SDK 作为当前唯一公共 UI 边界；实施前再次确认零消费者后，应从 package.json 和 lockfile 单轨移除，不建立兼容层。

## 4. 许可与资产边界

Vue/React 仓库在本轮 raw `main/LICENSE` 检查中均返回 404；React README 声称 Free Version 使用 MIT，但 Vue 根仓库页面没有暴露对应 license 文件。许可证事实并不足以支持把 Vue/Pro 源码、图标、插图、Logo 或 Figma 资产复制到当前 Apache-2.0 仓库。

结论：只吸收一般布局与交互思想，全部组件、样式和测试在当前项目中独立实现；不复制品牌、源代码、Pro 页面、图片、图表数据或其他资产。

## 5. 目标映射

| TailAdmin 可见模式 | 当前项目映射 | 明确不复制 |
| --- | --- | --- |
| 290/90 sidebar 与同步内容位移 | token 化 expanded/collapsed 尺寸并使用同一 motion timeline | TailAdmin Logo、菜单与 business taxonomy |
| mobile drawer + backdrop | 保留当前 inert/focus restore，改为尺寸驱动 transform 与 scroll lock | 缺失 aria-label 或背景可滚动行为 |
| sticky Header 与分区 action | 重排搜索、主题、语言、账号的优先级和 compact 规则 | 通知、消息等不存在的能力 |
| 大圆角统计 card | 统一 Surface、PageHeader、skeleton 和状态层级 | 收入、订单、客户等模拟指标 |
| 300ms layout transition | 建立 quick/standard/layout motion token | 全页面装饰性飞入或持续动画 |
| Dashboard loading detail | Shell/Page skeleton 保持宿主几何 | 假图表和假趋势 |

## 6. 局限与刷新条件

在线 Demo 的 Pro 内容可能变化，本研究只冻结 2026-08-22 观察。实施验收应比较交互原则和项目内 parity matrix，不要求像素复制 Pro 站点。

## 7. 对当前任务的影响

技术路线可以确定为“React WebUI 单轨体验升级 + 项目自有 UI/CSS + 无新运行时依赖”。范围覆盖 Shell、认证外壳、公共 primitives 和当前真实模块页面，但不改变业务能力。这为计划阶段提供了足够证据，研究门禁通过。
