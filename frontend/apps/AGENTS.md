# Runtime Host 开发约束

- `web/` 与 `desktop/` 是产品端，不是共享架构层。它们拥有入口、Shell、路由或窗口结构，以及平台集成。
- Host 可以依赖 `packages/*` 的公开契约；任何公共包都不得反向依赖 `apps/*`。
- 浏览器 API 只能出现在 Web Host 或明确的 Browser Adapter；Desktop Runtime API 只能出现在 Desktop Host。
- 发现 Web 与 Desktop 的重复能力时，先提取稳定语义或纯规则；不得把两个 Runtime 的最低公分母伪装成 Core。
- Host 入口负责装配、Error Boundary、可观测边界和资源生命周期，不承载可复用业务规则。
- Desktop Runtime 尚未选型。未形成真实用例、资源所有权和退出条件前，不得引入 Electron、Tauri 或兼容 Wrapper。
