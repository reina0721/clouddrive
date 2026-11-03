# 原始目标完成追踪

本文件把附件原始目标的完成标准映射到 094 的需求、任务和最终强证据。它只定义如何证明完成；实施前的计划文本、公共导出名称或未执行测试不能作为完成证据。初次完成审计曾违反这条原则，用户验收指出 UI Elements 没有逐项完整呈现后，AUDIT-094-002 以运行时 39/39 目录重新建立证据。

## 1. 十四项完成标准

| 原始完成标准                                | 094 覆盖                                                                 | 已取得的最终强证据                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. 实际研究 TailAdmin UI Elements           | R094-001、RES-094-001、SHOW-094-001                                      | R094-001 对当前 22 个可访问页面逐页记录 URL、结构、状态、可吸收规律与局限；`ui-visual-calibration.md` 和 Showcase Family 对应最终裁决                                |
| 2. 审计当前组件及依赖关系                   | R094-002、RES-094-002、BASELINE-094-001                                  | R094-002 固定 `22bf5d7` 代码/调用/依赖基线；实施入口漂移检查；迁移后 HeroUI 越界、原生控件、旧符号、空 action 与硬编码门禁扫描                                       |
| 3. 清晰 UI 分层边界                         | REQ-094-010、组件契约设计、PAT-094-001                                   | `AGENTS.md` 架构地图、`ui-element-system.md` 当前 authority、PageLayout/UI Adapter/Feature/Host 真实依赖；10 个边界 fixture 和 78 个源码通过                         |
| 4. 第三方 UI Library 与业务隔离             | REQ-094-012、FND-094-002/003、CLEAN-094-001                              | 只有 `packages/ui-adapter` 直接 import `@heroui/*`；上层零 vendor type/prop/slot/DOM 依赖；边界 policy 正反 fixture 通过                                             |
| 5. Design Token 是视觉规范来源              | REQ-094-001、FND-094-001/003                                             | `tokens.css`/`motion.ts` 提供 Surface、Control/Icon、Focus、Motion、`--z-index-*`；Tailwind v4 语义 utility 在 1440/1920/390、Light/Dark、density 快照中验证         |
| 6. 核心 Element 状态/尺寸/Variant/A11y 完整 | REQ-094-002..009、全部 ACT/IDN/NAV/ASYNC/FBK/SURF/DSP/OVR/FORM/DATA 任务 | 39 个公开可见契约各有独立 Preview 和状态清单；26 个 unit、28 个 Playwright/Axe、31 张 Visual，不以导出清单或静态混合 Demo 替代行为                                   |
| 7. 不依赖页面 className 修公共组件          | REQ-094-001/011、FND-094-002、PAT-094-001、CLEAN-094-001                 | 页面只消费语义 utility/props；arbitrary、`!important`、深层 selector、vendor class/slot 泄漏门禁均通过；无页面 selector 修 HeroUI                                    |
| 8. 治理成形组件嵌套污染                     | REQ-094-010、SURF-094-001、PAT-094-001                                   | Card Header/Content/Footer、Panel Layout Surface、PageSection 与 Overlay Surface 单 owner；Showcase composition、Overview、Form、Dialog/Drawer DOM/Visual 通过       |
| 9. 真实页面迁移，不只有 Demo                | REQ-094-011、MIG-094-001..006                                            | App Shell、Overview、Foundations、States、Preferences、Reference 列表/详情/表单、Error Boundary、Hydrate Loading 均使用新契约并有 unit/e2e/visual                    |
| 10. 可持续 Showcase/文档入口                | REQ-094-011、SHOW-094-001..003、DOC-094-001                              | `/showcase` 39/39 独立 Element、9 个 Family 锚点/视觉基线；overlay/toast/两类 confirm/data/density 直接 URL；README 与 UI authority 导航一致                         |
| 11. 适用质量验证通过                        | REQ-094-012、VERIFY-094-001..005                                         | 2026-08-31 纠正后 `pnpm check` 全绿：architecture/dependency、26 unit、build、performance、28 browser/Axe/visual、format；31 张 PNG 人工复核                         |
| 12. 不破坏已有能力                          | 全部迁移任务、VERIFY-094-001..005                                        | 既有与新增 unit/e2e/视觉全部通过；Reference 原异常/表单/Overlay 路径保留；性能 initial=386201、total=440225、CSS=43858、largest=171600 bytes                         |
| 13. 新组件解决真实场景而非凑菜单            | 全量裁决、SHOW-094-001、CLEAN-094-001                                    | 新契约均接入 Shell、Preferences、Overview、States、Reference 或 Host；SplitButton/AvatarGroup/Workspace Tabs/Loading Overlay/Timeline/Media 等零调用方候选按下节关闭 |
| 14. 可替换 HeroUI 且上层无需大改            | REQ-094-012、FND-094-002/003、CLEAN-094-001、VERIFY-094-004              | 上层只消费项目类型与窄契约；`boundary-policy.mjs` 可执行 fake/fixture 证明禁止 import/type/style 穿透；Host Router Link 与 Feedback queue 也分别由项目 Adapter 隔离  |

## 2. REQ-094-001..012 完成矩阵

| 需求        | 判定 | 当前强证据                                                                                                                          |
| ----------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| REQ-094-001 | 完成 | Design Token、motion runtime、Tailwind `--z-index-*` 与 Light/Dark/density/responsive Visual                                        |
| REQ-094-002 | 完成 | Action/IconAction + ToggleGroup，unit、Preferences 与 Action e2e                                                                    |
| REQ-094-003 | 完成 | Alert/Notification/Badge/Status/Progress/FeedbackProvider/Toast，unit、direct URL、Axe                                              |
| REQ-094-004 | 完成 | Avatar/UserIdentity/DescriptionList/Card 调用进入 Shell、Overview、Reference 与 Showcase                                            |
| REQ-094-005 | 完成 | TextLink/Host Router Link、BreadcrumbTrail、PaginationControl、Content Tabs 与 Workspace Tabs 裁决                                  |
| REQ-094-006 | 完成 | Menu/Popover/Tooltip/Dialog/Confirm/Drawer/Command 的 handler、pending、focus、Escape、Axe、打开态视觉                              |
| REQ-094-007 | 完成 | Action Pending、BusyIndicator、Skeleton、AppLoadingSurface、StateSurface 作用域分轨与 Loading Overlay 裁决                          |
| REQ-094-008 | 完成 | Text/Area/Select/Combo/Date/Checkbox/Switch/Radio、Field Frame 和完整状态/locale/narrow/scroll 矩阵                                 |
| REQ-094-009 | 完成 | DataTable sort/single/multiple/rowHeader/empty/density；Reference filter/page/bulk 状态联动                                         |
| REQ-094-010 | 完成 | Card/Panel/PageSection/SplitView/Footer/Overlay 单 Surface owner，composition visual 与边界门禁                                     |
| REQ-094-011 | 完成 | Showcase 39/39 独立 Preview、9 个 Family 基线和确定性 URL；Shell、Dashboard、States、Preferences、Reference Workspace/Form 真实迁移 |
| REQ-094-012 | 完成 | HeroUI import 隔离、Tailwind 全前端语义边界、architecture/dependency/lint/type/test/build/performance/browser 全绿                  |

## 3. 条件性候选的完整裁决

“不建立公共组件”也是需要证据的全量裁决，不代表缩减目标。以下结论绑定 R094-001/R094-002 当前场景；实施期间出现真实调用方或研究刷新触发器时必须重新评估。

| 候选                    | 当前裁决                                                                | 完成方式                                                                    |
| ----------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| SplitButton             | 当前没有“主动作 + 同组次动作菜单”的真实稳定场景                         | 保持 `Action` 与 `MenuButton` 分离；不创建零调用方 Wrapper                  |
| AvatarGroup             | 当前没有多人身份堆叠及 overflow 计数用例                                | `Avatar`/`UserIdentity` 完成单体身份；多人场景保留 Feature Composition      |
| Workspace Tabs          | 当前只有内容视图选择，没有跨页面保活/关闭/恢复生命周期                  | `TabsView` 只承担 Content Tabs；未来真实 Workspace 生命周期单独建立 Pattern |
| Loading Overlay         | 当前等待场景可由 Button Pending、Busy、Skeleton、State composition 表达 | 不建立万能全屏遮罩；出现必须阻断整个工作区的真实操作时另行研究              |
| Timeline                | 当前页面没有有序事件/审计流调用方                                       | 保留 Feature Composition，不用普通 List 冒充 Timeline                       |
| Stat Display            | Overview 已有真实指标场景                                               | 通过 Card/Display Pattern 迁移并验证；不建立万能 `StatEverything`           |
| SortIndicator/TableCell | 只作为 DataTable anatomy 与 state                                       | 保留内部 slot/contract，不暴露无独立调用价值的顶层组件                      |
| Carousel                | 没有后台核心流程用例                                                    | Feature Composition；不引入轮播引擎                                         |
| Responsive Image/Grid   | 当前只需要内容/身份图像布局                                             | 使用浏览器语义、Token 与 Feature layout；不建立通用媒体组件库               |
| Ribbon                  | 没有独立于 Status/Badge 的真实语义                                      | 使用对应 Status/Badge 或 Feature decoration；不创建视觉别名                 |
| Video                   | 没有媒体播放业务与资源生命周期                                          | 不建立 Player；未来真实权限、字幕、流媒体需求重新研究                       |

## 4. 完成判定结果

1. 十四条原始标准和 REQ-094-001..012 均已有文件、运行命令、真实页面、交互/Axe 或视觉强证据；39 个公开可见 Element 已逐项映射，不再用公共导出存在、单一截图或混合 Demo 支撑广义结论。
2. 条件性候选逐项完成场景裁决；当前没有新增调用方或研究刷新触发器，因此“不建立零调用方 Wrapper”的结论仍有效。
3. 初次完成声明已被用户验收反证并保留为历史；AUDIT/SHOW/VERIFY/GIT-094-002 纠正链完成后，`tasks.md` 全部 checkbox 才重新闭环，当前没有缺失、弱证据、矛盾证据或剩余 required work。
