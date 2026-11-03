# 056 Navigation 后台导航策略设计

## 1. 两层 authority

| 层 | Owner | 内容 |
| --- | --- | --- |
| Menu Definition | 各模块 WebUI Binding | NavigationID、RouteID、Entry、path、title、icon、ViewOperationID |
| Menu Policy | Navigation | enabled、parent override、order override |

Navigation 接收 composition 从 053 WebUI Catalog 映射出的窄 `NavigationCatalog`，不导入 `internal/webui`。Catalog 只暴露策略校验需要的稳定 ID、默认 parent/order/enabled、route 与 permission projection。

## 2. 模型与合并

```text
MenuPolicy
  NavigationID
  Enabled
  ParentIDOverride?
  OrderOverride?
  Version / UpdatedAt
```

缺少 policy 行使用 Binding 默认值。Service 在事务中校验 Catalog revision、引用、父子无环、order 和乐观版本，提交后计算确定性的 NavigationRevision。

Manifest 路径：static Catalog -> policy snapshot -> access -> availability -> Manifest。CatalogRevision 仍校验 generated registry；NavigationRevision 只用于策略缓存/刷新。

## 3. 权限关系

Navigation 贡献 menu read/write；IAM 拥有 RolePermission。composition/WebUI 可以把 Navigation Catalog 的 route view permission 与非页面 action 按模块投影为权限树，但 Navigation Service 不读取或写入角色关系。

## 4. API、WebUI 与 Migration

typed HTTP 提供当前 menus snapshot 和 replace/update policies，使用 webuiSession、Origin/CSRF、navigation permission 和稳定错误。

WebUI Binding 使用 `navigation.*`、`webui.navigation`，Menus 页面把静态只读字段与 enabled/parent/order 编辑字段分开，未知/冲突/环有明确呈现。

`navigation_schema_migrations` 只创建 menu_policies。首版每次 Manifest 请求读取一致 snapshot，不使用 runtime cache、watcher 或 goroutine。

## 5. 错误与验证

稳定错误包括 navigation unknown/not manageable、cycle、invalid parent/order、catalog changed 和 optimistic conflict。

验证覆盖：Catalog Adapter、policy merge、无环/order、双 revision、transaction rollback、三驱动 schema/checksum、HTTP security、Manifest access/availability、WebUI 生成/i18n/style/视觉，以及数据库不含动态 component/role_menu 的反向门禁。
