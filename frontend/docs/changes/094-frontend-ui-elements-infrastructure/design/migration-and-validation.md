# 迁移与验证设计

## 1. 实施顺序

实施严格按线性阶段推进：Foundations → Actions/Identity/Navigation/Async → Feedback/Surface/Overlay/Form → Data/Patterns → Showcase → 全部页面 → 门禁/文档/验证。每阶段先增加失败用例或可见场景，再改契约与调用方，最后删除旧路径；阶段完成后自动进入下一阶段。

## 2. 页面迁移矩阵

| 页面/边界                | 迁移目标                                                                                                                    | 真实验证                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| App Shell                | 原生 icon button 迁移；通知空动作删除或接入真实反馈；账号入口使用 Avatar/UserIdentity 并具有真实导航；Motion/Layer token 化 | Desktop/Mobile nav、键盘、Dark、locale、Focus             |
| Overview                 | Action 导航改为 Host Link；Metric/Card 使用 Card/Display Pattern                                                            | Dashboard desktop/mobile、长文案                          |
| Foundations              | Surface/Card/Description 责任收口                                                                                           | 多列/窄屏、Dark                                           |
| States                   | LoaderCircle 迁移 BusyIndicator；Loading/Skeleton/State aria 保持                                                           | Loading/Empty/Error/Offline/Permission、Axe               |
| Preferences              | Radio/Toggle 选择适配；保存结果进入 Toast；表单错误/Dirty/Pending 完整                                                      | Keyboard、submit、toast、reduced motion                   |
| Reference Workspace      | Avatar/UserIdentity、DescriptionList、排序、多选、真实分页、BulkAction、Confirm、Toast；筛选后分页归一                      | 列表/详情/Toolbar/Filter/Empty/Error/selection/pagination |
| Reference Form           | RadioGroup、Card/Section、Pending/Success/Warning Composition                                                               | 表单错误、disabled、pending、sticky footer                |
| Showcase                 | 按完整 Family 重组，覆盖全部公开 Element 与 edge state；低优先级非公共裁决可见说明                                          | light/dark、zh/en、long、compact、mobile、打开态          |
| Error Boundary / Hydrate | 使用项目 State/Loading/Surface，不重复视觉实现                                                                              | 错误恢复、初始加载语义                                    |
| Desktop Contract         | 编译证明不引入 DOM/Browser/HeroUI 反向依赖                                                                                  | typecheck/test                                            |

## 3. TailAdmin 全量裁决

- 吸收并实现/扩展：Alerts、Avatar、Badge、Breadcrumb、Buttons、Cards、Dropdowns、Modals、Notification/Toast、Pagination、Popovers、Progressbar、Spinners、Tabs、Tooltips、Table 支撑。
- 以真实语义 Pattern 实现：Buttons Group → Toggle/Action Group；List → Description/Option/Data composition；Links → UI Link + Host Router；Data Tables → Collection Pattern。
- 明确保留为 Feature Composition：Carousel、Responsive Image/Grid、Ribbons、Videos。任务完成时这些项目没有未勾选实现项，也没有空壳公共组件。

## 4. 自动化验证

### 4.1 静态与单元

- architecture/dependency/style fixture：HeroUI isolation、原生控件、硬编码 token、Adapter 内部样式泄漏、无行为 action、错误分层。
- 单元测试：Action/Icon/Toggle、Avatar、Breadcrumb、Pagination、Busy、Toast Provider、Card anatomy、DescriptionList、Radio、DataTable sort/multi-select、Confirm props 完整性。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm performance:check`。

### 4.2 浏览器与可访问性

- Keyboard：Tab/Arrow/Enter/Space/Escape、focus trap/restore、menu/tabs/pagination/selection。
- Async/Feedback：Pending 防重复、Toast live region/close/action、Loading busy、Progress boundary。
- Data：sort、single/multiple select、bulk action、filter + pagination、empty/loading/error。
- Axe：Showcase 各 Family、全部 Overlay 打开态、Reference 两类页面、Shell mobile。

### 4.3 视觉

- Showcase：desktop、mobile dark English、关键 Overlay、Toast、Confirm、Pagination、Identity、DataTable 多选。
- 真实页面：Overview、Reference list/detail、Reference form、States、Preferences、Shell mobile。
- 视口至少覆盖 1440、1920、390；覆盖 Light/Dark、comfortable/compact、中文/英文长文本。
- 先修复现有 full-page screenshot 高度抖动；不得通过扩大阈值或盲目更新快照掩盖不稳定。

## 5. 完成审计

完成前逐项核对原目标 14 条完成标准、REQ-094-001..012 和 `tasks.md` checkbox。每项必须有文件、测试、运行截图或命令输出证据；“没有发现问题”不能替代覆盖证据。
