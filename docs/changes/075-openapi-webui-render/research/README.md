# 075 研究档案

本任务现有九个研究记录：外部选型、契约快照链、平台组件呈现、可测试工作台、Apifox 形态拆解、设计语言回归、层级分类与多页面（UI 结论被 R075-009 取代，业务能力继续有效）、页面访问门槛、工作台式骨架（当前有效）。

## 记录索引

| ID | 主题 | 结论 |
| --- | --- | --- |
| R075-001 | Swagger UI 库选型 | `superseded`，历史证据 |
| R075-002 | 契约快照链（单权威、零漂移） | 有效，与呈现无关，保持不变 |
| R075-003 | 页内呈现用平台组件（只读单页） | `superseded`（R075-004） |
| R075-004 | 可测试工作台（树/详情/执行器/模型） | `superseded`（R075-005）：执行语义与纯函数层复用 |
| R075-005 | Apifox 产品形态拆解（官方物料 + 产品知识） | `superseded`（R075-006 UI 结论）：业务能力清单继续有效（文档/调试双模式、参数表单、Try it out、响应元素、Cmd+K、深链），UI 呈现结论被取代 |
| [R075-006](R075-006-design-language-realignment/) | 设计语言回归（提取业务能力、融入后台视觉，去 Apifox 外壳） | 当前有效：平台组件 + 标准后台流程呈现（列表 → 详情/弹层 → 表单 → 发送 → 响应卡片），删除 apifox 自定义外观，业务层（openapi-data/run-store/highlight/执行语义/深链/快照链）保留 |
| [R075-007](R075-007-hierarchy-multipage/) | 层级分类与多页面（GroupLayout 073 多静态路由 + SectionNav 动态条目 + query 深链） | 当前有效：/openapi 总览（分类卡片）→ /openapi/tags（分类接口列表）→ /openapi/operation（文档/调试页），模型独立 /openapi/models；共享 OpenAPILayout，详情 Drawer 升级为页面，数据/执行/mock 全部复用 |
| [R075-008](R075-008-openapi-view-access/) | 页面未登录可访问的根因与修复（绑定 ViewOperationID） | 当前有效：无 ViewOperationID 的路由在 manifest 投影默认 AccessAllowed；修复为四个路由绑定 iam.session.read（已认证即放行），未登录跳 /login、菜单隐藏，mock 恒 allowed 不受影响 |
| [R075-009](R075-009-workspace-skeleton/) | 工作台式骨架回归（左资源树 + 顶部多标签 + 请求/响应上下分割） | 当前有效：项目基座是 HeroUI（非 Element Plus/AntD）；Tabs 受控 selectedKey、Disclosure 递归树、自研窄 Resizer 上下分割；单路由 /openapi 工作台替代多路由，数据/执行层全部复用；R075-007 多路由 UI 结论被取代 |

## 有效性

- 记录均为 snapshot 型（2026-08-25）；UI 细节以用户对系统视觉对照为准（刷新触发器见各 metadata）。
- 研究门禁通过只表示证据足以形成计划，不表示计划已确认或代码已授权实施。