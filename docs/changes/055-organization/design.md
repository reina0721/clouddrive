# 055 Organization 组织目录设计

## 1. 边界与模型

```text
Department        Position
    |                 |
AccountDepartment  AccountPosition
          \          /
          stable AccountID -- AccountDirectory port --> IAM adapter
```

Organization 是独立垂直切片，拥有 department、position、assignment Model/Service/Repository、HTTP/WebUI/Migration binding。它不导入 IAM、Auth 或 Navigation。

Department 使用无环树和命名最大深度；Position 使用平面目录。关系使用稳定 pair 行和 Assigned/Primary 语义，避免 hard delete 破坏审计和事务 replace。

## 2. 跨模块契约

Organization 定义：

```go
type AccountDirectory interface {
    RequireAssignableAccount(context.Context, AccountID) error
}
```

composition 提供 IAM Adapter。Port 不返回 IAM Account DTO，只回答 Organization 当前用例所需事实。创建账号与分配组织是两个 API；页面可按顺序调用并明确呈现第二步失败。

## 3. 权限、API 与 WebUI

模块向 053 Catalog 贡献 department/position read/write。HTTP Handler 只消费已认证授权 Principal，拥有自己的 DTO、错误和分页。

WebUI Binding 使用 `organization.*` 与 `webui.organization`，拥有 Departments、Positions，并为 IAM Accounts 页面提供独立组织分配入口或 route；跨模块页面组合只能通过公开 WebUI/HTTP contract，不导入 IAM 页面内部实现。

## 4. Migration 与错误

`organization_schema_migrations` 创建 departments、positions、account_departments、account_positions。是否声明跨 set 数据库 FK 必须以 053 Migration Catalog 和三驱动实际能力为证据；若跨 set FK 会制造迁移顺序/卸载耦合，保存 AccountID 并在 Service port 校验，不虚构数据库级跨 owner 约束。

稳定错误包括 department/position not found、cycle、depth exceeded、referenced、account not assignable 和 optimistic conflict。

## 5. 验证

- Model/Service：树、深度、移动、引用、primary department、多 position、取消/错误链；
- Repository：三驱动 schema、unique、replace、rollback、optimistic/checksum；
- Adapter：不存在/disabled Account、错误映射、模块零互相 import；
- HTTP/WebUI：权限、分页、树、冲突呈现、生成/i18n/style/视觉；
- 反向门禁：无 RolePermission、SecurityRevision、Auth decision 或数据范围实现。
