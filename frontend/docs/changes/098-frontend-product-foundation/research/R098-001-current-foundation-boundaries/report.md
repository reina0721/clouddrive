# R098-001 当前 Foundation 边界审计

## 1. 研究问题

核实当前代码是否已经表达 Universal Foundation、Product Surface 与 Runtime Host 三个独立维度，并识别 098 必须单轨迁移的混合职责。

## 2. 已核实事实

- `packages/design-system`、`packages/ui-adapter` 已分别形成 Token/Motion 与 HeroUI 适配边界，39 个公开 UI Element 具有 UI Elements、DOM、Playwright、Axe 与视觉证据。
- `apps/web` 并非纯 Web Runtime：它同时拥有 Admin 风格 Shell、Sidebar、Command Menu、Page Layout、Reference 数据、表单组合和全部展示文案。
- `apps/web/src/layouts/page-layout.tsx` 已是事实上的 Admin Layout Contract，但仍位于 Host 私有目录，未来 Feature 只能深度依赖 Host 或复制实现。
- `apps/desktop` 没有启动入口、窗口实现或已选 Runtime，只保存假想 Port；它也没有 Product Surface，因此不满足 `apps/<surface>-<runtime>` 定义。
- `packages/reference` 的唯一跨 Host 证据依赖上述 Desktop 占位；其确定性数据属于验证场景，不是产品 Feature。
- Form 与 i18n 第三方依赖目前只允许在 `apps/web`，导致通用编排留在 Host；`packages/schemas` 则保存 Reference 专属 Schema。
- `packages/types` 同时包含稳定状态/导航类型和 `RuntimeHost`、`FoundationCapability` 等占位或展示类型，边界需要重新分类。

## 3. 推断

- 当前 `apps/web` 应命名为 `apps/admin-web`；视觉 Admin Shell 属于 Admin Surface，Next Router、DOM、Storage 与生命周期属于 Host。
- Admin Layout/Pattern 数量已经超过两个独立语义，不适合并入 UI Adapter，也不能继续留在 Host，因此需要 `packages/admin-foundation`。
- 不可运行的 Desktop 目录会把未来假设写成当前事实，应删除而不是保留兼容层。
- Universal、Surface、Host 必须由机器可读 workspace policy 校验，不能仅依赖目录命名和人工理解。

## 4. 对 098 的强制影响

1. 单轨重命名 Web Host、删除 Desktop/Reference 占位和全部旧符号。
2. UI Adapter 保持产品中立；Admin Pattern 只能进入 Admin Foundation。
3. 具体 Reference Schema、fixture 与文案归验证宿主所有。
4. Showcase 分成 Universal Element、Universal Motion、Admin Pattern 和 Admin Reference 四层。

## 5. 局限与刷新

本研究不判断后端接口、真实权限、数据源或未来 Product Surface 形态。出现真实 Product Web/Desktop 或新的 Runtime 时，按相同正交模型新增研究，不能复活当前占位。
