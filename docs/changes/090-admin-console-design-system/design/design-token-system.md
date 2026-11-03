# Design Token System

## 1. 目标

086 已建立 Token 方向，本方案不重新发明第二套变量，而是把它收敛为唯一规格源，并删除组件/页面绕过。Token 描述稳定语义，不把每个偶然尺寸都命名成变量。

## 2. 四层模型

```text
primitive scales
  -> semantic tokens
    -> component contracts
      -> density/theme overrides
```

- Primitive：中性色阶、品牌色阶、语义色阶、空间、字号、圆角、时长。
- Semantic：surface、text、border、focus、status、layout 等与主题相关的含义。
- Component：只为跨页面稳定且无法由 semantic 直接组合的规格定义。
- Override：亮/暗主题、normal/compact 密度、触摸目标；业务模块不新增主题分支。

## 3. 目标规格

### 空间

基础为 4px，允许语义步长：`2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48`。页面不得出现脱离此序列的普通 margin/padding。1px 仅用于边框，特殊图表尺寸由图表契约管理。

### 字体

| Token | 尺寸/行高 | 用途 |
| --- | --- | --- |
| `text-xs` | 12/16 | 受控元数据、标签 |
| `text-sm` | 13/20 | 紧凑表格、辅助正文 |
| `text-body` | 14/22 | 默认正文与控件 |
| `text-subtitle` | 16/24 | Section 标题 |
| `text-title` | 20/28 | 页面次级标题/详情标题 |
| `text-page` | 24/32 | 页面 H1 |
| `text-display` | 30/38 | 少量 Dashboard 核心值 |

字重限制为 400/500/600。禁止 10px 业务文字；确有图表微标注时必须满足可读性并有辅助文本。

### 圆角与阴影

- 控件 6px；Panel/Card 8px；Dialog/Popover 10—12px。
- 普通内容面不使用阴影；popover、drawer、dialog 使用分级 elevation。
- Pill 仅用于 Tag/Status，不把所有按钮做成胶囊。

### 密度

| 对象 | normal | compact | touch |
| --- | ---: | ---: | ---: |
| Control | 36px | 32px | 44px |
| Table row | 44px | 36px | 48px |
| Toolbar | 44px | 40px | 48px |

密度改变组件内部空间，不改变信息架构和断点。

## 4. 色彩角色

建议以中性灰为主要表面、单一品牌蓝为强调。示例初始值仅用于实现校准，最终必须通过对比度与视觉回归确认：

- light canvas `#F7F8FA`，surface `#FFFFFF`，primary text `#111827`，subtle border `#E5E7EB`；
- dark canvas/surface/text 由同一语义角色映射，不在业务模块另写黑色和高饱和蓝；
- brand 用于 primary action、focus、active leaf 和受控数据强调；
- success/warning/danger/info 只用于真实状态、趋势或反馈。

同一状态在 Tag、Banner、Chart 和 Text 中使用同一语义族，但可通过背景/前景强度区分组件层次。

## 5. 消费规则

- 业务 JSX 不允许任意值 class（如 `text-[10px]`、`h-[37px]`）和直接颜色。
- 布局尺寸只能由 Shell/PageFrame 消费，页面不能引用 Sidebar/Header 具体偏移。
- 模块 CSS 只能使用 semantic/component token；确需新值必须先判断是否为可复用语义。
- 图表调色板单独定义 categorical/sequential/diverging 语义，并附图例；不得借用状态色装饰普通指标。
- 用 lint/静态扫描阻止新增直接 hex、任意尺寸和过期 Token；迁移完成后删除旧 Token，不保留别名双轨。

## 6. 主题与偏好

主题、密度和 reduced motion 都通过根属性切换。用户偏好可持久化，但组织策略或系统约束必须有明确优先级。首次渲染在 HTML 级应用已知主题，避免闪烁；系统主题变化只在用户选择“跟随系统”时生效。
