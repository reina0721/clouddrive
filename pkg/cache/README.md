# cache

`pkg/cache` 是项目内通用远端缓存边界。业务代码通过 `cache.Client[T]` 使用泛型值缓存，不直接依赖 Redis client、序列化库或字节协议；当前只有 Redis 远端 authority，不提供默认进程内 L1。

## 技术选型

- 通过 `github.com/redis/go-redis/v9` 接入 Redis，但 go-redis 类型只出现在 `pkg/cache/redisstore` 适配子包。
- 缓存值使用 `github.com/vmihailenco/msgpack/v5` 序列化为字节后写入 Redis，业务代码不需要手写 JSON 或 msgpack 编解码。
- typed Client 不持有连接、goroutine 或本地淘汰状态，因此没有 `Close`；Redis 连接始终由创建它的应用入口或 Cache App 关闭。

## 设计目标

- 显式依赖：独立使用时由调用方创建 Redis client 和 cache client；Kernel 模式通过稳定 Cache Access 构造无资源 typed Client，再通过构造函数注入业务组件。
- 泛型契约：业务通过 `Client[T]` 读写具体类型，不接触 `[]byte` 或 Redis 命令。
- TTL 必填：`Config.DefaultTTL` 或 `WithTTL` 必须提供大于 0 的有效期，避免隐式永不过期。
- 可替换：根包只依赖收敛的 `RemoteStore` 字节级契约；未来替换 Redis 适配时不影响业务 API。
- 可失效：支持按 key 删除和按 tags 批量失效，不提供危险的全量清空入口。
- 单一 authority：Get、Set、Delete 和 tag invalidation 都以远端 Store 为准，不在本地制造未提交值或跨实例陈旧副本。

## 目录结构

```text
pkg/cache/
├── cache.go             # 无资源 typed Client 与 msgpack 边界
├── config.go            # Config 配置类型
├── defaults.go          # 默认 tags TTL
├── errors.go            # 项目缓存错误哨兵
├── options.go           # SetOption、WithTTL、WithTags
├── types.go             # Client 和 RemoteStore 契约
├── redisstore/          # Redis 远端存储适配
└── README.md            # 使用文档
```

## 配置项说明

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `DefaultTTL` | 默认缓存项有效期。为 0 时，每次 `Set` 必须传入 `WithTTL` | `0` |
| `DefaultTagsTTL` | tag 索引有效期。实际写入 Redis 时使用 `max(itemTTL, tagsTTL)` | `720h` |
| `KeyPrefix` | key 和 tag 的命名空间前缀，用于隔离不同应用或环境 | 空 |

`DefaultTTL` 有意不提供开箱即用值。缓存有效期通常属于业务语义，脚手架不替业务选择“5 分钟”或“永不过期”。

## 基础使用示例

```go
package main

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/reina0721/clouddrive/pkg/cache"
	"github.com/reina0721/clouddrive/pkg/cache/redisstore"
)

type Profile struct {
	ID   int
	Name string
}

func main() {
	ctx := context.Background()

	redisClient := redis.NewUniversalClient(&redis.UniversalOptions{
		Addrs: []string{"127.0.0.1:6379"},
	})
	defer redisClient.Close()

	remote, err := redisstore.New(redisClient, nil)
	if err != nil {
		panic(err)
	}

	cfg := cache.DefaultConfig()
	cfg.DefaultTTL = 10 * time.Minute
	cfg.KeyPrefix = "user-api:"

	profiles, err := cache.New[Profile](remote, &cfg)
	if err != nil {
		panic(err)
	}
	err = profiles.Set(ctx, "profile:1", Profile{ID: 1, Name: "Rin"}, cache.WithTags("profile"))
	if err != nil {
		panic(err)
	}

	profile, err := profiles.Get(ctx, "profile:1")
	if err != nil {
		panic(err)
	}
	_ = profile
}
```

## 单次写入 TTL 示例

```go
err := profiles.Set(
	ctx,
	"profile:2",
	Profile{ID: 2, Name: "Lin"},
	cache.WithTTL(30*time.Second),
	cache.WithTags("profile", "active-user"),
)
```

当 `Config.DefaultTTL` 为 0 且 `Set` 未传入 `WithTTL` 时，方法会返回 `cache.ErrInvalidTTL`。

## Tags 失效

```go
if err := profiles.InvalidateTags(ctx, "profile"); err != nil {
	panic(err)
}
```

`InvalidateTags` 通过 Redis tag 索引删除远端 key。调用方只获得成功或保留原始原因链的错误，不暴露 Redis tag member 或内部 key 列表。

本包不提供 `Clear` 或 `FlushAll`。全量清空 Redis 影响范围过大，必须由应用或运维层按明确环境和权限单独处理。

## Redis 连接所有权

`redisstore.New` 接收外部传入的 `redis.UniversalClient`。缓存包不会创建、关闭或重配 Redis 连接；独立使用时由应用入口拥有连接池，Kernel 组合模式则由 Cache App 创建并关闭连接池。

这样做会让 `redisstore` 构造入口接触 go-redis 类型，但第三方类型不会进入业务常用的 `cache.Client[T]` 接口。

## 错误语义

- `ErrNotFound`：远端缓存没有该值。
- `ErrNilContext`：传入了 nil context。
- `ErrEmptyKey`：key 为空或只包含空白字符。
- `ErrInvalidTTL`：写入时没有有效 TTL，或 TTL 为负。
- `ErrNilRemoteStore`：构造 cache client 或 Redis store 时缺少远端存储。
- `ErrInvalidCachedValue`：缓存值序列化或反序列化失败。
- `ErrDisabled`：Kernel 的共享 Cache 后端被明确禁用。

调用方应使用 `errors.Is` 判断上述错误，不依赖错误字符串。

`GetOrLoad` 只有在 `errors.Is(err, ErrNotFound)` 时才调用 loader；取消、disabled、backend 和 codec 错误会直接返回。`GetMany` 只跳过 miss，遇到其它错误时返回此前已命中的 partial result 和错误链。

## 在业务代码中的推荐使用方式

推荐在 composition 完成后通过 `cacheapp.NewClient[T](capabilities.Cache, cfg)` 创建 `cache.Client[T]`，再通过构造函数注入业务组件。typed Client 无需关闭，也不拥有 Kernel 的 Redis 连接。业务组件不要自行创建 Redis client，也不要绕过 `pkg/cache` 直接散写 Redis key、tag 索引或序列化格式。

Cache App 默认 `disabled`。启用 Redis 后，组件 Ready 只校验配置、资源 owner 与 Adapter 已完整建立；`Access.Ping`、普通缓存调用和调度协调调用分别保留真实运行期错误，不在 Generation Prepare 通过一次 Ping 覆盖消费方的恢复策略，也不静默回退内存。底层 App 的独立 Kernel reload 策略仍是 `RestartRequired`，因为 Redis 连接与 scheduler coordination lease 共享同一 owner，当前没有安全的局部 handoff；长期 Service 则在完整 Application Generation 中按 Cache section digest 构造或复用后端。typed Client 没有独立生命周期，不需要进入 generation 终结 journal。

未来若真实业务证明需要 L1，必须先给出 Redis 延迟/成本、目标命中率、内存容量或权重上限、可接受陈旧时间和多实例失效模型，再独立比较 Otter v2 或 ttlcache v3；不得因历史实现存在过 L1 而直接恢复。

同一 Cache Redis resource 还为统一 scheduler 提供项目自有 `pkg/coordination.Manager` Adapter，复用现有 go-redis client、超时和关闭 owner。该 Adapter 不进入业务缓存 API，也不把 token、Redis Client 或释放权暴露给业务模块。
