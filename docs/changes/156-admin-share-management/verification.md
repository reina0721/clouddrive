# 156 验证

- `TestAdminSharesModerateAcrossAccounts` 在隔离 SQLite 和真实 IAM 中通过。覆盖匿名与普通成员拒绝、只读角色、跨账号组合筛选、分页、授权计数、重复 Range、整批冲突、撤销后原票据失效、源文件及重启后的数据保留。
- `go test -p 2 ./...`、文件模块与组合根 `go vet`、前端 738 个单元用例、定向 ESLint 与 Prettier、架构边界、契约和导航生成检查通过。
- 正式 QA 的 `admin-shares.spec.ts` 和 `inventory.spec.ts` 两例通过，人工查看了桌面清单和 320 像素撤销确认截图。成员创建的两条分享可由管理员按源文件筛选并批量撤销，成员仍能找到源文件。全站浏览器套件未整体重跑。
- 主预览与 QA 生产构建通过既有性能预算，CSS gzip 为 49,148 字节。三套预览均先备份再从 SQLite v24 升至 v25，逐列核验原 25 张文件表的数据，随后重启并检查页面和接口。MySQL 和 PostgreSQL 提供迁移脚本及摘要，未使用实库迁移。
