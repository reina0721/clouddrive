# 技术设计

依据R124-001及F81–F100，保留GORM/Huma/IAM/Storage与公开分享实现；新增业务shortcut类型及owner导航，不增加第三方依赖、后台运行单元或通用Kernel能力。

- [引用及权限边界](shortcut-authority.md)
- [持久导航与事务](navigation-transactions.md)
- [界面、迁移与验证](host-and-verification.md)

状态：当前goal明确授权自主实施，研究门禁通过后直接执行任务ID，不增加中途审批。新事实推翻分享/文件边界时先定向更新研究与计划。
