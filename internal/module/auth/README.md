# Auth 模块

Auth 是应用组合根选择的横切认证、授权与审计模块。它通过项目自有认证来源、port、middleware 和 `Contribution` 为 HTTP 与业务模块提供认证上下文；本地身份、凭据与 Session 由 IAM 拥有，第三方 JWT 实现不得泄漏到调用方。

## 当前职责

- 提供 Bearer `RequestAuthenticator`、`Authorizer`、`Audit`、`CredentialVerifier` 和消费方 `DecisionPoint` port 等通用契约。
- `Principal` 显式区分 `AuthorizationSource`：`token-scopes`（Bearer/JWT、CLI/development，精确 Scope 直判）与 `iam-rbac`（Scopes 必须为空、revision 非零，必须经注入的 `DecisionPoint` 判断）；两来源构造互斥，未知来源 fail closed。
- 在明确的 composition 位置装配 JWT/开发认证策略，执行 operation policy、授权结果和低敏审计；只有 Auth decision 边界记录一次低敏结果。
- JWT/JWK Adapter 使用 `jwx/v3` 完成标准解析与签名校验；项目边界负责 issuer/audience/algorithm/claim、受控 JWKS 网络访问和 lifecycle。未知 `kid` 的并发刷新全局合并，请求取消与刷新超时保持可识别，不改写成普通无效凭据。
- composition 的 identity-access 子装配把 IAM `Authorization` facet 适配为 Auth `DecisionPoint`、把 IAM Session 适配为 `iam-rbac` Principal 并交给统一 operation gate；Auth 不拥有 IAM Repository、密码哈希、Session 表、HTTP 页面、CLI 或 Casbin。

## 变更入口

新增认证方式、凭据字段、会话策略或安全配置前，先阅读[应用模块开发指南](../../../docs/development/application-module-development.md)、[安全响应](../../../docs/operations/security.md)和[文档治理规范](../../../docs/development/documentation-governance.md)，确认 owner、敏感字段、错误语义、生命周期和验证范围。

## 验证边界

认证相关行为需要同时检查 Go 测试、低敏日志和实际配置语义；不能用公开 API 能启动或 WebUI 页面可打开代替授权、过期、失败锁定和审计验证。
