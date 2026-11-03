# R002 全仓可配置化候选审计

## 1. 研究方法与判断标准

本报告静态搜索当前生产源码、配置、生成入口、PowerShell/Bash、GitHub Actions 与发布文件中的路径、地址、端口、timeout 和容量字面量，再按 owner 判断是否需要配置化。

不是“出现字符串就配置化”。只有满足以下任一条件才列为候选：

- 会随部署、开发环境、仓库复制或目录调整变化；
- 被两个以上消费者重复拥有，存在漂移风险；
- 已经有明确配置 authority，但调用方仍复制默认值；
- 承载安全、容量、超时或资源策略，且运维需要改变；
- 静态消费者不能引用 authority，但可以通过门禁验证一致性。

## 2. 审计矩阵

| 类别 | 当前证据 | 判断 | 052 处理 |
| --- | --- | --- | --- |
| WebUI/模块 WebUI 布局 | Go、Node、TS、Vitest、脚本重复 `webui`、`internal/module`、`binding/webui/web` | 构建期布局 authority 缺失 | 纳入 |
| registry/API 生成物 | `webui-registry.ts`、`api/openapi.yaml`、operation inventory 在生成器、directive、质量与发布中重复 | 生成物 owner 缺失 | 纳入 |
| 工具/release 目录 | `.tools/bin`、`dist` 在 Windows/Linux/CI/ignore 配置重复 | 仓库布局，部分消费者只能静态配置 | 纳入，共享声明 + 一致性门禁 |
| WebUI 开发 endpoint | `5173`、`8080`、`9090` 在 Vite/Playwright 与后端示例配置分轨 | 开发环境值，应显式配置 | 纳入 WebUI dev config |
| 默认 config 文件 | `.scaffold/identity.yaml` 已声明 `config.yaml`，`cmd/app` 与 Kernel CLI 又各有常量 | application owner 重复 | 纳入：入口注入单一默认，并验证 identity 一致性 |
| Container smoke URL | 脚本固定 `127.0.0.1:9090` | 与容器 profile 绑定但应允许显式 override | 纳入交付脚本配置 |
| 产品身份值 | application/binary/repository/scheduler namespace/cookie/release 名称多处出现 | 已有独立身份迁移边界，不能在路径任务中顺手改名 | 只加漂移报告；身份迁移另立任务 |
| Auth lockout/session touch | `maxFailedAttempts`、`lockDuration`、一分钟触碰窗口留在 Service，只有 session timeout 在 Config | 真实安全/数据库写放大策略 | 后续独立 Auth 配置研究 |
| JWKS transport tuning | KeepAlive、IdleConnTimeout 等在 Adapter 固定 | 技术调优值；是否公开会改变 Auth 配置面 | 后续独立研究；本轮只要求命名/审计说明 |
| Kernel health timeout | `NewHost` 固定 2 秒，`pkg/health` 又有 2 秒 fallback | Host/runtime policy 候选 | 后续 Kernel Host 配置研究 |
| Database/Storage/I18n 默认 | 已由各自 typed Config/default owner 集中声明 | 当前符合 032 边界；相同值跨 pkg/app 可能是有意分层 | 不改 |
| HTTP routes、operation/module/message ID | 位于 binding/contract/owner 中 | 协议与业务语义，不是部署配置 | 不改 |
| test fixture/临时路径 | `t.TempDir()`、固定测试 URL、golden 相对路径 | 测试输入与断言 | 不改，除非用于验证 layout fixture |
| `frontend/` | 独立 Nuxt/Vue，未接入根 build/CI/release | 当前 authority 明确隔离 | 不纳入；集成/退役时单独全量审计 |

## 3. 当前应纳入 052 的事实

### 3.1 生成产物路径

OpenAPI 与 operation inventory 至少同时出现在 `contract-gen` 默认参数、`go:generate`、Windows/Linux quality 脚本、CI breaking check 与 GoReleaser extra files。WebUI registry 也同时出现在 `cmd/app`、E2E 和生成检查中。

生成器仍应接受显式 output override，便于 fixture 和独立验证；默认 output 则必须来自 layout。Go directive、GoReleaser、workflow 等无法动态引用 JSON 的位置由 `layout check` 比较，不能继续无校验复制。

### 3.2 工具与 release 目录

`.tools/bin` 在安装/发布脚本和 workflow 中重复，`dist` 在 GoReleaser、签名、校验、上传、ignore 与 Docker context 中重复。它们属于 repository delivery layout，不属于应用运行配置。

### 3.3 默认配置文件路径

应用入口加载的 `defaultConfigPath` 与 `config init --output` 的 `defaultOutputPath` 语义上应相同，但目前由 `cmd/app` 和 `internal/kernel/cli` 分别持有。`.scaffold/identity.yaml` 还声明了第三份 `config_filename`。

Kernel CLI 应接收应用入口传入的默认输出，不反向依赖 `.scaffold` 或 composition；仓库门禁再验证入口默认与 identity metadata 一致。生产二进制不能在运行期依赖仓库中的 `.scaffold` 文件。

## 4. 配置层次

| 层次 | 示例 | Authority |
| --- | --- | --- |
| Repository/build layout | roots、facet suffix、generated outputs、tools/release dirs | `.scaffold/layout.json` |
| Application runtime | listener、DSN、session timeout、storage path | typed `config.yaml` + env |
| WebUI development | Vite host/port、API/management target、E2E base URL | WebUI dev env schema + checked defaults |
| Product identity | module/application/binary/config filename | `.scaffold/identity.yaml`，只做一致性验证，不由生产二进制动态读取 |
| Protocol/business contract | route、operation、ModuleID、message ID | 所属 Go/TS contract |
| Local implementation policy | 算法阈值、内部 transport tuning | 所属包命名常量；只有真实运维需求才升级 typed Config |

## 5. 推断与计划边界

### 推断

共享配置的目标不是“任意路径都能随时移动”，而是每个可变事实只有一个 owner，并让所有消费者可追溯。若某工具格式不能引用 owner，受控重复必须有机器门禁。

### 计划边界

052 可以闭合构建布局、WebUI 开发 endpoint、生成物、工具/release 目录、container smoke override 和默认 config path 注入。以下变化需要新的研究/确认：

- 改产品身份或仓库/module/binary 名；
- 给 Auth 增加 lockout/session touch/JWKS transport 配置字段；
- 给 Kernel Host 增加 health timeout 配置；
- 把 `frontend/` 接入或移出根工程；
- 改 HTTP route、API version 或模块协议。

## 6. 局限与刷新条件

静态搜索无法证明每个字面量都具有运维需求。实施 052 时只允许迁移矩阵中“纳入”的项；发现新的安全策略、公共配置字段或模块边界变化必须退回研究，不能用“清理硬编码”扩大授权。

## 7. 对 052 的影响

研究门禁通过。计划必须同时提供迁移、兼容删除、跨平台 fixture、一致性门禁和当前文档同步，不能只增加一个无人消费的配置文件。
