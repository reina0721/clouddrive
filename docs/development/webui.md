# 前端开发指南

clouddrive 的浏览器入口是 `frontend/` 中完整的 console-web 工作区，使用 Next.js、React、HeroUI 和原有插件、布局及国际化体系。Go 模块中的 `binding/webui` 仅保留后端菜单、模块和权限元数据，不承载浏览器代码。

## 启动与接口

执行根目录 `scripts/Start-Dev.ps1`，前端默认 4173、业务 API 8080、management 9090。Next 同源代理连接 `/api/console/v1`；原生业务接口仍为 `/api/v1`，控制台通过受保护的 `/api/console/v1/native` 转发复用。Cookie 会话与 IAM 权限由后端统一校验。接口错误必须呈现失败状态，不得回退演示数据。

真实功能通过 Surface Port 与 Web Host Adapter 连接。新增页面复用现有组件、插件目录和双语资源；遵守 [前端开发守则](../../frontend/AGENTS.md)。纯 UI 参考页可以保留演示行为；模拟身份只能显式设置 `NEXT_PUBLIC_AUTH_MODE=mock`。

## 生成与检查

Go 原生契约：`go generate ./internal/tools/contract-gen`。前端在工作区运行 `npx --yes pnpm@10.22.0 codegen:plugins`、`codegen:backend` 和 `codegen:contracts`。后端菜单目录从前端插件注册表生成；权限隐藏只影响呈现，不替代服务端授权。

完整前端入口：`npx --yes pnpm@10.22.0 check`，包含类型、单元、架构、插件生成、构建、性能、浏览器、格式和文档检查。真实后端验收由根目录 `scripts/Test-Integration.ps1` 使用独立 SQLite 数据库执行。视觉基线变更按前端守则人工审阅。

## 部署

Next 与 Go 分进程构建和部署，Go 不构建或托管前端静态页面。使用 [部署说明](../operations/clouddrive-deployment.md)，以及 [本地启动指南](../getting-started/webui.md)。
