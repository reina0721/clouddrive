# 设计摘要

支撑R135-001；保留IAM Core RBAC与Sharing及Transfer事务。新增有限业务策略及IAM窄事实facet，不引入授权框架、Kernel组件或平行文件入口。

定向验证补充[R135-002](../research/R135-002-nullable-and-identity-read/report.md)：HTTP显式null采用Huma公开SchemaProvider的严格绑定投影；IAM当前身份使用单次只读JOIN，避免在最终发布事务中嵌套写事务。

- [策略与身份](policy-and-identity.md)：优先级、继承与装配。
- [路径与持久化](enforcement-and-storage.md)：全部读写路径、迁移及资源。
- [界面与验证](interface-and-validation.md)：用户流程、文件影响和集中验证。

状态已按当前goal直接授权进入实施；只执行tasks中的I135/F281–F300及验证交付。若公共范围、身份来源或事务前提改变，定向刷新研究；普通实现细节不逐项询问。
