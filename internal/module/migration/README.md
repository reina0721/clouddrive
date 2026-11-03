# Migration 模块

`internal/module/migration` 只编排显式 `status/up` 用例与 CLI contract，不拥有业务表或 SQL。通用 golang-migrate Adapter 位于 `pkg/database/migrate`；每个业务模块通过显式 `Registration` 贡献独立 Set、source、版本表和可选 completion，composition 使用 `BuildCatalog` 汇总。

```text
cmd/app db migrate
  -> internal/module/migration
  -> pkg/database/migrate
  -> applicationMigrationCatalog
       -> internal/module/todo/binding/migration.Set
```

Catalog 按 `ModuleID` 稳定排序，并在 I/O 前拒绝重复 module、set、source、version table、退休标记和错误 checksum。`status` 不执行 DDL，返回逐 set 状态；`up` 为每个 set 使用 invocation-owned 独立 runner，保留 set identity，并合并主错误与关闭错误。Service 启动只读检查全部 set，不能替 migration command 改 schema。

当前生产 Catalog 包含 IAM 与 Todo：两者最终 baseline 均为 000001，版本表分别是 `iam_schema_migrations` 与 `todo_schema_migrations`。发现已退休的 `schema_migrations`、`webui_users` 或 `webui_sessions` 时，preflight 在创建 runner 前返回 `ErrPreReleaseBaselineResetRequired`；不会迁移、删除、覆盖或猜测用户数据。

本地首次启动命令关系见 [本地启动指南](../../../docs/getting-started/local-development.md)；部署、回滚和失败处理见 [数据库迁移与回滚](../../../docs/operations/migration-and-rollback.md)。
