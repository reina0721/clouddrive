# R107-002 设置中心公共能力落点与边界

## 研究问题

五类公共能力（偏好 preferences、工作状态 workspace、通知 notifications、命令 commands、
导航保护 leave-confirm）需要**同一份实现被多方消费**：`settings` 插件（读写）、Host Shell
（顶栏标签/通知铃铛/首页区段/命令菜单/快捷键）、其它页面（草稿/恢复/提交去向/列记忆）。
约束链：

- 禁止跨 Plugin 读取私有 Store；
- Universal（design-system/ui-adapter/form-foundation/i18n/core/schemas/types）禁止依赖
  Surface/Host；Surface 禁止依赖 Host；
- Plugin 运行时不 import apps/web；Host 不 import plugins/* 内部（仅经 generated shim 与
  Surface 公共 subpath）；
- 设置插件拥有分类/文案/搜索目录/页面组合；公共能力不能变成插件私有。
  本记录比对候选落点并给出推荐，回答"放哪一层、以什么形态"。

## 候选比对

| 候选落点                                                                              | 能承载什么                                                                                                                                                   | 不能承载 / 代价                                                                                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A. `@clouddrive/plugin-framework` 新子路径（纯契约 + client Port/context/hook）       | 五类能力的**类型契约、Provider/Context、hook**（仿 `./plugin` 的 PluginNavigationPort/PluginLocalePort）；react 仅 peer；依赖方向 = surface/Host → framework | 不能放**产品偏好领域模型**（typed 分类/默认值/migrate/枚举）——那是产品语义，framework AGENTS 禁止产品数据进纯模型层                         |
| B. `@clouddrive/surface` 新公共 subpath（如 `@clouddrive/surface/preferences-model`） | 产品偏好**领域模型/默认值/受限联合校验/migrate 形状**；plugins、Shell、Host 均可 import；先例 = `@clouddrive/surface/shell`、`/icon-presentation`            | surface 只暴露已登记 subpath；新增需改 surfaces/package.json exports + foundation-contracts 登记；不是运行时 provider（运行时由 Host 装配） |
| C. Universal 新包/新 subpath                                                          | 无（产品偏好语义禁止进 Universal；现有 Universal 是产品无关的 runtime/契约）                                                                                 | 违反 frontend-foundation 分层                                                                                                               |
| D. 新建独立 workspace package                                                         | 无真实并列产品，违反"只有真实并列产品才引入限定词/新层"                                                                                                      | 需动 foundation-policy/workspace，成本高、无收益                                                                                            |
| E. 全放 settings 插件私有 store + 其它页 import                                       | 破坏"禁止跨插件读私有 Store"与"能力共享"                                                                                                                     | 违反 AGENTS，插件删除即断其它页面                                                                                                           |
| F. Registry 呈现模型（breadcrumb/command/permission）                                 | 无——Registry 明确不为"未来可能使用"维护展示模型                                                                                                              | 与 plugin-framework §5/§8 冲突；真实 UI 需求驱动时新建                                                                                      |

## 推荐方案（分层）

```text
能力契约（五类 Port 类型 + Provider/context/hook）→ @clouddrive/plugin-framework
  ./preferences ./workspace ./notifications ./commands （react peer；纯模型不读 pathname/history）
产品偏好模型（分类定义/默认值/受限联合/边界校验/migrate 形状/展示文案 key）→ @clouddrive/surface
  ./preferences-model（或等价公共 subpath；schema 化可生成 i18n key 与目录）
运行时实例（storage/router/matchMedia/permission/timer/lifecycle 注入 + storage 事件同步 + 失败语义）
  → apps/web Host composition root，一次性安装到对应 Provider
Store 归属（filesystem ownership）→ Host store 归 apps/web、Shell store 归 surfaces shell、
  Plugin store 归 surfaces/plugins/<plugin>/stores/*；跨边界一律经 Port
```

- **preferences**：`PreferencesPort{ get/set/subscribe(category), resetCategory/resetAll }`
  - 返回「持久化成功 | 可判断失败（原因码）」；产品模型给出分类枚举与 defaults；Host 实现落盘
    `clouddrive.shell` v1（R107-001 §2 现状 → migrate）。
- **workspace**：按页面身份（pageId + version）保存/恢复列表状态与显式允许的草稿字段；
  页面声明允许保存字段 → 纯契约类型。
- **notifications**：受控事件类别/严重性/关联 ID/展示文本/可选 Route Target；持久化内容不含
  函数；Host 实现通知中心 + 未读/角标；FeedbackProvider Toast 仍是瞬时反馈，中心收纳
  "真实前端事件/真实本地任务结果"。
- **commands**：注册 commandId/说明/作用域/可用性/执行函数；卸载注销；按钮入口/命令菜单/
  快捷键/常用操作引用同一执行函数与可用性。
- **leave-confirm**：页面注册 dirty/提交中 + 恢复信息；Host 在 navigation-lifecycle 前统一
  询问；结果 complete/cancel/fail；取消不改路由/标签/进度；仅未提交输入才注册 beforeunload。

## 事实支撑与边界

- 先例链（事实）：`./plugin` 子路径已有 Provider/context/hook 且 Host 单点装配
  （navigation-port.tsx / app-shell PluginLocaleProvider）；icons 页 import
  `@clouddrive/surface/shell`；plugin-framework `./schemas` 装配（106）说明"framework
  子路径可承载浏览器安全能力 + Node 装配方"；i18n 的"Universal runtime / Surface 产品数据"
  分工先例。
- 禁止项（规则）：Plugin import apps/web 私有实现（architecture gate）；surface/plugins/*
  内部被 Host 直接导入（generated shim 唯一通道）；framework 引入产品数据；业务 import zustand；
  跨 Plugin 私有 store；新增无边界万能 Provider。
- 展示策略（theme/accent/density/fontScale/contrast/motion/locale/weekStart 等）是"值"不是
  能力：Universal 组件与 Surface Foundation 只经 **props/context** 接收（不 import settings 插件、
  不读 Host Store）；偏好模型本身在 Surface 公共 subpath，组件可经 context 拿到当前值快照。

## 适用与不适用场景

- 适用：107 公共契约层、Host 装配、跨页面消费、Store 边界、命令/通知/工作恢复的统一入口。
- 不适用：后端/账号同步；把偏好写进 Registry 或 Universal；为每个私有 Store 建 Port
  （AGENTS：跨 Host/Plugin 的能力才需要 Port，普通插件私有状态用私有 store）。

## 局限与剩余未知

- 具体 subpath 命名与文件拆分在 design/capability-ports.md 细化并做 exports/freshness 登记。
- Preferences 模型用"手写 typed 模型 + zod 边界校验"还是"design-system 同款 authority
  schema"需在 design 决策：设置运行时明确不使用 packages/schemas API（目标已确认），因此
  校验可沿用 system-tools 先例（plugin zod schema）+ 集中默认值，不引入 authority 管线。
- 跨窗口 storage 事件"按最后成功写入完整快照收敛、草稿冲突不静默覆盖"落在 Host storage 层
  （state-foundation persist 之上），design 细化。

## 对当前任务的影响

- design/capability-ports.md 与 design/shell-integration.md 以本推荐为骨架；SET-003 先落
  preferences 契约 + v1 migrate + Host 装配，SET-005 再落 workspace/notifications/commands
  与 Shell 集成。
