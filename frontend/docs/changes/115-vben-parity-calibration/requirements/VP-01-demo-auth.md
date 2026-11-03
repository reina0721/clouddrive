# VP-01 显式 Mock 演示与快捷角色登录

原 Task 114。状态：未实施；D-01 待决策。

## 已具备与检查入口

复用 [认证契约](../../../../apps/web/src/auth/README.md)、[auth-form](../../../../apps/web/src/auth/auth-form.tsx)、[mock-adapter](../../../../apps/web/src/auth/mock-adapter.ts)、[mock-database](../../../../apps/web/src/identity/mock-database.ts) 与 EnvironmentNotice。现有三个角色和 24 个目录用户不意味着三套预设凭证都存在；固定 Demo 账号与注册账号的登录路径须分别核对。

## 候选增量与执行步骤

1. 若用户选择快捷角色体验，先确认显式 Mock 模式、保留 administrator/operator/viewer IDs，定义可登录账号如何初始化、旧记录如何兼容。角色展示元数据和凭证初始化分开，密码不进入 Surface 公共模型或持久化明文。
2. 在 Host 认证 composition 提供快捷填充，复用现有表单及模式说明；不让表单业务自行判断运行模式，不绕过统一登录、账户边界和会话恢复。
3. 重置是独立子项：列出账户、会话和业务记录影响范围，确认后经 Host 原有写队列处理；不得在网络失败、损坏或不兼容存储时静默清空。
4. 滑块单独待决策。先说明用途和非拖拽/键盘替代，不把客户端滑块当安全验证；若真需公共 Element，先选已安装 HeroUI primitive 并走公共门禁，不直接规定 Pointer Events 自研交互。

## 排除与风险

不增加 auto-fallback，不把 Backend 401/403/超时/502 等转换为模拟登录；不因为演示站报 upstream error 就断言 API 客户端是根因。前端文档/脚本不可达属于部署排查，需独立证据和另行任务。真实 Backend 尚待联调的边界保持。

## 后续验收（尚未执行）

- [ ] 显式 Mock 才有获选的快捷入口；Backend 失败仍保持原错误语义，受保护子树不泄漏。
- [ ] 每个获选预设可通过真实登录入口完成登录；切换身份清除前账户私有状态；不能只测填表。
- [ ] 旧 v5 及既有迁移、坏记录、存储不可用、账户/会话失效、重置取消与重试按选定范围覆盖。
- [ ] 认证 mock/backend 既有回归、键盘、中文/英文及本任务 UI 状态完成验证；公共 Element 另走完整扩展门禁。

本任务完成还须执行 [公共能力与质量门禁](../design/README.md) 和 [执行协议](../design/execution-protocol.md)；上列清单不替代完整 pnpm check。
