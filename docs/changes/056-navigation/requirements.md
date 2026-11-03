# 056 Navigation 后台导航策略需求

## 1. 产品目标

让 owner 在不破坏静态模块所有权和服务端授权的前提下，管理当前应用已注册菜单的启停、层级与排序。

## 2. 范围

| ID | 要求 |
| --- | --- |
| `NAV-REQ-001` | Navigation 拥有 MenuPolicy 与 `NavigationRevision`；模块 WebUI Binding 继续拥有 Menu Definition、Route、Entry、locale 和源码。 |
| `NAV-REQ-002` | MenuPolicy 只能引用当前 Catalog 已注册且可管理的 NavigationID，写入 enabled、parent override、order override；未知、未实现和非法节点拒绝。 |
| `NAV-REQ-003` | 数据库不得创建/修改 RouteID、path、component/source、Entry、TitleMessageID、IconID、ViewOperationID、Module owner、外链、iframe 或远程模块。 |
| `NAV-REQ-004` | parent override 必须无环且指向有效目录/节点；order 使用有界命名类型和稳定排序，缺少 policy 行使用 Binding 默认值。 |
| `NAV-REQ-005` | `CatalogRevision` 与 `NavigationRevision` 必须分离；policy mutation 只改变后者并触发当前页面刷新 Manifest。 |
| `NAV-REQ-006` | disabled menu 只从导航投影移除，不删除 ManifestRoute、不撤销 permission，也不允许绕过已知 URL 的服务端 operation gate。 |
| `NAV-REQ-007` | 菜单、view operation 和 action permission 可投影为 IAM 角色权限树，但只保存 RolePermission，不创建 `role_menu`。 |
| `NAV-REQ-008` | 模块贡献 `navigation:menu:read`、`navigation:menu:write` 精确 permission。 |
| `NAV-REQ-009` | 提供 menus/menu policies typed HTTP API 与 Menus WebUI，展示静态字段和可写策略字段的明确区别。 |
| `NAV-REQ-010` | `navigation_schema_migrations` 从三驱动 000001 创建 menu_policies，不创建 IAM/Organization/WebUI definition 表。 |
| `NAV-REQ-011` | runtime 每次 Manifest 获取读取一致 policy snapshot；首版不增加 watcher、push channel、跨实例缓存或后台 goroutine。 |

## 3. 验收

1. owner 调整已注册菜单 enabled/parent/order，刷新 Manifest 后得到新的 NavigationRevision。
2. 未知 NavigationID、component/path 修改、父子环和非法 order 被拒绝，不留下部分状态。
3. disabled menu 的已知 URL 仍由 route access 和服务端 API 权限判断。
4. 角色权限树和菜单管理没有建立第二套授权记录。
5. Catalog 变化导致旧 policy 不兼容时 Application Generation fail closed。

## 4. 非目标

- 不从数据库创建页面、Route、component、Entry、外链、iframe 或远程模块。
- 不实现运行时模块安装、CMS、菜单模板市场或多租户菜单。
- 不保存 RoleMenu，不执行授权 decision。
- 不增加 watcher、推送、分布式缓存同步或轮询 goroutine。
