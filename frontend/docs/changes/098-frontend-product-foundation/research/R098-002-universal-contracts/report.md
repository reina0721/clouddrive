# R098-002 Universal 公共契约研究

## 1. 研究问题

确定 Form、i18n、Accessibility 与 Motion 哪些责任可以跨 Product Surface 稳定共享，哪些仍必须留给 Surface、Feature 或 Runtime Host。

## 2. 已核实事实

- 当前两个表单重复创建异步 Zod resolver、RHF Controller、dirty/pending/reset 和错误文案映射，证明存在真实跨页面编排需求。
- RHF 已拥有字段注册、受控字段、dirty、submission 与 focus 管理；Foundation 不应复制完整 RHF API，只应收口项目已经重复的生命周期和错误呈现。
- Zod 是当前 Schema authority；具体 Schema 表达业务输入，因此不能进入 Universal Foundation 的固定字段模型。
- i18next 官方把 resources、supported languages、fallback 和实例初始化分离；Universal 可以拥有 runtime factory、Provider/hook 与 Intl formatter，Surface 仍拥有 locale union、资源和文案。
- R094-003 仍绑定当前 HeroUI/Tailwind 版本且未命中刷新触发器，可继续作为 UI Element 修改基线。
- 现有 Motion 已证明参数、Recipe、Semantic Component 和 Policy 必须分层；Screen direction 与 Shell anchor 是 Admin Surface 语义，不是 Universal Token。

## 3. 推断

- `form-foundation` 应依赖 RHF、resolver、Zod 和 React，对外暴露项目语义 Hook/Provider/Controller；不得暴露 RHF `UseFormReturn`、`ControllerRenderProps` 等 vendor 类型。
- `i18n` 应依赖 i18next/react-i18next，对外暴露 runtime、provider、translation hook 与格式化器；Surface 通过配置注入资源。
- Accordion/Tree/Step、Live Region、Skip Link、Error Summary 属于 Universal Element/Accessibility；Admin Collection/Detail/Settings 属于 Surface Pattern。
- Universal Motion 只提供可复用生命周期 Primitive 与 Reduced Motion Policy；Admin Recipe 与 Next lifecycle bridge 分别落在 Surface 和 Host。

## 4. 对 098 的强制影响

1. RHF/i18next 直接 import 从 Host 清零并由架构门禁限制。
2. 公共 Form/i18n API 只覆盖已证明的通用职责，业务字段、Schema、错误文案和 submit side effect 由调用方提供。
3. 新增 Universal UI Element 必须进入 `/ui-elements`，新增 Motion Primitive 必须进入 `/motion`。
4. 不新增请求、缓存、认证、权限或服务端错误抽象。

## 5. 局限与刷新

React Hook Form 官方站点在当前抓取环境返回 403，因此其行为同时以已安装类型/源码与现有可运行测试复核；实现若需要未被当前 API/类型证明的行为，必须停留在研究而不能猜测。
