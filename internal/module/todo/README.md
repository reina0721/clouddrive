# Todo 应用模块

Todo 是本仓库首个真实应用模块，也是一个纵向业务切片。HTTP 与 CLI 共享同一个 Service，数据通过 Kernel 提供的稳定 Database Access 持久化；默认配置使用 SQLite。

## 目录

```text
todo/
├── model/                  # Todo、Status 与不变量
├── service/                # 用例、输入输出、Repository port
├── repo/                   # Record 转换与数据库实现
├── handler/                # 模块顶层 HTTP handler：Operations/Handler、DTO、错误呈现、Actor 端口
├── binding/
│   ├── config/             # todo 配置节
│   ├── cli/                # 显式 actor 的 Application command
│   ├── http/               # Huma typed input/output 与无资源 registration
│   ├── migration/          # 三 driver 最终 000001、checksum、独立版本表
│   └── permission/         # 当前 Todo operation 的精确权限定义
└── module.go               # 局部纯装配
```

HTTP handler 层位于模块顶层 `handler/`：`handler.go` 实现窄 `Operations` 接口、`ActorAccess` 与错误呈现；`dto.go` 定义模块自有 HTTP DTO 与映射。`binding/http` 只负责 Huma typed input/output、operation metadata 与无资源 registration。`internal/tools/contract-gen` 和运行时 composition 消费同一 registration。模块顶层 handler 不创建 Chi Router、不加载 OpenAPI、不 import `binding/**`、`internal/transport/**` 或 Huma；生成类型不进入 model、service 或 repo。

## 业务操作

- 创建 Todo，标题去除首尾空白并受 `todo.titleMaxRunes` 限制，同时写入 actor subject。
- 按 ID 查询真实记录后执行 owner 授权；跨 actor 与不存在对象使用相同 Not Found 语义。
- 按 owner 与状态分页列表，稳定排序并返回总数。
- 读取真实记录并授权后将 `pending` Todo 完成为 `completed`；串行重复完成保持幂等，并发修改由 Version 冲突保护。

HTTP 路由与 CLI 命令的运行方式见根 [README](../../../README.md) 和[首次使用与最小验收](../../../docs/getting-started/first-use.md)。模块边界、配置和 Schema 的当前规则以本 README、[应用模块开发指南](../../../docs/development/application-module-development.md)和[API 文档](../../../api/README.md)为准。

长期 Service 的 Todo Config、Policy、Repository、Service、对象授权 port 与模块顶层 HTTP Handler 都属于不可变 Application Generation。Todo HTTP profile 返回完成的 Service、窄 `Operations` 与 contribution；唯一 composition root 用小 Adapter 连接 Auth Principal 与 Todo-owned `ActorAccess`/对象授权端口，并把运行期依赖交给 Todo Huma registration，再由 `internal/transport/http` 一次绑定契约校验、operation policy 与路由。Todo 贡献 `todos:read/write` Permission Definition 和独立 migration Set；最终首发 schema 只有 000001，使用 `todo_schema_migrations`。所有 Service/CLI 候选只读校验应用 Migration Catalog，只有独立 `db migrate up` 可以执行 SQL。
