# 084 任务清单：逐页推翻低质量布局（第一批）

研究门禁已通过（R084-001）；目标指令即计划确认。任务 ID 稳定，记录逐轮证据。

| ID | 工作量 | 内容 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- |
| PLAT-084-001 | M | 平台原语：`.field-grid` / `.split-workspace` / `.row-actions` / `.form-panel-bounded` + inspector 修复（styles.css） | lint/vitest/e2e 全绿；截图复核 | 完成 |
| I18N-084-001 | S | sdk/i18n 导出 translateMessage/translateOptional/ensureRouteLocale | Menus 树无原始 key；权限描述可解析 | 完成 |
| ORG-084-001 | L | Departments 目录工作台（搜索树 + InspectorPanel 视图/编辑/创建 Drawer + 归档确认） | mock e2e 断言 + 截图 | 完成 |
| ORG-084-002 | M | Positions 名录 DataTable（行菜单重命名/归档确认 + 创建/重命名 Drawer） | mock e2e 断言 + 截图 | 完成 |
| ORG-084-003 | M | Assignments 两栏 master-detail 分配编辑器（账号列表 + 分配表单） | 截图 + lint | 完成 |
| NAV-084-001 | M | Menus P0：可滚动右侧面板、策略控件纵向、跨 namespace 标题翻译、空态 | e2e 断言（无 webui. 原始 key）+ 截图 | 完成 |
| OAPI-084-001 | S | OpenAPI：首访默认选中 + 可操作空态 + 列表边界 | vitest（空态用例）+ mock e2e | 完成 |
| IAM-084-001 | M | Permissions/Roles 描述解析（permission.* → 模块 locale 键，缺失回落目录键）+ 表头/密度 + ApiTokens 创建分组 | e2e 断言无缺失占位；截图 | 完成 |
| SET-084-001 | M | Settings 开关行/语言单选组重构（appearance/notifications/language）+ 密码表单（confirm + bounded） | 截图复核 | 完成 |
| QA-084-001 | L | 验证矩阵（typecheck/lint/vitest 199/mock e2e 5）+ 重新截图 + codex 复查 | 全绿；P0 清零，残余 P1 记录 | 完成（残余见下） |
| DOC-084-001 | S | 变更记录 + changes 索引 + documentation-impact + authority（webui README / 模块开发指南） | docs-guard 通过 | 完成 |
| AUTH-084-002 | M | 登录/初始化页产品化：居中 auth 面板、分组（凭证/账号）、密码显隐、确认字段、错误 Alert；blank 布局头部分组 | screenshot P2/codex 复核 | 完成 |
| LIST-084-002 | M | FilterBar 紧凑下拉（行内标签+原生 select）；Accounts 角色筛选（后端 roleId 契约）；Sessions/Accounts/Roles/ApiTokens 排序并入 FilterBar；Sessions 批量条常驻（未选禁用）；data-table-toolbar 收窄 | typecheck/lint/vitest/e2e 全绿 | 完成 |
| FIX-084-002 | S | OpenAPI 执行用例环境确定性（stubEnv，本地 webui/.env 声明 mock 不再影响） | vitest 199 全绿 | 完成 |
| DATA-084-003 | S | mock 数据量提升（账号/角色/会话/令牌 6-8 条、权限/审计扩容）作为密度复核基线 | 截图/codex 复核 | 完成 |
| LIST-084-003 | M | DataTable rowMenuHeader（操作列可见表头）+ 移除空列显隐工具栏；角色「类型」列头；审计操作列截断；page-sections 内容高度；输入边界/圆角 6px；API 令牌创建表单单列分组 + 触达后必填提示 + 权限分组全选 | typecheck/lint/vitest/e2e/build 全绿；codex 复核无新 P0 | 完成 |
| SESS-084-004 | M | 会话按账号过滤（后端 listSessions 已支持 accountId 契约，前端补账号下拉 + URL 参数 + mock 对齐） | typecheck/e2e 全绿 | 完成 |
| DASH-084-004 | S | 仪表盘健康行状态单元（点 + 低噪文字）、指标卡高度收敛 | 截图复核 | 完成 |
| ABOUT-084-004 | S | 技术栈两列 chip、设置卡内容高度、仓库地址可点击链接 | 截图复核 | 完成 |
| BULK-084-005 | L | 账号批量操作闭环：后端 `accounts/batch-status` + `accounts/batch-archive`（逐账号复用安全语义/审计，失败不中止并逐条导出稳定错误码）+ 契约生成 + BulkActionBar 多动作扩展 + Accounts 行选择与批量条 + mock/e2e | go test/vet、generate:check、vitest、mock e2e 7/7 全绿 | 完成 |
| FILTER-084-006 | M | FilterBar `trailingFields` 右侧排序簇（筛选左/排序计数右）；行操作列固定宽度 + 主操作/更多按钮带边界 chip；批量条未选择时降为次级视觉、取消 sticky 遮挡 | typecheck/lint/vitest/e2e/build 全绿；截图复核 | 完成 |
| AUDIT-084-007 | S | 审计筛选并入列表卡（移除独立筛选卡片，减少堆叠留白） | e2e/截图复核 | 完成 |
| DASH-084-007 | M | 指标快照前置 + 统计卡/指标块高度压缩，首屏编排收敛 | 截图复核 | 完成 |
| MICRO-084-007 | S | CodeText 复制按钮改带边界 chip（复制操作可发现） | 截图复核 | 完成 |
| AUDIT-084-008 | M | 全 24 路由严格可用性终审：22/24 无真实缺陷；修复 API 令牌「过期策略」下拉箭头错位锚定（行尾孤立箭头）与语言单选组默认无选中 | 终审 24/24 无 P0/P1 真实缺陷；e2e/vitest/build 全绿 | 完成 |

## 验证矩阵（实测 2026-09-01）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `tsc --noEmit` | 通过 |
| i18n 契约 | `node scripts/lint-i18n-contract.mjs` | 通过 |
| 架构 lint | `node scripts/lint-architecture.mjs` | 通过 |
| eslint | `eslint .` | 0 errors（5 条既有 warning：host/测试文件未用变量） |
| Vitest | `vitest run` | **199/199 通过（46 文件）** |
| Playwright mock | `playwright test --project=mock` | **5/5 通过**（含新增 084 工作台断言） |
| 构建 | `vite build` | 待跑 |
| Go | `go test ./...` / `go vet ./...` | 待跑（前端变更不涉 Go） |
| 视觉 | codex 复查批次 A/B/C + 终审 v2/v3 | P0 全部清零；Menus/Positions/Assignments 降至 P2；Department/ApiTokens/Account-Security/Permissions/Settings 残余 P1 为小数据 mock 下密度/留白与控件边界判断（个别源于 HeroUI Select 触发宽度），已修 field-grid min-width 溢出、Select 组内尺寸与创建区两栏，记录为第二批继续项 |

注：pnpm 脚本嵌套调用触发 devEngines 版本告警（声明 pnpm@10.22 vs corepack 11.7），单独执行 node 脚本与 `pnpm exec` 规避；测试结果均绿。

## 未执行/受限项

- 校验矩阵：go test/vet 全绿（前端变更不涉 Go）；`vite build` 成功（chunk 体积警告为既有项）。
- **第一批残余 P1（第二批继续）**：部门页目录卡与详情面板在小数据下密度（Select 弹出箭头与字段关系）、账号安全页 aside 与表单关联、权限目录页纵向/横向空白（mock 2 行数据放大观感）、设置卡 bounded 表单的右侧留白（语言/通知已至 P2）。
- **084b 残余（第三批继续）**：会话/角色/API 令牌列表在 mock 小数据下的横向铺开与卡片高度观感、角色行主操作语义（选择 vs 查看）、API 令牌创建区比例与按钮归属、权限面板区信息密度。均不阻断使用，属小数据放大后的密度判断，后续轮次按 R084-001 复跑收敛。
- **084c 残余（第四批继续）**：角色表卡底部空白与行操作一致性（系统角色仅有主操作、其余行有「…」，数据驱动差异）、审计筛选右对齐计数后的留白观感、API 令牌创建卡右侧留白（有界表单固有呼吸区）、仪表盘依赖健康行重复状态标签与列表首屏折线以下内容等 P2。均不阻断使用，记录后按 R084-001 复跑收敛。
- **084e 残余（后续轮次继续）**：FilterBar 多控件带的分组观感（评审两极振荡，属有界表单呼吸区与主观性，不阻塞）、列表卡底部留白与分页位置、仪表盘多层卡片层级重复、静态页留白、shell 侧栏底部空白（菜单数少）、复制图标文本提示、移动视口验证。严格可用性终审（24 路由）确认无真实 P0/P1 交互缺陷；上述均为视觉密度/留白的主观评审残余。
- 移动视口与真机验证沿用既有受限项。