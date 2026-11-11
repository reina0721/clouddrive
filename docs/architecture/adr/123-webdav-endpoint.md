# ADR：WebDAV业务适配与实际端点

状态：采用。支撑R123-001、R123-002。

采用emersion/go-webdav v0.7.0的同步业务后端，用files自有窄边界承载；不将业务对象映射成OS目录，不复制一套上传存储和账号认证。连接独立Basic凭据只能访问选定owner/root，当前IAM权限与连接版本逐次复核。PUT复用持久传输预算、摘要、暂存及CAS发布。协议dispatch位于共同HTTP中间件内，不修改Chi的全局method表，也不伪造OpenAPI自定义方法。

标准扩展x/net/webdav使用文件句柄式契约和非事务默认COPY，与当前租约/原子目录业务不匹配；hacdias为OS文件服务器，SFTPGo引入无当前用例的完整独立系统。所选库的锁与扩展局限显式声明，未来要求这些能力时替换Adapter，不新增永久双轨。

连接地址由HTTP binding返回真实origin与相对路径。默认是实际API请求scheme/Host；HTTPS代理使用显式publicOrigin。Next开发代理只承载管理JSON，不承载完整PUT；不提高整文件内存上限，不额外创建Node网关。代价是分端口开发时WebDAV地址与网页地址不同，生产需要配置可达的HTTPS端点。

验证包括33MiB未知长度写、条件覆盖/CAS交错失败、权限撤回、重启持久、浏览器管理闭环与窄屏。未覆盖Windows/iOS实际挂载、外部S3/数据库及多机，不能据此宣称完整Cloudreve兼容。

## 原始材料定位

本记录从历史任务迁出，决定正文和历史状态不因此更新。完整原文、原研究与验证可用 `git show 0f6efdf5976c1f1f3c806a77138f8cf93f6ee2c3:docs/changes/123-webdav-connections/design/adr-001-protocol-and-endpoint.md` 查阅。
