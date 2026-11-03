# database

`pkg/database` 为上层提供稳定的资源、租约、事务、migration status 与错误能力。底层统一使用 GORM；GORM 类型只允许出现在本包的显式 session bridge 和模块 `repo` 数据库 Adapter，不能进入模块 Service、Model、port 或 composition 公共契约。

## 怎么运行

Kernel 默认使用 pure-Go SQLite，配置无需选择 ORM：

```yaml
database:
  driver: sqlite
  dsn: .data/app.db
```

`internal/kernel/app/database` 在构造代码中调用 `database.NewGORM`，因此运行时配置只能选择 `sqlite`、`postgres` 或 `mysql` Driver，不能切换 GORM/SQLX 等底层技术。SQLite 会自动创建目录和文件，并启用 foreign keys、5 秒 busy timeout 与 WAL；私有 `:memory:` 数据库固定使用一个连接。

独立使用时，只有资源所有者负责关闭连接池：

```go
cfg := database.DefaultConfig()
resource, err := database.NewGORM(ctx, &cfg)
if err != nil {
	return err
}
defer resource.Close()

if err := resource.Ping(ctx); err != nil {
	return err
}
```

`NewGORM` 只创建并配置连接池，不执行网络探测；Kernel 在 candidate 已转交 owner 后由 Ready 执行唯一 Ping。`Resource.Close` 是一次 terminal attempt，重复调用返回第一次结果，不表示失败步骤可安全重试。PostgreSQL 与 MySQL 应通过环境变量注入真实 DSN，不把凭据写入配置、源码或日志。

## 怎么实现模块 Repository

模块 `repo` 定义具体持久化 Record，并通过 `UseGORM` callback 使用当前租约的 session：

```go
err := access.Use(ctx, func(client database.Client) error {
	return database.UseGORM(ctx, client, func(db *gorm.DB) error {
		return db.Table("accounts").Where("id = ?", id).First(&record).Error
	})
})
```

callback 返回时 session context 会被取消，`*gorm.DB` 不得保存或向上层返回。查询必须绑定参数；mutation 必须显式限制条件；乐观锁更新必须同时匹配 ID 与 Version、使用 `gorm.Expr("version + 1")` 原子递增，并在 `RowsAffected == 0` 时返回 `ErrOptimisticConflict`。`gorm.ErrRecordNotFound`、唯一键和外键错误由 session bridge 统一转为项目错误。

生产 schema 的唯一 authority 是业务模块拥有的 versioned SQL 与独立 `db migrate` command。禁止使用 AutoMigrate，也不再提供反射式 Schema、Query 或 generic Repository。

## 怎么使用事务

```go
err := access.WithinTx(ctx, func(ctx context.Context, _ database.Client, tx database.Tx) error {
	return database.UseGORMTx(ctx, tx, func(db *gorm.DB) error {
		return db.Table("accounts").Create(&record).Error
	})
})
```

`Tx` 不提供 Commit、Rollback 或连接池关闭权。回调返回 `nil` 时提交，返回错误时回滚；回调 panic 时先回滚再继续抛出原 panic。事务对象与 session 都不得逃逸 callback。

## Kernel 租约边界

`Capabilities.Database` 是稳定 Access。`Access.Ping` 在资源租约内提供窄就绪检查，但不暴露连接池对象；上层在 `Use` callback 中取得不含 `Close` 的 Borrowed Client。`Access.WithinTx` 的 callback 同时取得当前租约内 Client 和 Tx。callback 返回后，逃逸的 Client 和 Tx 返回 `ErrClientUnavailable`；逃逸的 GORM session context 已取消。Stats 和 Close 只由 Kernel 私有 Resource 使用。

## 错误语义

调用方使用 `errors.Is` 判断 `ErrNotFound`、`ErrDuplicateKey`、`ErrForeignKeyViolation`、`ErrOptimisticConflict`、`ErrInvalidIdentifier`、`ErrClientUnavailable`、`ErrNilClientFunc` 和 `ErrNilTransactionFunc`。底层驱动错误只保留稳定分类，不提供可展开的原始错误文本，避免 DSN、密码或 Token 通过错误链泄漏。

## 当前非目标

不提供向 Service/Model/port 传播的 GORM session、AutoMigrate、破坏性 migration、读写分离、分库分表或多租户。确有业务需要时，应在 module repo Adapter 内评估并重新确认边界，不能让业务核心直接依赖 GORM。
