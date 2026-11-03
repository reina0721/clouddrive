# 前端基础技术与组件边界复核

## 1. 当前技术事实

项目使用 React 19、Vite 7、TypeScript 5.9、Tailwind CSS 4、TanStack Query、React Hook Form、Zod 和 HeroUI。依赖中同时存在：

- `@heroui/react` / `@heroui/styles` 3.2.4；
- `@heroui/theme` 2.4.26；
- `@heroui/toast` 2.0.22。

`main.tsx` 已使用 v3 样式入口，`tailwind.config.js` 仍加载 v2 theme plugin，UI SDK 又直接依赖 v2 Toast。lockfile 因此同时携带两代组件系统及其 peer 依赖。这不是合理的长期边界。

HeroUI 官方 v3 文档说明其基于 React Aria、Tailwind CSS v4 和 CSS variables，已覆盖 Table、表单、Overlay、Toast 等 75+ 组件；官方发布页在本研究日列出 3.2.4。项目没有继续保留 v2 Theme/Toast 的明确收益。

## 2. 候选路径

### A. 继续扩展当前混合 UI SDK

收益是短期改动小，但会继续扩大巨型文件和两代依赖的技术债，页面模式仍然缺失。否决。

### B. 整体替换为 Ant Design 等完整后台组件库

Ant Design 的 Table、Form 和后台生态成熟，信息展示规范也强调按重要性、频率和关联组织数据，表格应提供搜索、筛选、排序与分页。然而当前项目已拥有 React Aria/HeroUI 基础、自有 Token、既有可访问交互和大量页面；整体替换会带来显著 DOM、视觉、主题和测试迁移成本，却不能自动解决业务投影和功能模式问题。除非后续原型证明 HeroUI v3 无法满足关键 DataGrid/表单能力，本任务不选此路径。

### C. 保留 React 栈，HeroUI v3 单轨化并重建项目边界

推荐。具体含义是：

- 保留 React 19、Vite 7、TypeScript、Tailwind 4、TanStack Query、RHF/Zod；
- 删除 `@heroui/theme` v2 和 `@heroui/toast` v2，统一到 HeroUI v3；
- HeroUI/React Aria 提供 Button、Input、Select、Dialog、Drawer、Tooltip、Menu、Toast、Table 等可访问原语；
- 项目只封装稳定的视觉语义、领域状态和后台功能模式，不复制第三方完整 API；
- 对高级 DataGrid 能力先用实际列表规模验证 HeroUI Table；若列固定、虚拟化、列配置等 P0 需求无法可靠满足，再以独立研究评估 TanStack Table/Virtual，不在本任务中预设第二套表格栈。

## 3. 新组件边界

建议目录按职责拆分：

```text
webui/src/
  design-system/
    tokens/
    primitives/
    feedback/
    data/
    forms/
  patterns/
    resource-index/
    entity-detail/
    settings-form/
    batch-operation/
    dashboard/
  shell/
  modules/
```

- `tokens/` 只定义规格和主题映射。
- `primitives/` 是对第三方原语的窄适配，只加入项目需要的 variant、默认可访问属性和稳定测试入口。
- `feedback/data/forms` 提供跨业务但有明确语义的组合组件。
- `patterns/` 管理查询、选择、状态矩阵与页面结构，是复用的主要层级。
- `modules/` 提供资源列定义、字段 schema、权限策略和业务动作，不自行决定 Shell、间距与反馈机制。

不再使用一个 `ui/index.tsx` 作为所有能力的实现位置；可保留受控 barrel export，但实现必须分域。

## 4. 数据与表单状态

- 所有服务端读取通过 TanStack Query 统一 key、取消、缓存、刷新和错误边界。
- 输入框立即更新本地输入状态；debounce 只作用于提交查询值，不能反向阻塞受控输入。
- URL 承载可分享的 query/sort/filter/page；临时选择和 Drawer 状态按产品需求决定是否进入 URL。
- 表单通过 RHF/Zod 管理字段、跨字段验证和服务端错误映射；复杂流程用显式状态机/步骤模型，不依赖多个布尔值组合。
- mutation 统一处理 pending、optimistic 约束、成功、字段错误、冲突和部分失败；删除/归档/撤销等语义不得共用模糊确认文案。

## 5. 可访问性底线

WAI-ARIA Grid Pattern 说明复合 Grid 需要由应用管理单元格内外的焦点与方向键行为。项目不应仅添加 `role="grid"` 或 `role="tree"` 就宣称可访问；能由 HeroUI/React Aria 提供的行为直接复用，项目自研 Tree/DataGrid 则必须覆盖键盘、焦点、选择公告和虚拟滚动兼容测试。

## 6. 决策

选择 C：单轨 HeroUI v3 + 项目语义模式组件。这个选择的收益可验证：减少重复依赖与适配代码、收敛可访问交互、让业务页面复用完整工作流，并保留未来在明确能力缺口下替换某个局部基础设施的空间。
