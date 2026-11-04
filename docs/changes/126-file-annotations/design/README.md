# 设计入口

研究依据[R126-001](../research/R126-001-file-annotations/report.md)。保留标准JSON、NFC、GORM/Huma和现有UI；替换直接Model别名record以隔离持久化表示；业务有界规则合理自研，不新增通用平台。

- [注解与持久化](annotations-and-storage.md)：类型、迁移、CAS、保存/复制边界。
- [界面与查询](presentation-and-query.md)：Host/Surface、属性面板、显示和筛选。
- [实施与验证](implementation-and-verification.md)：文件、任务范围、运行和测试。
