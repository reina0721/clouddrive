# 157 验证

- `TestAdminTasksRetainPublishedFiles` 通过真实 SQLite、IAM、HTTP 和后台调度验证。覆盖跨账号过滤、截止日期预览、只读权限、旧快照拒绝、逐项结果、来源凭据隔离，以及 ZIP 和 HTTP 任务清理后仍能访问其发布文件。
- `go test -p 2 ./...`、定向 `go vet`、前端 738 个单元用例、变更文件 ESLint 与 Prettier、架构及生成检查通过。
- 正式 QA 的 `admin-tasks.spec.ts` 和 `admin-shares.spec.ts` 两例通过。日期控件可提交 UTC 截止日期，空预览禁用确认。320 像素窗口可筛选并清理终态 ZIP，个人文件页仍可找到发布文件。人工查看桌面与窄屏截图。本批未整体重跑全站浏览器套件。
- 主预览与 QA 生产构建通过性能预算。三套预览均已重启并验证页面及接口，备份对照核验 SQLite v25 及原有 25 张文件表。此次没有数据迁移。
