# R149-001 回收站保留

Cloudreve User 组设置在功能区展示秒数 604800，说明变更只影响今后回收的文件。截图保存于项目临时目录 `.data/149-reference-trash-retention.jpg`。参考账号仅用于观察。[Cloudreve 文件概念](https://docs.cloudreve.org/en/usage/concept)

当前 files v19 的回收状态来自 `TrashedAt`。变更集中通过 `repo.Repository.saveEntryChanges` 写入，包含网页及 WebDAV；148 的 `RemoveTrash` 持有 storage/owner 事务，移除目录、历史和关联固定项，保留物理对象。已有下载、归档任务使用 `pkg/schedule`。历史 R148-001 仍适用于手动路径与对象边界。

推断：在统一状态转换点持久化期限，可防止修改设置追溯改变条目。项目尚无用于文件保留的组策略，账号主动开启并且默认手动可保护既有数据。外部调度器和新对象回收机制没有本批所需能力缺口。大目录受已有完整树预算限制，不能安全截断；超过预算时延迟重试并由服务日志记录。任一刷新条件命中时重新确认受影响边界。
