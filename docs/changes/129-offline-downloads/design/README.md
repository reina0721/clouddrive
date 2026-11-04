# 设计入口

依据R129-001；20项使用当前goal直接实施授权。保留成熟标准库、tusd、GORM和Scheduler，新增files业务任务与窄出站Adapter；不新建通用队列。

- [任务、传输和迁移](durable-task-and-transfer.md)
- [公网源与强校验续传](http-source-and-resume.md)
- [生命周期与装配](scheduler-and-composition.md)
- [界面、接口及集中验证](ui-api-and-validation.md)
