# 设计入口

依据[R141-001](../research/R141-001-write-lock-boundaries/report.md)。保留emersion普通DAV和同步Storage租约，锁业务由files所有、数据库事务执行；无新增运行时依赖、无全局可变状态或新后台循环。

详细设计见[持久锁和协议接入](persistent-write-locks.md)，取舍见[ADR141-001](adr-001-transactional-url-locks.md)。任务状态以[tasks](../tasks.md)为准。
