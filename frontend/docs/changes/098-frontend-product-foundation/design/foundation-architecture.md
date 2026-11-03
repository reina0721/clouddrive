# Frontend Product Foundation 架构设计

## 1. 分层与依赖

```text
Universal Foundation
  design-system / ui-adapter / form-foundation / i18n / core / types
        ↓
Admin Surface Foundation
  layout / shell-navigation / collection / detail-settings / form-actions / states-operations
        ↓
Admin Web Application
  Next Router / Browser API / lifecycle / persistence / deterministic showcase
```

Universal 不得出现 Surface/Host 依赖；Admin Foundation 不得依赖 Host；Application 只装配匹配的 Surface。

## 2. Universal Contract

- UI Adapter：唯一 HeroUI 边界；公开子路径只表达 Element、Accessibility 与通用交互语义。
- Form Foundation：包装重复的 RHF/Zod 生命周期，字段 Schema 与 submit side effect 由调用方注入。
- i18n：包装实例、Provider、hook 与 Intl formatter，Surface 注入 locale/resources。
- Design System：Token、Universal Motion Primitive 与 Reduced Motion Policy；不包含 Admin screen recipe。
- Core/Types：只保留真实跨 Surface 的纯规则和稳定类型。

## 3. Admin Surface Contract

- Layout 从 Host 私有目录迁入 `admin-foundation/layout`。
- Admin Shell 是 Router-neutral Surface 组件；Host 通过 navigation port 注入路径和导航动作。
- Collection/Detail/Form/Settings/Operation 通过受控 slots 组合，不读取数据、不计算权限、不内置业务文案。
- Admin Motion CSS 只引用 Universal Token，由 Host lifecycle bridge 激活。

## 4. Showcase 与状态流

- `/ui-elements` 和 `/motion` 证明 Universal Contract。
- `/admin-patterns` 证明独立 Pattern 的组合与状态矩阵。
- `/admin-reference` 证明七类 Page Archetype 可以只用现有 Foundation 组合完成。
- 场景状态由 URL 或本地确定性控件选择，不发送请求、不伪造业务成功。

## 5. 治理门禁

- workspace policy 校验 layer/surface/runtime 与依赖方向。
- contract registry 校验公开 export、owner、maturity、authority route 与 evidence。
- vendor gate 校验 HeroUI/RHF/i18next/Next 的唯一直接依赖边界。
- foundation gate 与现有 architecture/dependency/performance/browser/visual gate 一起进入 `pnpm check`。

## 6. 迁移与清理

- `apps/web` 重命名 `apps/admin-web`；所有脚本、配置、测试与文档同步。
- 删除 `apps/desktop`、`packages/reference` 及旧 package 名称。
- Reference Schema/fixture 迁入验证宿主；旧 Host 私有 Layout 迁入 Admin Foundation。
- 搜索旧路径和符号残留为零，不保留 alias。

## 7. 验证

Static/Type/Unit/Build/Performance/Playwright/Axe/Visual/Format 全部通过；Representative visual matrix 覆盖 1440、1920、768、390、Dark、English、Compact、Reduced Motion 和 Overlay/Pattern 关键状态。
