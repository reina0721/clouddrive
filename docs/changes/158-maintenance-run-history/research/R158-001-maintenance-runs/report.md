# R158-001 文件维护运行历史

只读查看参考站「管理面板 → 后台任务」。实际列表显示连续的「定时扫描回收文件 Blob」已完成记录，创建者与处理节点无值。[上游任务响应](https://raw.githubusercontent.com/cloudreve/frontend/master/src/api/dashboard.ts)提供执行时间和结果字段。

本项目通过 `internal/module/files/module.go` 注册 Blob 和回收站两个固定间隔任务。`pkg/schedule/diagnostics.go` 提供当前进程的最近执行和计数。归档和下载记录与调度器无关，已有真实任务仓储和独立管理权限。Blob 自动回收默认关闭，空扫描返回成功，清理对象和历史清理属于不同操作。

维护运行历史是文件业务数据。继续使用已有 gocron、文件仓储和 IAM，在两个维护绑定收束执行结果。无需引入通用调度审计库或改变平台调度边界。历史在回调返回后提交，进程强制中断时没有终态，无法重建过去的记录。
