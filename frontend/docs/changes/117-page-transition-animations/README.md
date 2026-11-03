# 117 页面切换动画偏好（Vben 对标）

日期：2026-10-27。基线：`dc4c49d`（116 Vben 对标实施 HEAD）。
性质：**在保留项目现行页面切换动画为默认值的前提下，补齐 Vben 页面切换动画集合并在个人偏好中提供配置**。

## 结论摘要

| 能力           | 状态   | 交付                                                                                         |
| -------------- | ------ | -------------------------------------------------------------------------------------------- |
| 默认页面切换   | 保留   | `default` 完全沿用 `data-route-kind` 方向进入（仅非持久标题），现有视觉/动效未变             |
| Vben 动画集合  | 已完成 | `fade` / `fade-slide` / `fade-up` / `fade-down` 四种整页进入 recipe                          |
| 关闭动画       | 已完成 | `none`，等价 Vben「页面切换动画」开关关闭，不影响其它动效                                    |
| 偏好配置       | 已完成 | `/settings` 外观·动效组 + 顶栏快捷偏好抽屉，同一 PreferencesPort、即时生效、刷新与跨窗口保持 |
| 降级与可访问性 | 已完成 | 减少动效/`data-motion-screen=off` 统一降级；纯 opacity/transform，不改变布局与滚动容器       |

## 实测方法（Vben 证据）

Vben 演示站经系统代理（127.0.0.1:7897）+ Chromium `--disable-http2` 访问；用演示账号
`vben/123456` 登录（拖过滑块验证），打开顶栏「偏好设置」：

1. 「通用 → 动画」存在 `页面切换进度条 / 页面切换 Loading / 页面切换动画` 三个开关；
2. 运行期 preferences 默认 `transition: { enable: true, loading: true, name: 'fade-slide', progress: true }`；
3. 可配置动画名从运行期 chunk `/js/basic-*.js` 读取：
   `transitionName` 可选集合为 `['fade','fade-slide','fade-up','fade-down']`；
4. 其 CSS 另有 `fade-scale`（enter scale 1.2 / leave 0.8）但不在可选集合，未纳入本实现；
5. 参考参数：fade 0.2s；fade-slide 0.3s、enter `translateX(-30px)`；fade-up enter `translateY(10%)`；
   fade-down enter `translateY(-10%)`。

详细记录与限制见 [Vben 页面切换证据](research/vben-page-transition-evidence.md)。

## 关键自主决策

1. **默认不迁移**：`default` 即项目现行动画；旧持久化记录缺字段由 `validatePreferences`
   按默认值补全，不升 `PREFERENCES_VERSION`、不写迁移。
2. **整页 recipe 归 Surface**：新增 `surface-screen-*` keyframes 放在
   `packages/surface-foundation/src/styles.css`，Host 只写 `html[data-page-transition]`；
   业务页面不感知动画名。
3. **enter-only 等效**：React commit 直接替换子树，Vben 的 leave 过渡无同构实现；
   以进入动画达成同等页面切换感知，记录为等效实现而非缺失。
4. **Token 化位移/时长**：不复制 30px/0.2s，使用 `--motion-distance-enter`、
   `--motion-duration-page`、`--ease-product`。
5. **嵌套 Route 不重放整页动画**：沿用既有 `:has([data-route-content])` 排除，避免持久面板整体位移。
6. **关闭语义**：`none` 只关闭页面切换；`motion=reduced` 才是关闭全部动效。

## 实现范围

- `surfaces/src/preferences-model.ts`：`PAGE_TRANSITIONS` / `AppearancePreferences.pageTransition` /
  默认值与校验；单测覆盖旧记录补全与非法值拒绝。
- `apps/web/src/host/providers.tsx`：写 `html.dataset.pageTransition`。
- `packages/surface-foundation/src/styles.css`：四个 Screen Recipe + 标题动画让位 + none/off 降级。
- `surfaces/plugins/settings`：外观「动效偏好」下的 `SelectField`、搜索索引、中英文文案。
- `apps/web/src/shell/quick-preferences-drawer.tsx` 与 Host i18n：同一偏好的高频入口。

## 验证

- 新增 `apps/web/e2e/page-transition.spec.ts`（10 项）：默认保留、旧记录补全、四种 recipe、
  关闭、减少动效、窄屏无横向溢出、首次加载不重放。
- 受影响回归：`transition` / `motion-preference` / `settings-product-review` /
  `settings-routes` / `shell-security` / `settings` 共 53 项通过；`visual.spec` 仅
  `settings-desktop` 变化（新增一行，逐项查看后更新基线）。
- 单元：surfaces 176、web 192。
- 完整 pnpm check：**退出码 0**，Playwright **423 项**（413 + 新增 10）、web 192、surfaces 176；\n 预算 initial 408,047 / 409,600、maxRoute 432,435 / 445,440、CSS 48,736 / 49,152。\n- 原始日志：[验证记录](evidence/verification.md) 与 [pnpm-check.log](evidence/pnpm-check.log)。

## 外部限制

1. Vben 演示 UI 只暴露「页面切换动画」开关，没有动画名下拉；动画名集合来自运行期 bundle
   与 CSS，不宣称演示 UI 可直接选择。
2. Vben 的 leave（离场）过渡依赖 Vue transition，本项目 React 提交模型下不实现；
   进入动画为等效方案。
3. `fade-scale` 仅存在于 Vben CSS，不在其可选集合，未实现，避免引入无对照能力。
4. 未复制 Vben 源码、DOM、CSS 或资产；所有 recipe 以本项目 Token/keyframes 重写。

## 阅读入口

- [Vben 页面切换证据](research/vben-page-transition-evidence.md)
- [需求与验收](requirements/README.md)
- [设计决策](design/decisions.md)
- [任务状态](tasks.md)
- [验证记录](evidence/verification.md)
- [Motion Foundation](../../motion-foundation.md)
