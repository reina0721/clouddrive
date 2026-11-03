# R004 分级显式装配与根 composition 瘦身

## 1. 当前问题

`generation.go` 当前在同一段流程中直接完成：

- 解码 Auth/IAM/HTTP 配置；
- 适配 Database；
- 构造 IAM HTTPModule；
- 从 IAM `Service` 创建 Organization AccountDirectory、SessionSource 与 MutationGuard；
- 构造 Auth Module；
- 从 Auth `Service` 创建 Todo Authorizer 与 HTTP OperationGate；
- 继续构造 Organization、Navigation 和其它 runtime module。

这些依赖都是显式的，方向正确，但根 Generation 同时知道“资源生命周期、模块选择、模块内部 Service、跨模块 Adapter 和 HTTP policy glue”，认知负担已经过大。058 如果再把 Casbin Factory、PolicySource、snapshot builder、revision refresher 和 evaluator publisher逐项传入根层，会继续扩大问题。

当前 `iam/module.go` 与 `auth/module.go` 已经是局部 composition root：IAM 在内部选择 password Adapter、Repository 与 Service，Auth 在内部选择 audit/JWT Adapter、middleware 与 Service。这条 owner 方向应继续，而不是把 Casbin 反向提升到根 composition。

## 2. 瘦身目标不是消灭 composition

根 composition 必须继续显式决定：

- 哪些模块进入应用；
- 哪些跨模块 port 相连；
- 哪些 runtime object 属于当前 Generation；
- listener、participant、resource lease 的启动/停止顺序。

需要移走的是模块内部机械构造，而不是依赖 authority。把所有参数塞进 `ApplicationContext`、万能 `Contribution`、全局 Registry 或自动扫描，只会把可见复杂度变成隐藏复杂度。

## 3. 三级显式装配

### 3.1 根 Generation composition

根层只做阶段编排：

```text
decode owned config / acquire resources
  -> compose identity-access slice
  -> compose business modules
  -> aggregate contributions/routes
  -> Prepare/Commit/Retire Generation
```

根层不 import `iam/adapter/casbin`，不接收 `EvaluatorFactory`、`PolicySource`、revision store 或 refresh strategy。

### 3.2 identity-access 子装配

`internal/composition/identity_access.go` 是有边界的应用切片装配器，只负责：

- 调用 IAM module-local Builder；
- 把 IAM Session facet 适配为 Auth SessionSource；
- 把 IAM Authorization facet 适配为 Auth DecisionPoint；
- 构造 Auth Module；
- 形成 OperationGate 与 MutationGuard；
- 返回根层真实需要的 typed 完成品。

它不构造数据库、监听器、Organization、Navigation、Todo 或通用模块 Registry。

### 3.3 模块局部 composition

IAM `module.go` 负责：

```text
Database Access
  -> Repository/Unit
  -> Password Adapter
  -> PolicySnapshot/Revision Repository
  -> Casbin Adapter
  -> AuthorizationRuntime
  -> IAM Service/Handler
```

Auth `module.go` 继续负责 JWT、audit、middleware 与 Auth Service。第三方专属实现留在 owner 模块；根层只传平台资源、配置与静态 Catalog。

## 4. 窄输出 facet

IAM 当前 `Module.Service *service.Service` 让 composition 可以访问全部方法。目标完成品改为暴露真实跨边界能力：

```go
type Module struct {
    Sessions      SessionResolver
    Authorization Authorization
    Accounts      AccountDirectory
    Contribution  module.Contribution
}

type HTTPModule struct {
    Module
    Handler       *httpbinding.Handler
    MutationGuard MutationGuard
}
```

Handler 可以在 IAM 内部继续使用完整 Service，但根 composition 不取得 Service。每个 facet 使用项目自有窄接口，第三方和 Repository 类型不泄漏。

Auth Module 同样优先输出 Service 所需的 authorizer/authenticator facet；是否完全隐藏 Auth Service 必须以当前 Todo、operation gate 和 management 的真实调用方迁移为准，不在 058 制造无价值接口。

## 5. 根层目标代码

根 `generation.go` 的身份访问装配目标近似：

```go
identity, err := composeIdentityAccess(ctx, identityAccessInput{
    Database: databaseAccess,
    Logger: generation.logger.value(),
    IAMConfig: iamConfig,
    AuthConfig: authConfig,
    Blueprint: generation.blueprint,
    AllowedOrigins: httpConfig.CORS.AllowedOrigins,
})
if err != nil {
    return abort(err)
}

generation.iamModule = identity.IAM
generation.authModule = identity.Auth
operationGate := identity.OperationGate
mutationGuard := identity.MutationGuard
```

`identityAccessInput` 是该切片的 typed 输入，不得扩展成全应用依赖包；字段只能由该切片真实消费。重复的错误包装和 build/abort 模板可以由 helper 收敛，但模块连接仍在代码中可见。

## 6. 约束与验证

瘦身后必须满足：

- 根 composition 无 Casbin import；
- IAM module-local composition 是 Casbin 实现的唯一选择点；
- identity-access 只 import IAM/Auth 及其项目 port，不 import业务模块；
- IAM/Auth 不互相 import；
- 根层不读取 `iam.Service`；
- 没有 `map[string]any`、反射 Resolve、`init` 注册、目录扫描或万能依赖对象；
- architecture test 冻结三级依赖方向和禁止的第三方泄漏。

## 7. 对 058 的影响

`RBAC-058-005` 不再只是增加一个 composition adapter，而是同时建立 identity-access 子装配、IAM 窄输出 facet 和根 Generation 瘦身。该重构只覆盖当前 IAM/Auth authorization 接入的真实范围，不借机重写 Organization、Navigation 或全部模块装配。

