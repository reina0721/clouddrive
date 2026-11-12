# Material Design 视觉与交互基线

本项目统一采用 Material Design 3。颜色、形状和状态由 `packages/design-system` 的 Schema 声明；`ui-adapter` 将它们落实到交互组件，`surface-foundation` 提供页面与导航组合，业务页负责信息与动作。文件工作区、管理界面与公开分享共用这些基础能力。

## 设计依据

以 [Material 3 色彩角色](https://m3.material.io/styles/color/roles)、[导航抽屉](https://m3.material.io/components/navigation-drawer/guidelines) 和[形状体系](https://m3.material.io/styles/shape/corner-radius-scale)为依据。形状和按钮可复核 Google 发布的 [Shape Tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-shape.scss) 与 [Filled Button Tokens](https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-comp-filled-button.scss)。项目使用自己的主题配色；不能把某一种紫色当作 Material 的必要条件。

HeroUI / React Aria 继续提供键盘、Focus、ARIA、Overlay 与 Portal；不为视觉迁移重建日期选择器、菜单和弹窗行为。Material 是当前设计依据，旧 TailAdmin 校准不再支配新的视觉决策。

## 颜色、层次与形状

| 项目语义                       | Material 职责                   | 使用位置                       |
| ------------------------------ | ------------------------------- | ------------------------------ |
| canvas                         | surface container low           | 应用背景与导航容器             |
| surface                        | surface                         | 内容与阅读区域                 |
| surface-muted / surface-raised | surface container / high        | 搜索、工具条与浮层             |
| brand / on-brand               | primary / on primary            | 高优先级动作                   |
| brand-soft                     | primary container               | 新建入口、当前导航与轻量选中态 |
| ink / ink-muted                | on surface / on surface variant | 标题、正文与辅助说明           |
| border / border-strong         | outline variant / outline       | 必要分界与 outlined 控件       |
| danger / danger-soft           | error / error container         | 失败与破坏性操作               |

控件角半径 4px、内容容器 16px、Dialog 28px，按钮和导航选中区域使用 full 形状；数值只在 Design System Schema 中声明。紧凑偏好仍可改变密度，按钮形状独立于字段角半径。普通按钮不堆积阴影，辅助操作使用 text / outlined，主要动作使用 filled 或 tonal。

交互必须提供 hover、pressed、keyboard focus、selected、disabled、pending 和 error 状态。按压状态使用同一语义的状态层；焦点可见且不依赖颜色变化。动画继续遵守 reduced motion 与全局 Motion Policy。

强调色作为文字时也必须在 raised surface 及悬停状态层上保持对比度，不能仅检查白色背景或 filled 按钮。浅色绿色、橙色与同色焦点令牌按这个约束收敛；现有强调色弹窗回归分别扫描静止与悬停状态，保留深色、英文和窄屏覆盖。

## 导航与内容

文件工作区按文件、协作、传输与任务、管理组织；当前目的地同时有容器高亮与 `aria-current`。桌面导航可折叠为 rail，移动端使用具备焦点管理的 drawer。品牌与空间摘要固定，中间导航和固定项共用可滚动区域，短屏不挤掉入口。

管理侧栏在路由提交、导航模型就绪、展开/收缩模式切换或移动抽屉打开后，将当前链接（rail 中为当前分支）定位到导航自身的可视区域，不滚动外层文档、不转移焦点。定位完成后即停止观察；一旦用户开始指针、滚轮或键盘操作，本路由与模式内不再自动定位，后续权限或菜单读取也不能拉回用户的探索位置。按需加载的导航树与抽屉尺寸就绪由 Web Host 协调。

页面只保留一个一级标题。空目录显示可执行的下一步，隐藏没有内容可翻的分页；错误和加载继续使用统一 StateSurface。链接保留新标签页、复制地址与键盘访问能力。

## 组件与证据

- 组件状态入口：`/ui-elements`；页面组合入口：`/page-patterns` 与 `/page-archetypes`。
- Schema 与生成一致性：`pnpm codegen:design:check`。
- 依赖与职责：`pnpm architecture:check`、`pnpm foundation:check`。
- 真实后端导航、菜单焦点、移动抽屉和 Axe：`file-tests/material-workspace.spec.ts`。运行前使用根目录的 `node scripts/dev.mjs --preview`，并将 `CLOUDDRIVE_FILE_TEST_ACCESS` 设为输出的绝对路径。
- 截图由 Playwright `outputPath` 保存到忽略目录，供人工审阅。旧主题的 golden 不自动更新；全量视觉迁移完成前，不能把这些局部证据宣称为所有页面验收通过。
- 组件 Family 区域逐页验收：先按阅读顺序滚动并等待 Reveal，再返回顶部采集完整区域，避免中途的 sticky Header 或未完成的入场被误存为基线。区域截图保持桌面宽度，采集高度容纳内容与滚动留白；固定视口、窄屏和主题适配继续由各自的布局与交互用例验证。

新增组件能力先复用 Element、Variant、Composition，再考虑 Pattern；不在业务页另建基础组件、硬编码颜色或覆盖 vendor 私有 DOM。所有新界面与后续迁移都以本页为当前视觉依据。
