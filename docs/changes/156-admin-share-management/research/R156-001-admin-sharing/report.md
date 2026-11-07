# R156-001 管理分享的差距与实现边界

在用户提供的 Cloudreve 参考站打开「管理面板 → 分享」。界面有刷新、过滤、表头选择、ID、源文件、浏览、下载、积分、自动过期、分享者和分享时间。过滤浮层有用户 ID 和文件 ID。该实例无分享记录，未创建或更改参考站数据，行操作及积分规则未现场验证。[上游响应定义](https://raw.githubusercontent.com/cloudreve/frontend/master/src/api/dashboard.ts)另证实分享清单存在浏览、下载及到期字段。

项目现有 `share_management.go` 对本人分享分页。`files_shares` 持久化权限、凭据、撤销时间和版本，目前缺少管理清单与累计计数。公开下载凭据在 `repo/shares.go` 签发，随后每个 Range 请求复核分享版本与撤销状态。`service.Sharing.Metadata` 完成密码和受众检查后返回可见根信息。现有管理清单与 IAM 授权分别在 `binding/http/inventory.go` 和 `composition/files.go`。

保留 GORM、数据库、现有文件模块、锁顺序、IAM 和 UI Adapter。聚合 SQL 和并发撤销是项目业务规则，使用现有数据库表达，不引入统计服务、消息系统或外部依赖。计数依据授权浏览与已签发下载票据，已有历史无法恢复。既有公开传输不依赖新管理权限。

独立核对了参考站的存储策略卡片。当前项目把全部对象绑定到单个预设的存储身份。多供应商策略需要设计已有对象的持久路由、凭据和迁移，不属于本清单的实现。[Cloudreve 存储策略概念](https://docs.cloudreve.org/zh/usage/concept)
