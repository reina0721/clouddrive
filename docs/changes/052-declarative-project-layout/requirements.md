# 052 项目布局与可配置值集中声明需求

## 1. 目标

建立单一、可校验、跨 Go/Node/脚本消费的项目布局声明，并把真正随开发或部署环境变化的值放回正确配置 owner。目录或值调整后，所有消费者必须共同跟随或在副作用前明确失败。

## 2. 功能要求

| ID | 要求 |
| --- | --- |
| `REQ-052-001` | 必须提供版本化、机器可读、无 secret 的 repository layout authority，集中声明 WebUI root、module root、module WebUI facet、registry output、API generated artifacts、tool bin 与 release output。 |
| `REQ-052-002` | layout path 必须是 `/` 分隔的 repository-relative 路径；拒绝绝对/UNC/drive-relative、空路径、`..` 逃逸、非法重叠和 symlink/reparse escape。 |
| `REQ-052-003` | layout manifest 的固定 locator 是唯一允许的 bootstrap convention；工具必须允许测试或独立入口显式传入 layout path，不得按 cwd 中是否存在某目录猜测模式。 |
| `REQ-052-004` | 模块 WebUI Binding 只声明 facet 内 Entry/Locale 相对路径；ModuleID 与 layout 共同确定 owner root，runtime manifest 继续不包含源码路径。 |
| `REQ-052-005` | registry import specifier 必须由真实 source 与 output directory 计算，不得保留固定 `../../../` 或其他目录深度假设。 |
| `REQ-052-006` | Go generator、Node discovery/lint、Vite、Vitest、TypeScript include、package scripts 和跨平台 WebUI quality 必须消费同一 validated layout view；不能动态消费的文件必须有生成或一致性门禁。 |
| `REQ-052-007` | WebUI dev host/port、API target、management target 与 E2E base URL 必须由一个 typed/validated development config 解析；默认保持当前本地行为，允许显式环境覆盖。 |
| `REQ-052-008` | OpenAPI、operation inventory、WebUI registry、tool bin、release output 和 container smoke target 的默认路径/地址必须由各自声明 owner 提供；静态 CI/release/ignore 消费者必须通过 consistency check 防漂移。 |
| `REQ-052-009` | `config init` 默认输出必须由应用入口传入并与 Service 默认配置路径一致；Kernel CLI 不再自行拥有第二份 `config.yaml` 默认。 |
| `REQ-052-010` | layout/dev config schema 缺失、版本未知、字段非法、声明目标不存在或静态消费者漂移时必须 fail closed，并保留错误原因。 |
| `REQ-052-011` | 迁移后必须搜索并删除旧 cwd fallback、固定 module facet 拼接、固定 registry import depth 与已迁移的重复默认；不保留兼容双轨。 |
| `REQ-052-012` | 必须提供改变默认目录与端口的 fixture，证明消费者读取声明，而不是测试中重复默认字面量。 |

## 3. 非功能要求

- 不增加仅为解析 layout 的前端第三方依赖；优先使用 JSON 和平台标准库。
- 不让生产 Service 在运行期读取 `.scaffold/layout.json` 或依赖仓库源码目录。
- 不把绝对本机路径、凭据、DSN、Token 或环境快照写入 layout、生成物、日志或诊断。
- 路径解析必须跨 Windows/Linux；比较时使用规范化 repository-relative 语义。
- 配置读取与校验无资源副作用；失败时不留下部分生成物。
- 生成多个文件时先完成全部内存校验，再执行受控写入；`--check` 不修改文件。

## 4. 验收标准

1. 修改 fixture 中 WebUI root/module root/facet/registry output 后，Go 生成、Node discovery、TS/Vitest 配置和质量入口共同使用新值。
2. 模块 Binding 不再重复 `internal/module/<id>/binding/webui/web` 完整前缀。
3. registry 输出目录变化时生成的 ESM import 仍正确，path escape 与 symlink fixture 失败。
4. 改 WebUI dev port/API/management target 后 Vite 与 Playwright 使用同一解析结果；非法 URL/port 在启动前失败。
5. API/WebUI generated artifacts 的 clean check 来自 layout，静态 GoReleaser/workflow 配置漂移会被门禁拒绝。
6. Service 默认配置路径与 `config init` 默认输出来自同一 application declaration，并与 identity metadata 一致。
7. Windows/Linux 脚本、Go test、WebUI lint/typecheck/test/build、生成 clean check、docs guard 与 `git diff --check` 通过。
8. 当前 Auth/Kernel/identity/frontend 的延期候选没有被顺手改变。

## 5. 非目标

- 不改变产品、仓库、Go module、binary、cookie 或 scheduler namespace 身份。
- 不把 `frontend/` 接入根 build/CI/release，也不修改或删除它。
- 不进入 `old-backend/`。
- 不新增远程模块、运行时插件、Module Federation 或目录扫描注册。
- 不改变 HTTP route、operation ID、API version、ModuleID 或业务语义。
- 不新增 Auth lockout/session touch/JWKS transport 或 Kernel health timeout 配置字段。
- 不把测试 fixture、局部 import、协议常量和算法常量机械外置。
