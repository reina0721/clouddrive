# VP-05 权限呈现与系统管理增量

原 Task 118。状态：未实施；D-05 待决策。

## 已具备与检查入口

[permissionCodes](../../../../surfaces/src/identity/constants.ts) 为点分有限集合；[useProductAccess](../../../../surfaces/src/identity/use-access.ts) 已有权限查询；[users](../../../../surfaces/plugins/users/src/users-page.tsx) 已按权限门控操作；[role-editor](../../../../surfaces/plugins/roles/src/role-editor-page.tsx) 可编辑权限并检查越权赋权；[permissions-page](../../../../surfaces/plugins/roles/src/permissions-page.tsx) 已展示角色与权限关系。

## 可拆分增量与执行顺序

1. VP-05A：评估现有呈现判断是否真的重复到需要 AccessGuard；若需要，留在 Surface identity 并复用同一 access 数据，不新建 Provider/Store/权限码体系。先定义 all/any、loading/error 默认拒绝、hide/disable 和可访问禁用原因；不能通用 clone children 盲传 disabled。
2. 两个真实消费者验证该呈现组合，权限刷新与身份切换时不短暂放行；原服务授权继续执行。现有角色编辑只补所选缺口，不以“尚无 RBAC”重写。
3. VP-05B：菜单、部门、字典分别形成业务子任务。先定义实体/Schema、身份与操作权限、读写 Port、版本冲突/审计、Mock 持久化迁移、Backend 未联调边界，再创建标准 Plugin routes/navigation。
4. 菜单管理先说明编辑的是业务配置还是部署期 Registry；静态 Plugin 发现/生成仍由 codegen 管，不让前端树形编辑器直接改变路由授权或维护另一套 Router。
5. 若新系统模块确需树形表格，依赖 VP-04D 的语义评估；若已有 Tree 可合理组合，则不为依赖关系强建新基础能力。

## 排除与风险

不将 users.update 改为 users:edit，不虚构现有服务未支持的删除/导出权限，不把角色沙盒改动当当前用户授权。新业务 Backend 仍须服务器授权；Mock 成功不证明真实服务已接入。

## 后续验收（尚未执行）

- [ ] 获选呈现组合覆盖有权/无权/加载/错误/角色变化，两个真实消费者同源；Backend 403 不被前端覆盖。
- [ ] 角色更新保留点分码、版本冲突、保护角色和不能越权赋权约束。
- [ ] 获选系统模块有完整数据和失败恢复路径；Mock CRUD 与 Backend 契约证据分开，无占位路由或空操作。
- [ ] 插件 ADD/REMOVE、codegen freshness、导航可见性与深链权限均回归；原用户/角色/注册策略不退化。

本任务完成还须执行 [公共能力与质量门禁](../design/README.md) 和 [执行协议](../design/execution-protocol.md)；上列清单不替代完整 pnpm check。
