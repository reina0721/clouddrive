# 本地验证记录

日期：2026-11-03。源提交完整编号见根目录 [SOURCES.json](../../../SOURCES.json)。仅执行本地整合，未提交、推送或部署。

## 已验证

| 检查 | 结果与范围 |
| --- | --- |
| 来源与目录 | 两个来源分支核对无漂移；源码快照导入，当前 origin 保留；无嵌套 Git。Go 根目录及 console-web 完整包、插件工作区保留于 frontend/。旧后端前端及 Go 静态托管退出运行链。 |
| Go | 完整 Verify-Quality.ps1 通过：格式、tidy、布局、生成、全量测试、全量 race、vet、CGO-free build、产物检查。随后审计 GET 修复另行通过针对性测试和 race。C 编译器使用用户目录下独立 w64devkit；未修改全局版本。 |
| SQLite 空库 | 全部六个迁移集成功：auth 2、console 1、iam 13、navigation 2、organization 3、todo 1。首次管理员、Cookie 会话、资料、偏好、字典与任务持久化均验证。三方言迁移文件及校验和保留。 |
| 真实服务集成 | TestConsoleSQLiteDataIsolationAndRestart 覆盖原生转发、部门读写、Token 创建/更新/禁用/轮换与冲突、最后管理员保护、公开注册、权限拒绝、资料及偏好冲突、通知与工作区跨用户隔离、MFA/TOTP 与一次性恢复码、改密限制、撤销其它会话、两步注销及注销后拒绝登录。 |
| 重启与调度 | 同一 SQLite 数据库重启后，原会话、字典、偏好和任务恢复；任务实际请求本地测试服务；暂停、删除、过期版本拒绝通过。任务执行重新检查账号及权限。 |
| 请求安全 | 真实 HTTP 测试覆盖目标白名单、私网/元数据与重定向拒绝、响应大小限制、超时及取消。默认响应体 2MiB、请求体 1MiB、最长 30 秒。代理及 TLS 指纹明确不支持；服务端任务拒绝任意脚本/提取器。 |
| 并发 | SQLite 读后写并发测试 8 个执行者共 96 次提交；控制台集成重复执行通过。使用 immediate 事务避免登录与后台任务写入之间的快照冲突。 |
| 前端单元 | 全工作区单元测试通过；新增原生审计数字 ID 回归后 Surface 21 文件、177 测试通过，Web Host 34 文件、192 测试通过，其它工作区维持通过。 |
| 前端工程 | 类型检查、零告警 lint、Foundation、边界、依赖治理、插件/后端菜单/设计资源/契约生成、格式及文档检查通过。Surface 新运行时出口同步 Contract registry。 |
| 生产构建与预算 | Next 构建通过。原阈值未变：首屏 gzip JS 409568 / 409600 字节，最大路由 433160 / 445440，CSS 48736 / 49152。余量很小，后续变更须继续复核。管理适配器、校验及业务消息按需载入；导航所需标题保持静态可解析。 |
| 真实浏览器 | Test-Integration.ps1 使用独立空数据库和 8088/9098/4185 端口，最终 1/1 通过（29.1 秒）。覆盖首次设置、用户目录、待办写入与刷新恢复、部门创建、真实 API 工作区执行与历史恢复、菜单/字典/分析/MFA/Token/运维与审计读取、退出后 401；无模拟数据回退。 |
| Windows 生命周期 | 默认配置启动、迁移、4173 首次设置页返回 200；Stop-Dev.ps1 精确验证进程启动时间并结束进程树，三个端口全部释放。默认开发库没有导入测试账户。 |

## 尚未通过与未执行

- 来源浏览器套件共 423 项，首次 386 通过、37 失败。修复端口、截图路径、真实模式与模拟模式的导航区分、延迟校验分包及新增路由的测试时限后，逐轮复测为 22/37、11/15、2/4 通过，最终剩余两个截图测试未通过。对应 421 项功能测试已分别通过；未把分轮结果称作一次完整全绿运行。
- 两个截图测试产生三组差异：320px 登录、320px 注册、英文暗色大字号注册。品牌、密码规则及首次设置入口改变了文字及布局。[实际图和差异图](evidence/visual-review/README.md) 已保留。按 frontend/AGENTS.md，视觉基线必须人工确认后才能更新。本次未更新原基线，T08 保持未完成。
- Docker 镜像及线上反向代理未运行；MySQL/PostgreSQL 外部实例未连接，不能以 SQLite 测试替代。Redis、RabbitMQ 等可选外部能力的专项环境验收未执行。

## 本机证据与来源产物

完整命令输出在被忽略的 .data/：quality-final.log、race-final.log、audit-race-final.log、console-final.log、unit-final.log、surface-final.log、browser-real-final.log、frontend-browser.log、browser-retry*.log、windows-lifecycle-final.log、build-final.log、performance-final.log、types-final.log、lint-final.log、foundation-final.log、frontend-architecture-final.log、docs-final.log。测试数据库仅位于 .data/acceptance/；默认开发配置不导入这些账户。

来源历史浏览器结果压缩包按构建产物筛选，不进入新仓库；[排除清单及原始 SHA-256](excluded-source-artifacts.json) 保留可追溯性。源码、插件、包、许可证与其它原始历史证据保留，测试覆盖过的来源图片已恢复。

