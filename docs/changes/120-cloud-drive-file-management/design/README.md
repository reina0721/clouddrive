# 设计入口

状态：待确认。依据 [R120-001](../research/R120-001-visual-and-storage-boundary/report.md)提出[文件管理详细设计](file-management.md)。

关键决策：保留 IAM、数据库、Storage 租约和前端 Surface/Host；新增 files 业务模块与 files 插件；先实现有界私有文件，不新增第三方依赖、不引入第二套认证或后台运行时。

新模块和接口属于提案，只有确认后实施。唯一执行清单为 [tasks.md](../tasks.md)。
