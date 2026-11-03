# Navigation 模块

Navigation 只管理代码已注册菜单的运行策略：启停、父级覆盖、排序覆盖和 `NavigationRevision`。Route、Entry、组件、标题消息 ID、图标及查看权限始终由各业务模块的静态 WebUI Binding 拥有。

## 边界

- `service/` 通过调用方定义的 `NavigationCatalog` 窄端口读取静态定义并校验策略投影。
- `repo/` 与 `binding/migration/` 独占 `navigation_menu_policies` 及 `navigation_schema_migrations`。
- `handler/` 与 `binding/http/` 提供菜单读取、策略修改和稳定错误语义；修改请求复用 composition 提供的 IAM Session Origin/CSRF 守卫。
- `binding/webui/` 提供菜单策略页面；保存后通过宿主公开的 `refreshManifest` 契约刷新当前 Manifest。
- `binding/permission/` 贡献 `navigation:menu:read` 与 `navigation:menu:write`。

数据库不保存任意 Route、component path、Entry、ViewOperationID 或 `role_menu`。禁用菜单只影响菜单投影，已注册路由和服务端授权继续有效。首版每次 Manifest 请求读取一致策略快照，不引入 cache、watcher 或后台 goroutine。
