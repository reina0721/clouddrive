# Motion Governance 与异步内容切换需求

## 1. 客户目标

后台产品在"页面切换、区域加载、数据就绪"三个时机都有动效，但彼此职责不同：转场只表达"进入新页面"，不掩盖加载；数据就绪的内容切换必须平滑（不"啪"地出现）；页面内部不允许每个小组件各自飞入。同时，未来整体调整动画风格（更克制/更明显）应只改系统级 Recipe，不改几十个页面。

## 2. 使用场景

- 点击菜单进入新页面：页面外壳立即出现，配轻量转场（淡入 + 极小位移）。
- 页面内数据区域加载：立即显示 Skeleton，数据就绪后内容平滑过渡出现（不整页等待、不整页闪出）。
- 慢网场景：任一区域先就绪先完成内容切换（Progressive Rendering + Progressive Reveal）。
- 页面进入视口的第一屏不逐个飞入；below-fold 区域首次进入可视范围时整体 Reveal 一次（未来能力）。
- 表格/列表不逐行动画；每个 UI Element 不各自套动画。
- 开发者希望对比不同动效组合（开关页面转场/内容过渡）进行视觉验收。

## 3. 约束

- 动效参数（时长/缓动/位移）与 Reduced Motion Policy 只能来自 `packages/design-system`。
- Feature 只选择语义组件（"这是异步内容"），不选择实现型动画（fade/slide/duration）。
- 业务组件 props 不出现动画开关（disablePageAnimation 等）；开发期覆盖走系统级 Policy 注入。
- 后台默认 Reveal-once，不做视口 presence 重播。

## 4. 非目标

- 不为每个 UI Element/列表行加进场动画；不做营销型视口动画。
- 不实现开发期 Motion Inspector（规格登记，触发条件未到）。
- 不改 Overlay（Dialog/Drawer）动效；不做旧系统动效迁移。

## 5. 可验收行为

| 编号     | 行为                         | 验收                                                                                         |
| -------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| MGC2-001 | 页面转场轻量化且全局单点可控 | `--motion-distance-page` 为唯一位移源，改该 Token 即全局生效；转场仍为淡入+位移              |
| MGC2-002 | 异步区域状态切换不"啪"       | AsyncRegion 在 loading→ready 播放 content.enter；自动化断言动画存在；reduced-motion 下无动画 |
| MGC2-003 | 异步区域语义完整             | loading 有 Skeleton 与 aria-busy；error/empty 有可恢复路径（保留现有文案与动作断言）         |
| MGC2-004 | 快速状态切换安全             | e2e 断言连续切换后无动画残留、无 DOM 污染                                                    |
| MGC2-005 | 决策路径唯一                 | AGENTS 决策树存在并被引用；Feature 代码中不存在实现型动画控件属性                            |
| MGC2-006 | Region 不逐元素动画          | 权威文档克制清单生效；reference 迁移不引入逐行/逐卡片动画                                    |
| MGC2-007 | 回归不破坏                   | `pnpm check` 全绿（除记录在案的既有 format 基线例外）；reference 既有断言全通过              |
