# R010 数据 Repository 与 ORM 边界复核

## 决策

保留 `GORM v1.31.2` 作为数据库 Adapter 的成熟实现，保留 `pkg/database` 的连接池、三方言 Dialector、事务 token/租约、错误翻译、Ping/Stats/Close 和 `golang-migrate` 边界。单轨退役 `BaseRepository[T]`、反射式 `Schema`、string-field `Query/Changes` 及其动态 `reflect.StructOf` model。

模块 Repository Adapter 改为 concrete persistence record + direct GORM query。GORM 类型只允许存在于 `pkg/database` 的 technology-specific session bridge 与 `internal/module/*/repo`，不得进入模块 Service、Model、port 或 composition 公共契约。

当前不引入 GORM Gen 或 sqlc。

## 当前代码事实

- `pkg/database/repository.go` 与 `schema.go` 合计约 900 行，自行实现 schema 校验、动态 model、字段/类型检查、where/order/page、CRUD、soft delete 与 version increment。
- IAM 6 个、Organization 4 个、Navigation 1 个、Todo 1 个 generic repository 都重复声明与 migration SQL 高度相似的 table/column/index/reference metadata。
- production 查询只有等值、`IN`、`IS NULL`、排序、offset/limit、count、简单 update 与 optimistic version filter；搜索没有 join、CTE、window、preload 或真实复杂 handwritten SQL。
- 业务 Service 已经依赖模块自有 Unit/Store port，不依赖 `BaseRepository` 或 GORM。问题局限在 infrastructure Adapter，适合单轨替换而不改变业务 API。
- 当前 `Client`/`Tx` 有意不暴露共享资源关闭权，`Borrow` 将 session 生命周期绑定到 generation resource lease；这部分具有项目资源治理价值，不能因删除 generic repository 一并拆掉。

## 候选比较

| 方案 | 当前适配性 | 结论 |
| --- | --- | --- |
| direct GORM concrete records | 已有成熟依赖、三方言、事务和错误翻译；当前查询简单；不增加 generator 或 SQL 方言资产 | **采用**。在模块 repo Adapter 直接表达查询，显式检查 `RowsAffected` 与 version conflict |
| GORM Gen `v0.3.28` | 2026-03-04 发布，MIT，维护活跃；生成 type-safe DSL，仍基于 GORM | 当前只有少量简单查询，生成入口、generated files 与 query API 的维护成本高于 string-field 消除收益；其 module baseline 仍依赖较旧 GORM 线，需额外兼容验证。暂不采用 |
| sqlc `v1.31.1` | 2026-04-22 发布，MIT，维护活跃，支持 PostgreSQL/MySQL/SQLite，type-safe SQL | 项目承诺三方言，而当前查询没有 SQL-heavy 收益；需要维护方言差异 SQL、生成配置与另一套 driver/session 适配，且会绕开现有 GORM transaction/resource path。暂不采用 |

OSV 当前对 `gorm.io/gen` 与 `github.com/sqlc-dev/sqlc` 查询均为 0 条记录；这不替代实施时对实际依赖图的 `govulncheck`。

## 目标边界

```text
Service/Model -> 模块 Store/Unit port
                    ^
internal/module/*/repo (concrete record + GORM query)
                    ^
pkg/database GORM session bridge + Client/Tx lease
                    ^
composition-owned GORM Resource / sql.DB
```

session bridge 只负责在 `Client`/`Tx` 活跃期执行 `func(*gorm.DB) error`，不复制 GORM API，也不允许调用方持有 session 越过回调。Repository 负责 table mapping、query、RowsAffected 与模块错误转换；migration SQL 继续是 schema authority，禁止 AutoMigrate。

## 单轨迁移顺序

1. 建立受租约约束的 GORM session bridge 与 architecture test，证明 session 不可逃逸、Tx/cancel/error 语义不退化。
2. 先迁移 Todo 与 Navigation：覆盖 CRUD、分页/排序、not found、version conflict 与三方言 contract tests。
3. 再迁移 IAM 与 Organization：覆盖多 repository transaction、唯一/外键错误、owner/catalog reconciliation、session revoke 和 optimistic updates。
4. 搜索并删除 `BaseRepository`、`Schema/Field/Index/Reference`、`Query/Filter/Order/Page/Changes` 与反射 model；同步 README/technology authority。
5. migration 文件和本地数据库不删除、不重写；不使用 AutoMigrate 作为兼容层。

## 停止条件

- direct GORM 迫使 GORM 类型进入 Service/Model/port；
- session bridge 不能维持 Borrow/Tx lifetime 或资源关闭语义；
- 三方言需要大量不可控分支；
- 发现真实复杂 SQL 使 direct GORM 明显恶化可读性与测试性。

若出现最后一项，针对该查询重新研究 sqlc 或 GORM Gen，不恢复 generic repository 作为万能抽象。

## 局限

当前仓库没有计划中声称的“真实复杂 join”，因此不能用虚构查询评价生成器。结论适用于当前 CRUD/事务集合；查询复杂度或方言策略变化时必须刷新。
