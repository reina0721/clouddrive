# 053 Admin 多业务模块基础平台需求

## 1. 目标

定向演进现有应用模块平台，使后续 IAM、Organization、Navigation 可以分别贡献权限、migration、HTTP 和 WebUI 完成品，并由 composition 在启动前统一校验。053 只建设真实后续用例已经证明需要的通用契约，不实施 Admin 业务功能。

## 2. 功能要求

### 2.1 显式模块聚合

| ID | 要求 |
| --- | --- |
| `FOUNDATION-REQ-001` | composition 必须分别显式聚合 HTTP Contract、WebUI Registration、Permission Definition 和 Migration Set；不得依赖目录扫描、`init` 注册或运行时 Resolver。 |
| `FOUNDATION-REQ-002` | 每类聚合必须校验 ModuleID、资源 ID、owner 和重复项，错误必须在 listener 或 migration 写入前包含稳定资源类型与模块身份。 |
| `FOUNDATION-REQ-003` | 不把所有完成品机械塞入现有 `module.Contribution`；只有共享校验确有共同语义时才提取窄 helper，保留 composition 的显式清单。 |

### 2.2 Permission Catalog

| ID | 要求 |
| --- | --- |
| `FOUNDATION-REQ-004` | 新增项目自有 Permission Definition/Catalog 契约，至少包含精确 Key、OwnerModuleID 和 DescriptionMessageID；Catalog 必须不可变、稳定排序并拒绝空值、重复和通配符。 |
| `FOUNDATION-REQ-005` | HTTP operation 与 WebUI route 引用的 permission 必须能对 Catalog 做完整性校验；Catalog 不负责用户、角色、关系存储或 authorization decision。 |
| `FOUNDATION-REQ-006` | 053 必须用当前真实 Todo/Auth operation inventory 验证 Catalog 聚合路径，不创建 IAM/Organization/Navigation 占位权限或假业务模块。 |

### 2.3 Migration Catalog

| ID | 要求 |
| --- | --- |
| `FOUNDATION-REQ-007` | Migration 应用层必须支持多个显式 Set，按稳定 ModuleID 排序，并校验 set ID、version table、source 与 checksum 冲突。 |
| `FOUNDATION-REQ-008` | `status/up` 必须返回每个 set 的 current/target/dirty/empty/compatible 和整体状态；任一 set 失败时保留模块身份、主错误和 cleanup error。 |
| `FOUNDATION-REQ-009` | Service startup 只读检查全部 set，不自动 migration；首发旧数据库标记检测必须发生在创建 Runner 或执行 SQL 之前。 |
| `FOUNDATION-REQ-010` | Todo 迁移可在 053 单轨收敛为 `todo_schema_migrations` 的干净首发 baseline，以真实验证多 set 接入位置；不得创建 IAM、Organization 或 Navigation schema。 |

### 2.4 HTTP 与 Auth 接入契约

| ID | 要求 |
| --- | --- |
| `FOUNDATION-REQ-011` | HTTP Contract 必须正式表达 `none`、`bearer`、`webuiSession` security；operation gate 按契约认证一次并将 Principal 注入 request context。 |
| `FOUNDATION-REQ-012` | Dispatcher 必须聚合多个 HTTP Module 与 runtime handler map，校验 ModuleID、OperationID 和 handler 一一对应，不再固定 Todo 或读取 `modules[0]`。 |
| `FOUNDATION-REQ-013` | Auth 必须提供项目自有认证来源/Session Resolver 接入契约；053 由当前真实 WebUI Auth 实现接入，054 再单轨替换为 IAM，不保留永久兼容层。 |
| `FOUNDATION-REQ-014` | Cookie name、Origin、CSRF 和认证失败语义不得硬编码进通用 contract；当前 Bearer/JWT、Todo、management 和 WebUI typed request chain 不得回归。Auth 本地账号持久化不属于本项承诺。 |

### 2.5 WebUI NavigationPolicy

| ID | 要求 |
| --- | --- |
| `FOUNDATION-REQ-015` | WebUI Manifest 必须支持通用 NavigationPolicy snapshot，对已注册 NavigationID 投影 enabled、parent 和 order，再叠加 access/availability。 |
| `FOUNDATION-REQ-016` | `CatalogRevision` 只表示构建期 Route/Entry/Navigation 与 generated registry；`NavigationRevision` 只表示运行期 policy snapshot，不得混为同一个版本。 |
| `FOUNDATION-REQ-017` | Policy 不得修改 Route path、component/source path、Entry、ViewOperationID 或 Module owner；未知引用、父子环和非法 order 必须 fail closed。 |
| `FOUNDATION-REQ-018` | 053 使用由当前静态 Catalog 确定生成的默认 policy snapshot 验证真实 Manifest 路径，不创建 Navigation 业务表、管理 API 或页面。 |

## 3. 非功能要求

- 所有新增契约保持项目自有类型，不泄漏 GORM、JWT、WebUI 业务 DTO 或第三方策略类型。
- 不扩大 Kernel Capability；所有聚合属于应用 composition 或现有 HTTP/WebUI/Migration 应用层。
- Catalog 在构造后不可变，不引入全局共享可变 Registry 或运行期缓存同步。
- 错误保留原始原因且不泄漏凭据、DSN、Cookie、请求 body 或数据库细节。
- 新的聚合契约必须有确定性、重复项、未知引用、失败关闭和旧行为回归测试。

## 4. 验收场景

1. 两个真实/测试模块以不同顺序贡献相同集合时，Permission/HTTP/WebUI/Migration Catalog 输出稳定。
2. 重复 ModuleID、PermissionKey、OperationID、NavigationID 或 migration version table 在启动/写入前被拒绝。
3. 当前 Todo HTTP 与 Auth WebUI Session resolver 经过统一 security profile 正确选择并单次注入 Principal，不再依赖 URL 前缀跳过；fresh database 的 Setup/Login 持久化等待 054 IAM。
4. 默认 NavigationPolicy 生成与当前静态菜单等价的 Manifest，CatalogRevision 不因运行期 policy 变化而改变。
5. Todo fresh migration 使用独立 version table；退休 baseline 在任何写入前拒绝，默认 `.data/app.db` 不被修改。
6. 053 完成后仓库仍不存在 IAM、Organization、Navigation 业务模型、表或页面占位实现。

## 5. 非目标

- 不实现 IAM、Organization、Navigation 业务功能。
- 不迁移 Auth 本地账号 owner；该单轨替换属于 054。
- 不实现数据库 MenuPolicy provider；该能力属于 056。
- 不实现 owner role、RolePermission 或数据库 permission reconciliation；属于 054。
- 不重构 Kernel、Database Resource、Supervisor 或 WebUI SDK 整体。
- 不引入自动发现、万能 Contribution、DI 容器、事件总线、策略引擎或分布式能力。
