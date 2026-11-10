# Console 控制台协议

本模块发布 console-web 使用的 `/api/console/v1` 投影，不维护第二套身份或权限。IAM、Todo 和 Navigation 的使用方接口由 composition 显式注入，模块之间不互相导入。

- `module.go` 选择本模块仓库实现并连接窄端口；不拥有共享数据库关闭权。
- `binding/http` 负责请求校验、Origin/CSRF、会话协议、精确权限检查和前端数据形式。
- `model` 保存字典、通知、工作区、任务与查询值类型。
- `repo` 在数据库租约内使用 GORM；表与 SQL 不进入 HTTP 使用方。
- `adapter/trigger` 只封装 cron 日期计算，调度执行权交给现有 Schedule/Execution 生命周期。
- `binding/migration` 维护 SQLite、MySQL 和 PostgreSQL 迁移。

原生接口经 `/native` 转发时重新开始路由匹配，并继续执行原生授权与 mutation guard。管理配置只暴露明确许可的非敏感字段，不能返回完整配置或凭据。

站点信息独立于部署及注册策略。公开读取只提供呈现字段，管理写入需要现有系统配置权限、请求来源和 CSRF 校验，并使用修订号防止覆盖。修改记录只含操作类型与结果。

通知与工作区、历史、定时任务按账号隔离；工作区和任务使用版本条件写入。API relay 检查目标、DNS、重定向、请求头、取消、超时及大小预算，不执行任意 JavaScript，不提供虚假的代理或 TLS 指纹结果。

接口文档见根目录 `api/console-openapi.json`；跨模块真实 SQLite/HTTP 验收见 `internal/composition/console_e2e_test.go`；真实浏览器验收见 `frontend/integration/console.spec.ts`。
