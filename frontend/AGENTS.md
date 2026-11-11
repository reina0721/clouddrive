# 前端协作规则

本目录承载 CloudDrive 的产品界面与 Web Host。当前架构见 [README](README.md)，主题规范见[工程手册](docs/README.md)；根 [AGENTS](../AGENTS.md) 同时适用。

## 1. 分层

Universal Foundation 拥有稳定语义；Surface Foundation 提供产品页面与状态组合；`surfaces` 拥有业务模型、Port 与插件；`apps/web` 拥有 Next、浏览器 I/O、会话与资源生命周期。具体边界由子目录 AGENTS、公开 exports 和治理检查器共同约束。

## 2. 路由与生成

Next App Router 是唯一真实 Router。Plugin Framework 负责代码发现、装配与稳定引用，不实现第二套 history。新增路由或导航先读 [Plugin Framework](docs/plugin-framework.md)；修改输入后运行对应 codegen 并检查 freshness，不手改生成物。

## 3. 浏览器边界

Plugin 不导入 Host 私有实现，不持有会话、网络客户端、File/Blob、Worker 或临时 URL。Host 经消费方 Port 注入能力，资源按账号、应用或独立阅读会话拥有，关闭和账号变化须取消、等待并释放。

## 4. 视觉与动效

统一使用 [Material Design 3](docs/ui-visual-calibration.md)、语义 Token 与现有 Adapter。页面顶层组合 `Page`、`PageHeader`、`Section`、`Toolbar` 等既有结构；避免局部 CSS、任意视觉值、重复 Card 外壳或第二套状态与动效语言。公共控件与内部示例同源，视觉变更须实际查看窄屏、主题、焦点和浮层。

## 5. 成熟交互基础

仅 UI Adapter 直接依赖 HeroUI；表单与语言运行分别经过 Form Foundation 和 i18n。保留成熟控件的键盘、Popup、Overlay 与 ARIA 语义，不以自制浮层或原生简化控件绕开既有契约。

## 6. 状态与数据

应用 Store 通过 State Foundation 创建，持久化显式选择且保持账号隔离。服务端事实、请求失败、空结果与本地编辑态分别表达；过期响应不能覆盖新的意图，失败不能伪装为空结果或已保存。

## 7. i18n 与产品状态

业务文案属于其 Plugin，Shell 文案属于 Host，跨业务词归 Surface shared namespace。中英文同步，用户内容不翻译；复用当前 loading/error/empty/feedback Pattern，保留可理解的下一步。格式化与时区沿用项目语言和区域能力。

## 8. 公共接口

第三方具体类型不穿越稳定业务边界。Surface 对 Host 只开放正式 exports 和生成入口，`plugins/*` 为私有实现。类型、Schema 与运行时校验各归既有 owner，不用 `any`、反射或跨目录导入绕过约束。

## 9. Foundation 扩展

先判断问题属于 Element、Variant、Composition、Pattern 还是业务组件，再按 [Foundation 治理](docs/foundation-extension-governance.md)扩展。公共能力有真实使用方、统一说明、同源示例和相应验证；单页差异留在业务组合中，不污染全局默认值。

## 10. 验证与文档

遵循[统一验证策略](../docs/development/validation.md)。公共能力、构建或契约变化扩大范围；普通交互使用相关浏览器用例并保留截图。不得提高阈值、跳过失败断言或批量接受视觉基线。产物通过 `testInfo.outputPath()` 写入忽略目录，当前说明写入主题手册，历史由 Git 保存。
