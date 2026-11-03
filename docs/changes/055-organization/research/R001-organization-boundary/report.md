# R001 Organization 边界与账号引用

## 1. 研究问题

053 R003 已确认部门是无环树、岗位是平面目录，首版组织资料不进入 Auth。R005 又确认 Organization 应从 IAM 分离。本研究补充跨模块账号引用和事务边界。

## 2. 事实与结论

- Department/Position 的树、目录、引用归档与筛选规则独立于 Credential、Role 和 Session；
- Organization 需要确认 Account 可分配，但不需要读取密码、角色、权限或完整 Account DTO；
- 创建账号与组织 assignment 若强制同事务，会让两个模块共享 Repository/Tx 细节；当前没有该不可分割业务不变量；
- 部门数据范围需要资源 department facts 和 Auth decision 扩展，不能由组织目录字段自然推导。

结论：Organization 定义最窄 AccountDirectory port，由 composition 适配 IAM；两个业务操作分开，首版明确不实现数据权限。

2026-08-22 在 054 完成提交 `7b73ea36c88469a97a3c61a1d03df3d62590a2d5` 上复核：IAM 已拥有稳定 Account ID、active/disabled 状态和模块内 Repository；composition 可用仅返回错误的窄 Adapter 回答账号是否可分配，无需暴露 IAM DTO。054 的 Catalog 对账会把 Organization 新增权限补入 system owner，并使旧 owner Session 失效。原结论保持有效。

## 3. 能力与所有权

复用 Database、Clock、ID、Logger、053 Permission/Migration/HTTP/WebUI 契约。Organization 不新增 Kernel Capability、goroutine 或外部系统。schema、API、WebUI 和权限键全部由 Organization 拥有。

## 4. 局限与门禁

跨 set FK 是否合适必须在实现前以三驱动和 migration owner 证据确认；Service port 校验是最低可用一致性。数据范围、多租户、汇报线或 HR 需求会使本研究失效。当前证据足以形成计划，不构成实施授权。
