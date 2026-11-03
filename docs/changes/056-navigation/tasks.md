# 056 Navigation 后台导航策略任务

## 确认状态

研究已按 054/055 完成提交刷新；用户已明确确认 `NAV-056-001..007`。

| ID | 工作量 | 依赖 | 任务 | 完成条件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `NAV-056-001` | L | 053/054、用户确认 | 冻结 MenuPolicy、permission 与 NavigationCatalog port | 两层 authority、字段可写性、package dependency 和禁止项测试明确 | 已完成 |
| `NAV-056-002` | XL | 001 | 建立三驱动 schema 与 Repository | fresh/repeat、unique/optimistic/rollback/checksum 通过，无动态 page/role_menu 字段 | 已完成 |
| `NAV-056-003` | XL | 001,002 | 实现 Policy Service 与 WebUI Catalog Adapter | unknown/manageable、merge、无环/order、Catalog conflict、NavigationRevision 测试通过 | 已完成 |
| `NAV-056-004` | XL | 003 | 实现 typed HTTP 与稳定错误 | menus/policies、permission、Origin/CSRF、401/403/409 通过 | 已完成 |
| `NAV-056-005` | XL | 003,004 | 接入 Manifest policy projection | policy/access/availability 顺序、Catalog/Navigation revision、disabled route 语义测试通过 | 已完成 |
| `NAV-056-006` | XL | 004,005 | 实现 Menus WebUI 与 authority 文档 | 页面生成、i18n/style/unit/视觉、权限树投影和反向门禁通过 | 已完成 |
| `NAV-056-007` | XL | 002..006 | 全量验证并提交 | Go/WebUI/E2E/视觉/三驱动证据完整，只提交 056 范围 | 已完成 |

## 完成证据

- Navigation Service 覆盖默认合并、乐观锁、无环/父级/order、Catalog 漂移与事务回滚。
- Manifest 测试证明每次请求重新取策略，禁用菜单后 `navigationRevision` 变化且 Route 保留。
- WebUI typecheck、40 项 Vitest、build 与 9 项 Playwright 通过；菜单策略截图已人工检查。
- SQLite 使用临时数据库验证；默认 `.data/app.db` 未启动、未迁移、未改写。

## 重新确认触发器

- 数据库可创建或修改 Route/component/Entry/ViewOperationID；
- 新增 role_menu、第二套 authorization 或 Navigation 读取 IAM Repository；
- 加入外链、iframe、远程模块、CMS、多租户菜单；
- 加入 watcher、push、runtime cache 或后台 goroutine；
- 053/054 Catalog 契约实质变化。
