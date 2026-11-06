# 可空对象与身份一致读取的定向复核

## 问题、证据与事实

本次集中验证出现两个实现问题：原生HTTP的显式null被Huma对象引用校验拒绝；上传最终发布事务内，IAM目录读取又开启写事务，SQLite等待锁后失败。原目标、公开接口、依赖选择和模块边界均未改变。

已安装的Huma v2.39.1官方schema.go对nullable对象有限制，并提供SchemaProvider扩展点（schema_test.go包含示例）。普通指针对象不足以表达本任务的严格对象或null。不能通过跳过请求校验、放宽为任意JSON或修改生成SDK处理。

IAM只需当前可用账号及有效角色，不需要写锁。collaboration.go以单次只读SELECT JOIN得到同一语句快照；只投影必需字段，最多1000条角色关联，超出上限拒绝而非截断。最终发布仍复核身份，但不承诺跨IAM和文件事务原子撤销。

## 结论与边界

保留Huma与encoding/json。在humabinding加入窄类型Nullable[T]，通过SchemaProvider生成AnyOf：严格对象引用，或仅允许null的枚举分支；Marshal/Unmarshal保持原本显式null语义。只在HTTP绑定投影使用，不把框架类型引入service或model。没有新增依赖、全局开关或第二套客户端。

IAM目录保留原公开窄facet，由IAM repo实现只读查询，不让files读取IAM表。账号/角色停用、归档、锁定及必须改密仍由现有语义检查。数据库错误完整返回，不能降级匿名。

## 验证与局限

`.data/135-go-focused-green.log`记录humabinding严格对象/null用例和composition真实SQLite迁移、HTTP权限及tus上传撤销用例通过。全量检查与浏览器验收另记tasks，不能据此宣称批次已交付。刷新触发器见metadata；Huma升级或IAM结构改变时定向复核，不重新展开整个方案研究。

最终边界审查补充：composition/iam.go将IAM会话派生的MustChangePassword映射为auth.Principal.Restricted；口令到期可能只派生该限制，不能只看账号持久标记。公开分享的ShareViewer在读取目录前拒绝Restricted主体，保留既有自助改密边界。`.data/135-restricted-red.log`先证明缺少守卫时失败，修复后的完整回归另记verification。这是既有身份限制的补齐，不增加认证来源或权限模型。
