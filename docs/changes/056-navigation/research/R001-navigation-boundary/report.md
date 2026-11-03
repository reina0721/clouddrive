# R001 静态菜单与运行期策略边界

## 1. 当前事实

当前每个模块 Binding 声明 Entry、Route、Navigation、Locale，Catalog 在构建期校验 owner/引用/环并生成 revision；registry 只生成静态 lazy import，runtime Manifest 不包含 SourcePath 并按 access/availability 过滤。

因此数据库 component/path 既绕过构建门禁，也没有可加载实现。053 R003 已证明可管理范围只能是已注册 NavigationID 的 enabled/parent/order，R005 将该策略 owner 从 Account 修正为 Navigation。

## 2. 目标结论

- Menu Definition 属于各模块静态 Binding；MenuPolicy 属于 Navigation；
- 缺少 policy 使用静态默认值，未知引用或环 fail closed；
- CatalogRevision 只关联生成物，NavigationRevision 只关联运行策略；
- 菜单隐藏不撤销权限，ManifestRoute 与服务端 operation gate 继续生效；
- 角色权限展示可借用菜单树，但持久化仍只有 IAM RolePermission。

## 3. 能力与生命周期

Navigation 复用 Database、Clock、Logger、053 Permission/Migration/HTTP/WebUI policy 契约，不新增 Kernel Capability、cache、watcher 或 goroutine。composition 提供静态 Catalog Adapter，Navigation 不导入 WebUI 或 IAM 实现。

## 4. 局限与门禁

外链、iframe、远程模块、CMS、多租户菜单或 push/cache 会改变安全和生命周期边界，必须重新研究。当前证据足以形成 056 计划，不构成实施授权。

2026-08-22 在 055 完成提交 `e4e279c4e3ecd84588f7976b2bb8bae203844278` 上复核：IAM、Organization 和现有模块均通过静态 WebUI Binding 注册 Route/Navigation，053 的 `BuildNavigationPolicySnapshot` 仍是唯一运行时策略投影入口；Manifest handler 目前固定持有默认 snapshot，改为每请求读取 Navigation Service snapshot 无需改变静态 Catalog 或 RolePermission authority。原结论保持有效。
