# 对标矩阵逐项复测（116 收口）

日期：2026-10-27。对象：本轮实现后的 console-web（`WEB_DEPLOYMENT_MODE=mock`）。
方法：不依赖"组件存在"或"任务已勾选"，逐项在真实浏览器重跑六类场景后回填结论。

## 复测方式

| 证据                               | 内容                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `evidence/parity-retest.log`       | 本轮六类场景定向复测：19 个 spec、**109 项通过**（2026-10-27）                             |
| `evidence/pnpm-check.log`          | 完整 `pnpm check`：**413 项浏览器**、192 web + 175 surfaces 单测、build、预算、format/docs |
| `evidence/screenshots/`            | 登录、分析与工作区、菜单/部门/字典、快捷偏好抽屉的 1440×900 实际截图                       |
| `research/vben-live-comparison.md` | Vben 线上实测记录（结构、字段、工具栏、空/错态、访问限制）                                 |

结论口径：

- **已达到**：同类能力在本项目语义下完整可用，并有断言覆盖；
- **等效实现**：形态不同但用户价值相同，且原因属于本项目约束（Token/路由/权限模型）；
- **真实外部限制**：依赖外部服务/资产或明确产品决策，本轮不伪造，记录影响。

## 逐项矩阵

| 能力项              | Vben 实测                    | console-web 本轮实现                                               | 复测证据                                                                              | 结论     |
| ------------------- | ---------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------- |
| 角色快捷登录        | 3 角色下拉 + 自动填充        | 3 身份一键**真实登录** + 上次使用记忆 + 演示数据重置               | `demo-access.spec.ts`（登录/权限差异/重置）                                           | 已达到   |
| 登录辅助安全        | 滑块验证条                   | 不实现滑块；明确"客户端演示、不构成安全认证"                       | `demo-access.spec.ts` + 登录页说明文案                                                | 等效实现 |
| 多布局 Shell        | 7 种布局                     | 3 种（侧边/顶部/混合），同一导航模型与权限过滤                     | `shell-security.spec.ts`（布局切换+刷新保持）、`settings-*`                           | 等效实现 |
| 页签固定与批量      | 固定页签、更多按钮、中键关闭 | 固定/取消、单项菜单（关闭左右/全部/刷新）、中键关闭                | `page-tabs.spec.ts`、`shell-security.spec.ts`                                         | 已达到   |
| 页签拖拽排序        | 支持                         | 不做拖拽；Surface authority 明确保持访问顺序                       | `page-tabs.spec.ts`（顺序不可变断言）                                                 | 真实限制 |
| 命令搜索            | 顶栏常驻 Ctrl K              | 命令面板 + CommandsPort + 快捷键                                   | `commands.spec.ts`                                                                    | 已达到   |
| 面包屑              | 分组 > 父级 > 当前           | 偏好开关控制的层级面包屑                                           | `breadcrumbs.spec.ts`                                                                 | 已达到   |
| 偏好分类            | 5 分类抽屉 + 实时预览        | 九分类设置页 + 快捷抽屉（同一 PreferencesPort）                    | `settings-product-review.spec.ts`（9 分类字段/窄屏/Axe）                              | 已达到   |
| 偏好配置输出        | 复制                         | 复制 / 下载 / 导入（整包校验，失败不部分应用）                     | `settings-product-review.spec.ts`（配置输出面板）、`settings.spec.ts`                 | 超出     |
| 水印                | 插件开关                     | Host 覆盖层，明示"非安全边界"                                      | `shell-security.spec.ts`                                                              | 已达到   |
| 锁屏                | 手动/空闲锁屏                | 手动 + 空闲 + 后台锁定；只读密码复核，不退出会话                   | `shell-security.spec.ts`（错误密码保持锁定）                                          | 已达到   |
| 色弱/灰阶           | 有                           | 有（语义滤镜，Token 驱动）                                         | `settings-semantic.spec.ts`、`shell-security.spec.ts`                                 | 已达到   |
| 色板数量            | 13 + 自定义                  | 4 个 accent（Design System authority）                             | `settings-semantic.spec.ts`（选项矩阵）                                               | 等效实现 |
| 列设置/密度/导出    | vxe 列设置 + 密度 + 导出     | `collection-tools` 共享组合；users/audit 真实接入；CSV 含选中项    | `table-productivity.spec.ts`、`column-settings.spec.ts`                               | 已达到   |
| 固定列/树形行       | 支持                         | DataTable contract：固定列、树形行使能、三档密度                   | `table-productivity.spec.ts`、`table-density.spec.ts`                                 | 已达到   |
| 查询折叠/chips      | 查询表单收起/重置            | 折叠高级筛选 + 可移除 chips + 重置，URL 语义保持                   | `reference-resources.spec.ts`、`table-productivity.spec.ts`                           | 已达到   |
| 菜单管理            | 三级树 + 权限标识 + 增删改   | 读部署期 catalog；标题/排序/可见性/权限码覆盖**真正作用于侧栏**    | `system-management.spec.ts`（覆盖+隐藏+跨刷新）                                       | 已达到   |
| 部门/字典管理       | 树表 / 类型+条目             | 三级树（16 节点）/ 5 类型 18 条目；校验、删除保护、乐观版本        | `system-management.spec.ts`、`product-management.spec.ts`                             | 已达到   |
| 权限演示            | 组件/函数/指令               | 按钮级门控 + 只读拒绝态 + 角色权限编辑（React 无指令，Hook 覆盖）  | `system-management.spec.ts`（操作员只读）、`product-management.spec.ts`               | 等效实现 |
| 分析页              | 4 KPI + 面积图 + 3 卡        | 4 KPI + 7/30/90 天面积 + 来源环形 + 设备条形 + 页面排行 + 三态闭环 | `analytics-workspace.spec.ts`（KPI/图表/空错恢复/390 深色）                           | 已达到   |
| 工作台              | 问候/项目/动态/快捷/待办     | 同信息架构；快捷入口走 symbolic route；待办持久化                  | `analytics-workspace.spec.ts`（快捷入口 + 勾选刷新保持）、`product-workbench.spec.ts` | 已达到   |
| 图表可访问性        | 未验证（第三方图表）         | `role="img"` + aria-label + 隐藏数据表 + 数据点 roving tabindex    | `analytics-workspace.spec.ts`（方向键移动焦点）                                       | 超出     |
| 虚拟滚动/单元格编辑 | 有                           | 不做：无 10k 级真实数据；业务编辑走既有表单页                      | 决策 D-09；无对应业务断言                                                             | 真实限制 |

## 复测结论

- 六类目标均有真实浏览器断言覆盖，**未发现"文档已勾选、产品不可用"的项**。
- 与 Vben 的差异集中在两类：①本项目 Design System / Surface authority 约束下的等效实现
  （布局数量、色板数量、权限指令方式）；②明确不做且有理由的能力（拖拽排序、虚拟滚动、
  单元格编辑、滑块验证）。
- 外部限制：Vben 演示后端 503，其 CRUD 数据态、分页与编辑交互**未被观察**，因此本矩阵
  只对标可见结构/字段/工具栏/空错态；console-web 的演示数据均在页面显式标注，未声称真实
  Backend 联调。

## 复核入口

- 完整门禁：[pnpm-check.log](../evidence/pnpm-check.log)
- 定向复测：[parity-retest.log](../evidence/parity-retest.log)
- 关键截图：[screenshots](../evidence/screenshots)
- 实现决策：[decisions.md](../design/decisions.md)
