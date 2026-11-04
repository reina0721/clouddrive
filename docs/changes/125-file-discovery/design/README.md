# 设计入口

研究依据：[R125-001](../research/R125-001-file-discovery/report.md)。采用“保留GORM/标准库、替换List的无界加载、合理自研业务条件及选择状态”的单轨方案；不升级依赖，不加入FTS/worker或迁移。

- [有界检索](bounded-query.md)：服务、仓储、条件和分页。
- [视图与选择](view-and-selection.md)：Surface/Host、偏好、键盘、URL及视觉。
- [实施与验证](implementation-and-verification.md)：文件影响、基线、集中验收和交付。
- [Host加载](host-boot.md)：R125-002性能门禁触发的文件运行域装配修正。
