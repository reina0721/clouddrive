# R145-001 ZIP 创建流程

## 证据

- 参考站已登录文件区显示空列表及 0 B 使用量，无法通过真实项目选择触发压缩表单。此前观测的后台任务页提供导航、刷新及空态。
- 官方前端固定快照的压缩表单接收已选来源、ZIP 文件名和保存目录，提交后提供任务入口。官方路由将创建压缩任务与解压任务分开。[界面源码](https://github.com/cloudreve/frontend/blob/c7b6fa5288ed0490a5589ddff4f56ea1f96a5315/src/component/FileManager/Dialogs/CreateArchive.tsx) · [工作流路由](https://github.com/cloudreve/Cloudreve/blob/master/routers/router.go)
- 当前 `service/operations.go` 生成有界 ZIP 下载，`service/archive_tasks.go` 与 `repo/archive_tasks.go` 拥有有界领取、对象账本、清理和原子发布。文件写锁在仓储发布事务检查。HTTP 请求生命周期内的下载无法提供持久结果。
- Go 标准库 `archive/zip` 已在项目中运行，BSD 许可，支持 Deflate、CRC 和现行 Go 工具链。创建流程只需要 ZIP。附加归档库或 CLI 会引入依赖、启动、跨平台和升级成本，无法改善所需格式或原子发布。[Go 官方文档](https://pkg.go.dev/archive/zip)

## 推断及边界

保留既有文件作用域、任务调度、数据库及内容客户端。复用现有 ZIP 选集和写入实现，在创建任务上补充归档兼容校验和来源快照。发布阶段复核来源和目标、配额及写锁，避免静默使用更新后的来源。依赖维持现有版本，不引入归档服务、队列产品或外部 ZIP 工具。

v18 的所有行都属于解压，追加明确类型、签名和结果文件标识列。来源队列、账本及任务详情共用原表和接口。只处理账号自己的可见树，目标同名明确失败。参考账号没有记录，任务结果样式依赖本项目实际运行证据。
