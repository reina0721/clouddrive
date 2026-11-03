# 设计决策

## D-01 默认值即现行动画，不做迁移

`appearance.pageTransition` 默认 `default`。`validatePreferences` 以
`defaultAppearance` 为基底逐字段补全，旧 v2 记录缺少该字段时自然得到 `default`，
因此不升 `PREFERENCES_VERSION`、不写迁移函数。

代价：版本号不再严格表达「新增字段」；收益：历史数据零风险，回退（删除字段）也不会损坏记录。

## D-02 Recipe 归 Surface Foundation，Host 只写属性

- Host `providers.tsx` 写 `html.dataset.pageTransition`（与 density/fontScale 同处）。
- `surface-foundation/styles.css` 定义 `surface-screen-fade|fade-slide|fade-up|fade-down`
  与选择器；Host/业务页面不出现 keyframes 或动画名。
- 值名（`fade-slide` 等）是**偏好选项标识**，不是业务页面 Contract；业务页面仍只消费
  Page/RouteTransition，不引用这些字符串。

## D-03 enter-only 等效

Vben 基于 Vue `<Transition>` 同时播放 enter/leave；本项目页面在 Next App Router 提交时
直接替换子树，保留旧 DOM 需要额外缓存层，会破坏 layout 持久化与滚动语义。
决策：只播放新页面 enter，以进入位移/淡入传达方向与切换感；记录为等效实现。

## D-04 Token 化参数

| Vben                      | 本项目                                             |
| ------------------------- | -------------------------------------------------- |
| 30px                      | `--motion-distance-enter`（1.5rem）                |
| 10% 位移                  | 同上（固定距离，避免大屏位移过大）                 |
| 0.2 / 0.25 / 0.28 / 0.3s  | `--motion-duration-page`（240ms）                  |
| ease-in-out               | `--ease-product`                                   |
| `overflow-x: hidden` 容器 | 复用 `.surface-route-content { overflow-x: clip }` |

## D-05 与既有标题动画的关系

默认模式：保留 `.surface-page-stack > header` 的 `content-rise-in` / `surface-enter-forward`。
非默认模式：同一 header 规则显式 `animation: none`，由整页 recipe 承担，避免叠加。
`none` 与 `data-motion-screen='off'` 在值规则之后覆盖为 `animation: none`。

## D-06 嵌套 Route 排除

沿用现有 `:has([data-route-content])` 守卫：含嵌套 Route 的持久面板不重放整页动画，
避免设置内页壳、分栏详情等布局被整体位移。与现状行为一致。

## D-07 配置入口

- `/settings` 外观·动效与视觉辅助组，紧跟「动效偏好」，`SelectField` + 每项说明；
- 快捷偏好抽屉同字段（Host i18n 独立 namespace，Shell 不引用 Plugin i18n）；
- 搜索索引新增 `appearance.pageTransition`（页面切换动画/转场/过渡/动画/fade/slide），
  保证设置搜索可聚焦 `#settings-appearance-pageTransition`。

## D-08 关闭语义

`none` 只停用页面切换动画；`motion=reduced` 是全局动效降级（包含页面切换）。
文案明确区分，避免用户误以为关闭后所有动效消失。
