# 052 项目布局与可配置值集中声明设计

## 1. 总体模型

```text
.scaffold/layout.json                 WebUI development env
        |                                      |
        v                                      v
validated project layout               validated dev config
   |        |        |                    |           |
   v        v        v                    v           v
Go tools   Node    script/check         Vite      Playwright
   |        |        |
   +---- generated/static consistency gates ----+
```

layout 只描述仓库构建布局；运行 Service 继续只读取 application Config。生产 binary 不因本方案获得对仓库源码树的隐式依赖。

## 2. Layout schema

目标文件：`.scaffold/layout.json`。建议初始语义如下；字段名在实施前由 contract test 冻结，不能出现任意 map：

```json
{
  "schemaVersion": 1,
  "roots": {
    "webui": "webui",
    "modules": "internal/module",
    "tools": ".tools/bin",
    "release": "dist"
  },
  "webui": {
    "moduleFacet": "binding/webui/web",
    "source": "webui/src",
    "platformStyles": "webui/src/styles.css",
    "registryOutput": "webui/src/generated/webui-registry.ts"
  },
  "generatedArtifacts": {
    "openapi": "api/openapi.yaml",
    "operationInventory": "internal/transport/http/api/operation_inventory.gen.go"
  }
}
```

字段使用完整 repository-relative path，避免消费者还需知道“某字段相对哪个字段”。`moduleFacet` 是唯一例外，它明确相对每个 `<modules>/<ModuleID>`。

`.scaffold/layout.json` 的路径是 bootstrap constant。Go/Node loader 均接受显式 path 用于 fixture；默认入口只允许从 repository root 或向上寻找 `.scaffold/layout.json`，不根据 `webui`、`go.mod` 等目录存在性切换输出语义。

## 3. Go 消费边界

新增项目自有 layout contract/loader，职责仅为：

- decode/version/unknown-field validation；
- repository-relative path normalization；
- root/output/owner relationship validation；
- 为 Go generator 返回不可变 typed paths。

它不读取 application `config.yaml`，不导入 WebUI 业务模块，不启动资源。

### 3.1 Binding 迁移

Entry/Locale 的字段继续命名 `SourcePath`，但语义单轨改为 module WebUI facet-relative：

```go
Entry{ID: "auth.setup", SourcePath: "SetupPage.tsx"}
Locale{Language: "zh-CN", Namespace: "webui.auth", SourcePath: "locale/zh-CN.json"}
```

不保留旧 repository-relative 兼容分支。Catalog 校验接收 validated layout，从：

```text
<repository>/<modules>/<ModuleID>/<moduleFacet>/<SourcePath>
```

解析真实文件，并沿用普通文件、symlink/reparse 与 owner escape 门禁。

### 3.2 registry 生成

生成器输入同时包含 Catalog、repository root 与 layout。每个 import 通过 source absolute 与 registry output parent 的 `filepath.Rel` 计算；转换 `/` 后确保以 `./` 或 `../` 开头，拒绝不可表示或越界路径。

写入采用先生成/验证、后原子替换；`--check` 只比较内容。删除 `os.Stat("webui")` cwd fallback。

## 4. Node/TypeScript 消费边界

`webui/scripts/project-layout.mjs`（目标名可在实施中微调）负责标准库 JSON 读取和与 Go 等价的 schema/path 校验，并导出：

- repository root、WebUI root、module roots；
- source/platform style/registry output；
- TypeScript/Vitest glob；
- SDK alias 的 WebUI-root-relative 解析辅助。

三个 lint 脚本、Vite/Vitest/Playwright 和 package script 入口复用该模块。Node helper 不复制默认路径；测试使用临时 manifest。

`tsconfig.json` 不能执行代码，采用受控生成的 `tsconfig.layout.generated.json` 承载 include/path 投影，并由 `generate:check`/quality 验证 clean。生成物包含“DO NOT EDIT”说明，`tsconfig.json` 只 extends 或 references 它。

## 5. WebUI development config

开发网络值不进入 layout。建立单一解析模块和 `.env.example`，至少声明：

```text
WEBUI_DEV_HOST=127.0.0.1
WEBUI_DEV_PORT=5173
WEBUI_API_TARGET=http://127.0.0.1:8080
WEBUI_MANAGEMENT_TARGET=http://127.0.0.1:9090
```

Vite 与 Playwright 复用同一 parser。要求：

- port 为 1..65535；target 是无 userinfo 的 `http`/`https` URL；
- 默认只绑定 loopback；非 loopback 必须显式提供；
- 不把变量以 `VITE_` 暴露到浏览器 bundle，除非确有浏览器消费；
- base URL 从 host/port 计算，不再另存第三份值；
- API prefix 与 management rewrite 属于协议/adapter contract，保持命名常量，不作为任意配置。

## 6. Generated artifact 与 delivery layout

contract generator 默认 output 来自 layout，同时保留显式 flags 供 fixture 使用。`go:generate` 只负责调用 tool，不再重复两个 output 值。

PowerShell/Bash 通过同一小型 layout query/check 入口取得 WebUI、tools、release 与 generated artifact 路径。GitHub Actions、GoReleaser、`.gitignore`、`.dockerignore` 等静态格式无法执行 helper，因此允许保留其原生声明，但 `layout check` 必须解析/比较关键字段；漂移导致 quality/release 失败。

Container smoke target 通过命名参数或环境变量声明，默认与容器 profile 一致；脚本内只保留默认声明的单一 owner，不在多个 curl 行复制完整 URL。

## 7. Application 默认配置路径

`cmd/app` 的 application entry 继续拥有 Service 默认 config path，并把同一值传入 Bootstrap CLI 构造。`internal/kernel/cli.ConfigCommands` 接收 default output path，不再声明自己的 `config.yaml`。

`.scaffold/identity.yaml` 是复制/身份 metadata，不由 production binary 动态读取。layout/identity consistency gate 检查其 `config_filename` 与 application declaration 一致；本任务不改变 identity 值。

## 8. 失败语义与原子性

- loader/schema/path 错误：返回带字段上下文的错误链；不 fallback 内置另一套布局。
- manifest 缺失：开发/生成/质量命令失败；长期 Service 不读取 manifest，因而不受影响。
- source/output 越界：生成前失败。
- 多生成物：全部内容在内存构造并验证后，再逐项原子写；任一校验失败零写入。
- 静态配置漂移：`layout check` 列出 consumer 与声明字段，非零退出。
- dev URL 非法：Vite/Playwright 启动前失败，不偷偷退回当前端口。

## 9. 迁移与单轨删除

1. 先建立 manifest、Go/Node loader 与 fixture contract tests。
2. 迁移 Go Binding/owner/generator，更新生成物。
3. 迁移 Node/Vite/Vitest/TSConfig/package scripts。
4. 迁移 quality/delivery/API output 与默认 config path 注入。
5. 加 consistency/residual scan，删除旧 cwd fallback、固定 import depth 和已迁移重复值。

不保留 old field、兼容 alias、双 SourcePath 语义或环境 bypass。

## 10. 文件影响

预期修改范围：

- `.scaffold/layout.json`；
- layout contract/loader/tool 的新 Go 文件与测试；
- `internal/webui/**`、`internal/composition/webui_registry*`、Auth/Ops WebUI Binding；
- `cmd/app` 与 `internal/kernel/cli` 的默认路径注入；
- `webui/scripts/**`、Vite/Vitest/Playwright/TSConfig/package 配置与生成物；
- contract generator、`go:generate`、Windows/Linux quality/release/smoke 脚本；
- 必要的 workflow、GoReleaser、ignore consistency checks；
- 当前 configuration/WebUI/build/release/module authority 与 052 documentation impact。

若实施发现必须修改公共 API、产品身份、Auth/Kernel 配置字段或 `frontend/`，立即退回研究和待确认状态。

## 11. 验证

- Go layout/schema/path/owner/import-relative/atomic-write tests；
- Node layout/dev config tests 与改变目录/端口 fixture；
- WebUI `generate:check`、lint、lint:modules、typecheck、test、build；
- API generate clean 与静态 consumer consistency failure fixture；
- PowerShell/Bash 脚本语义检查，Windows 本地执行适用入口；
- `go test ./... -count=1`、`go test -race ./... -count=1`、`go vet ./...`、CGO-free build；
- docs guard、`git diff --check` 与旧字面量残留搜索。

Playwright E2E、浏览器视觉、Linux 真实 shell、Docker runtime 与远端 CI 若当前环境未执行，必须明确标为未验证，不由静态检查替代。
