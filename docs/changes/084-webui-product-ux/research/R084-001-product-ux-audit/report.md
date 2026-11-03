# R084-001 产品 UX 视觉与代码审计

## metadata

- id: R084-001
- 任务: 084-webui-product-ux
- 状态: 有效
- 验证日期: 2026-09-01
- 方法: 全 24 路由 mock 截图（1440×900，顶视口 + 内层滚动容器底部）+ codex 0.150.1 多模态按批审查（4 批，每批 4-6 图）+ 源码/平台样式交叉核对
- 截图与原始发现: `tmp/ui-review-084/*.png` 与 `tmp/ui-review-084/findings-batch{1,2,3,4}.json`（本地证据，不入库）
- 适用: 084 逐页重构的优先级与缺陷事实依据
- 失效触发器: 相关页面完成重构并通过复查后，本记录的 P0/P1 项随之关闭

## 事实

- 视觉审计工具链可用：`codex exec --image <png>`（gpt-5.6-luna, openai provider）可读截图并按统一 JSON 契约输出 severity（P0/P1/P2）。
- 全路由截图高度均为 900（body 不滚动，滚动发生 `.page-viewport` 内层容器），故每页补拍内层容器底部视图。
- 页面布局根因：`.toolbar > * { flex: 1 1 160px }` 平台类在宽卡片内把字段撑到数百像素宽（org 创建表单、account-security 密码表单、assignments 表单）；`.org-tree-inspector` 固定 320px 右栏，Menus 的 `policy-controls` 四列 grid（140+180+160+auto）在 320px 内必然横向溢出被裁剪（P0）。

## 发现（按优先级，摘自 codex findings + 代码核对）

| 页面 | 级别 | 问题 | 代码依据 |
| --- | --- | --- | --- |
| menus | P0 | 右侧 inspector 被截断；树显示原始 i18n key；横向比例失衡 | policy-controls 4 列 grid 溢出；`title()` 对非 navigation 模块直接返回 titleMessageId |
| settings/appearance | P0 | 主题控件横排错位、标签与控件归属不清 | switch 行布局横跨整卡 |
| openapi | P0 | 无选中时右侧空白；列表底部被截无边界 | workspaceEmpty 过于简单；首访无默认选中 |
| departments | P1 | 创建表单左密右空；上级部门 select 与输入宽度不一致；树/详情比例失衡 | `.toolbar` flex 撑宽 + org-tree-inspector 布局 |
| positions | P1 | 创建卡过高；列表 card-grid 超宽稀疏行，每卡重复按钮 | item-card 全宽 flex 行 |
| account-organization(assignments) | P1 | 表单控件近全宽堆叠；下方大留白 | form-panel 全宽 |
| permissions | P1 | 卡片内留白过大；列稀疏；描述「翻译资源缺失」 | 权限描述 key 缺 zh/en 文案或 key 不一致 |
| sessions | P1 | 筛选/排序散乱留白大；排序 Select 空值时仅剩箭头残缺感 | 排序 SelectField 无 placeholder |
| api-tokens | P1 | 创建表单无分组超宽堆叠；scope 显示 OTHER/* 无语义 | 无分组 + mock scope 数据语义差 |
| account_security | P1 | 两宽输入无确认新密码、无分组 | 密码表单 2 字段 |
| settings/profile | P1 | 字段单列全宽堆叠 | settings form 单列 |
| settings/account | P1 | 单行用户名占大卡 | 身份卡过简 |
| settings/security | P1 | 密码输入全宽；API token 卡被截 | 同上 |
| settings/language | P1 | 纯文本行无选中态 | 语言行 |
| settings/notifications | P1 | 开关与标签间距过大 | 开关行两端排布 |
| settings/about / acknowledgement | P1 | 卡过高、信息密度低 | 列表堆叠 |
| login | P1 | 页面大面积空白；图标散落；无密码显隐 | blank-layout |
| setup | P1 | 字段无分组堆叠 | iam setup 表单 |
| capabilities | P2 | 筛选折叠态默认动作语义不清；JSON 截断不可展开 | — |

## 推断与影响

- 根因两处平台级：`.toolbar` 的 flex 撑宽语义不适合作“创建表单”；`org-tree-inspector` 的 320px 固定右栏不适配 Menus 的编辑控件。修复应优先以“受限表单宽度 + 分组”与“可滚动的自适应用户详情区”两个平台原语落地，惠及全部相关页面。
- 翻译资源缺失为真实缺陷（非截图伪影）：权限描述 key 必须补齐汉英文案或在缺失时回落可读文本。
- Menus 原始 key 需要跨 namespace 翻译能力：`webui/src/i18n.ts` 已提供 `translateMessage`/`ensureRouteLocale`，通过 `@webui/sdk/i18n` 导出即可复用。
- 「翻译资源缺失」与「原始 i18n key」属于 P1 内容缺陷，重排布局前先修数据/文案问题。

## 局限

- 截图基于 mock 数据源（fixture 较小，树/列表行数少），真实后端的海量数据下密度问题会更显著；本审计只锁定结构性缺陷。
- 移动视口未覆盖（既有受限项）。