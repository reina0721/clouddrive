# clouddrive 前端

这里是 CloudDrive 的 Web 界面与浏览器运行时。文件入口为 `/home`，管理入口为 `/workspace`，访客分享入口为 `/share`。前端与 Go 服务分进程运行，通过同源 `/api/console/v1` 访问既有业务与 IAM；页面不另建一套权限或存储事实。

## 启动与交付

从仓库根目录运行 `node scripts/dev.mjs --prepare`，需要独立真实预览时使用 `--preview`。完整前置、端口、账号准备与排障以[本地开发](../docs/getting-started/local-development.md)为准；已有服务可在本目录使用 `pnpm dev` 开发界面。

生产采用 Next standalone，由部署环境分别管理 Web 与 Go。后端地址在运行时配置，构建时不绑定；API 代理、会话与 WebDAV 的地址边界见[部署说明](../docs/operations/clouddrive-deployment.md)。

## 代码地图

| 范围     | 拥有的职责                                          | 进入位置                                           |
| -------- | --------------------------------------------------- | -------------------------------------------------- |
| 通用基础 | Design Schema、语义控件、表单、状态、语言与基础类型 | [Frontend Foundation](docs/frontend-foundation.md) |
| 产品基础 | 页面结构、Shell、集合、详情、设置、反馈与动效组合   | [Surface Foundation](docs/surface-foundation.md)   |
| 插件装配 | 代码发现、生成目录与稳定 Route Target               | [Plugin Framework](docs/plugin-framework.md)       |
| 产品实现 | `surfaces` 中的业务插件、模型与消费方 Port          | [Surface 约束](surfaces/AGENTS.md)                 |
| Web Host | `apps/web` 中的 Next、HTTP、账号边界与浏览器资源    | [Host 约束](apps/web/AGENTS.md)                    |

依赖从产品与 Host 指向基础能力。Plugin 私有实现不作为 Host 的公共 API；装配经过生成入口，生成物由 codegen 管理。Next App Router 是唯一真实 Router，Plugin Framework 不维护另一套 pathname 或 history。公共契约、依赖与 owner 由 tooling 中的治理清单及检查器共同约束。

Material Design 3 的[视觉规范](docs/ui-visual-calibration.md)、[控件语义](docs/ui-element-system.md)与[动效](docs/motion-foundation.md)适用于业务页和内部示例。页面优先组合现有 Element、Form、State 与 Page Pattern，业务负责数据、权限意图和语言，不复制公共控件或全局视觉规则。

## 文件运行时

Surface 表达浏览、创建、整理、分享与阅读意图；Host 实现文件语义 Port，拥有网络、选择器、拖拽、剪贴板、快捷键与媒体资源。具体功能、预算和限制只在[文件管理手册](../docs/operations/file-management.md)维护。

- FilesRuntime 随认证应用保持稳定；TransferRuntime 按账号拥有增量摘要、tus 和暂停/接续队列，应用内导航不重建传输。账号变化或卸载取消请求并释放资源。
- 每次阅读独立拥有取消与资源生命周期。媒体、PDF、EPUB、Worker、frame 和临时 URL 留在 Host；第三方 SDK、File/Blob 或会话对象不穿越 Surface 的业务契约。
- 私有文件与公开分享使用分别授权的 Port。登录返回地址不携带公开凭据，片段在浏览器中单独保留；公开会话不取得私有 FilesPort。
- 文件视图偏好、跨设备账户偏好、持久任务和服务器版本各有独立 owner；本地显示状态不能被当作已保存的服务端事实。

PDF frame 源码不由 Next HMR 转译；修改后按[PDF 资产说明](apps/web/src/files/pdf/README.md)重新准备。普通 React 页面继续使用现有开发热更新。

## 验证与扩展

日常使用根目录的 `node scripts/verify-changed.mjs --dry-run` 查看影响范围，再按[统一验证策略](../docs/development/validation.md)执行。`pnpm check` 是完整前端入口，具体证据边界见[质量与验证](docs/quality-evidence.md)。冻结依赖准备、真实后端和外部服务前置须分别说明，检查结果不能混称为全部功能已验收。

内部页面提供与业务同源的确定性验证：`/ui-elements/*` 检查控件及浮层，`/page-patterns/*` 和 `/page-archetypes/*` 检查页面组合，`/motion` 检查动效与就绪状态，`/reference-resources/*` 检查路由装配。它们不模拟真实后端的会话、授权或文件事务。

新增路由先读 Plugin Framework；扩展公共能力先读 [Foundation 治理](docs/foundation-extension-governance.md)。公共 exports、owner、authority 页面和验证证据在既有 Contract 清单中维护。普通变化更新所属主题，重要架构决定保留 [ADR](../docs/architecture/adr/README.md)，历史过程通过 Git 查阅。

完整主题导航见[前端工程手册](docs/README.md)，跨前后端的结构见[项目架构](../docs/architecture/README.md)。
