# 054 IAM 身份与访问管理模块

状态：已完成。研究已按 053 完成提交刷新，用户已确认并完成 `IAM-054-001..009`；055、056 仍按各自计划独立实施。

## 目标

新增 `iam` 业务模块，单轨接管当前 Auth 本地账号、密码和 Session，并实现 Account、Credential、Session、Role、Permission、AccountRole、RolePermission 与 system `owner` 不变量，产出初始化/登录、账号安全、用户、角色和权限管理 API/WebUI。

Organization 与 Navigation 分别属于 055、056；IAM 不拥有 Department、Position 或 MenuPolicy。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求规格](requirements.md)
3. [设计方案](design.md)
4. [任务与确认状态](tasks.md)

## 实施门禁

053 已完成，用户已在本计划报告后明确确认 054，现可实施 `IAM-054-001..009`。加入外部 IAM、MFA、多租户、角色继承、数据权限或改变 Auth/IAM owner 时必须重新研究确认。
