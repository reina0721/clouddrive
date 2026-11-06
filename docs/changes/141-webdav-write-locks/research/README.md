# 研究入口

检索既有metadata后，复用R123的同步内容租约与原子操作证据；锁需求命中其明确退出条件，定向复核而非重做全仓研究。

[R141-001](R141-001-write-lock-boundaries/report.md)比较标准库、现有emersion、x/net及go-filesystems，记录参考视觉、URL规范和跨入口事务事实。[metadata](R141-001-write-lock-boundaries/metadata.yaml)提供快照、检索字段和刷新条件。结论为保留普通DAV、合理实现项目业务锁；不声称参考部署的实际锁请求已验证。
