# R001 WebUI 与生成路径耦合审计

## 1. 研究问题与范围

本报告核对根 `webui/`、`internal/module/<module-id>/binding/webui/web`、模块 `SourcePath` 和生成 registry 的真实调用链，回答哪些路径是合理声明，哪些只是多个工具各自复制的仓库布局假设。

范围为当前根 Go 工程和 Admin WebUI；`old-backend/` 按项目 authority 排除，独立 `frontend/` 未进入当前根 build/quality/release，因此不把它与 Admin WebUI 混为同一布局。

## 2. 当前事实

### 2.1 Go Binding 重复完整仓库路径

Auth/Ops 的 `binding/webui/binding.go` 为每个 Entry 和 Locale 保存完整 repository-relative `SourcePath`，例如：

```text
internal/module/auth/binding/webui/web/SetupPage.tsx
internal/module/auth/binding/webui/web/locale/zh-CN.json
```

`internal/webui.Catalog.ValidateSourcePathOwnership` 又按固定片段拼出 owner root：

```text
<repository>/internal/module/<ModuleID>/binding/webui/web
```

因此模块声明和校验器同时拥有相同目录知识。`SourcePath` 作为构建期元数据本身仍然合理，但完整根路径没有必要由每个资源重复声明。

### 2.2 registry 生成依赖 cwd 与固定目录深度

`cmd/app.generateWebUIRegistry` 默认写 `webui/src/generated/webui-registry.ts`，如果当前 cwd 没有 `webui` 就改写到 `src/generated/webui-registry.ts`。这不是显式配置，而是根据目录存在性猜测调用位置。

`internal/composition.GenerateWebUIRegistryForCatalog` 把 Entry/Locale import 固定加上 `../../../`。该值只在“生成文件仍位于当前三级深度”时成立；移动输出目录不会得到校验错误，而会生成错误 import。

### 2.3 Node 与 TypeScript 再次声明相同布局

- `webui/scripts/module-roots.mjs` 固定从 `<repository>/internal/module` 扫描，再拼 `binding/webui/web`；
- `webui/tsconfig.json` include 固定 `../internal/module/*/binding/webui/web`；
- `webui/vitest.config.ts` 再次固定相同 test glob；
- 三个 lint 脚本自行从脚本目录推导 `webuiRoot` 和 `repositoryRoot`；
- `vite.config.ts` 逐项写死 SDK 文件路径、`node_modules` alias 和 `fs.allow: [".."]`；
- `package.json` 的 generate 命令假设 cwd 位于 `webui/`，使用 `go run ../cmd/app`；
- PowerShell/Bash 质量脚本又固定进入根 `webui`。

这些消费者没有共同 schema，也没有“声明改变后所有消费者必须同步”的门禁。

### 2.4 开发网络值与后端配置分轨

`vite.config.ts` 固定 Vite host、API `8080` 与 management `9090`；`playwright.config.ts` 再次固定 `5173`。后端同类值由 `config.yaml`/typed Config 拥有，但改变后端端口不会自动更新 Vite proxy 或 Playwright base URL。

这组值不是仓库目录布局，应进入 WebUI 开发环境配置并有集中解析/校验，不能混入 layout manifest。

## 3. 事实、推断与目标设计

### 事实

- 048 已确认业务模块继续拥有 WebUI 源码，`SourcePath` 只在构建期使用；runtime manifest 不泄漏源码路径。
- 050 已把 Node 模块扫描改为动态发现，但发现根和 facet suffix 仍写死。
- 当前生成器已有 path escape、普通文件、symlink 与 locale coverage 校验，可以复用安全语义。

### 推断

只把 `"internal"`、`"module"` 等提成各语言自己的常量不能解决跨语言漂移。需要一个机器可读、版本化、无 secret 的构建期 layout manifest；不能动态读取它的静态消费者必须由一致性检查约束。

### 目标设计

- `.scaffold/layout.json` 是 repository-relative 构建布局 authority；JSON 让 Go 与 Node 使用标准解析能力，不新增前端 YAML 依赖。
- manifest 自身路径是最小 bootstrap invariant；工具允许显式 `--layout` 覆盖，禁止再通过 cwd 内容猜测项目形态。
- 模块 Binding 的 Entry/Locale 只声明 `binding/webui/web` facet 内相对路径；模块根和 facet suffix 由 layout 决定。
- registry import 使用 `filepath.Rel(outputDir, sourceFile)` 计算并转换为 ESM relative specifier，不再固定 `../../../`。
- Vite、Vitest、lint、生成器和跨平台脚本读取同一 validated view；TSConfig 等不能动态计算的文件由受控生成物承接并做 clean check。
- WebUI host/port/proxy 使用独立 development config，不进入 repository layout。

## 4. 安全与失败边界

layout path 必须：

- 使用 `/`、相对仓库根、非空、规范化后不含 `..` 逃逸；
- 拒绝绝对路径、UNC、drive-relative、重复/冲突路径和不允许的 reparse/symlink 逃逸；
- 输入 root 必须为目录，声明输出必须位于允许 owner 下；
- 错误必须指出字段和安全的相对路径，不输出环境或绝对敏感路径；
- schema/version 未知、字段缺失或静态消费者漂移时 fail closed。

## 5. 不适用场景

- HTTP route、operation ID、ModuleID 与 locale message ID 是协议/业务契约，不属于文件布局配置。
- import 的局部相对路径由模块系统解析，不需要全部改成配置。
- 测试临时目录和 fixture 路径用于验证边界，不应进入生产 layout。
- 远程模块、运行时安装和 Module Federation 仍不在当前架构内。

## 6. 局限与剩余未知

本研究没有执行目录移动演练。实施时必须用临时 fixture 改变 `webui.root`、`modules.root`、facet suffix 和 registry output，证明 Go 与 Node 消费者共同跟随，而不是只验证默认值。

## 7. 对 052 的影响

研究门禁通过。052 必须以共享 layout + typed development config + consistency gate 为单轨方案，删除现有 cwd 猜测、完整模块资源路径重复和固定 import depth。
