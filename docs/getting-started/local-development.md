# clouddrive 本地开发

当前启动权威为根 README 及本页。后端沿用 Go 1.26.10，前端采用 Node >=22.18 与 pnpm 10.22.0。无需修改全局工具版本。

## 跨平台统一入口

使用 Node 24、Go 1.26.10 与 pnpm 10.22.0，从仓库根目录执行：

```bash
node scripts/dev.mjs --prepare  # 首次安装依赖；以后不需要 --prepare
```

工具在前台拥有前后端及生成器进程。先检查端口，再构建、迁移并等待 Go readiness、前端登录页和同源 API 全部成功。Ctrl+C 或任一服务退出时清理其余进程；日志在 `.data/dev/`，数据保留。普通开发使用根 `config.yaml`，不存在时运行原生 `config init`；已有数据库不重置；浏览器 Origin 仅在子进程环境中按实际端口覆盖。首次设置令牌位于 `.data/dev/setup-token`，不写入聊天或 Git。

需要真实浏览器验收时使用隔离环境：

```bash
node scripts/dev.mjs --preview
```

预览使用独立的 `.data/preview/` SQLite、文件、传输目录和账号，默认端口 4180 / 8120 / 9120。账号信息位于 `.data/preview/access.json`，重启复用账号与数据，不继承调用者的 `APP_` 数据库和存储环境。`run.lock` 防止同一环境并发启动；异常退出留下锁时，先确认原进程已停止再移除锁。设置 `CLOUDDRIVE_FILE_TEST_ACCESS` 为该文件的**绝对路径**后，在 frontend 运行 `pnpm exec playwright test --config playwright.files.config.ts file-tests/material-workspace.spec.ts`。该环境与原 Windows 文件预览分离。

`--web-port`、`--api-port`、`--management-port` 可覆盖端口，不会终止占用端口的其它进程。默认使用 Turbopack；需要明确选择 webpack 时加 `--webpack`，不会在失败后静默更换编译器。

Linux 上出现 `inotify` / `EMFILE` 时先检查 `fs.inotify.max_user_instances` 与 `fs.inotify.max_user_watches`；进程文件句柄上限和用户监听配额是不同限制。启动器不修改系统配额。SQLite 使用私有目录权限；在宽松 umask 的环境执行后端测试时使用 `umask 077`，不放宽数据库检查。

## Windows 既有入口

从仓库根目录执行 scripts/Start-Dev.ps1。若 Go 不在 PATH，传入 -GoExecutable 指定 go.exe；脚本也识别本机 LOCALAPPDATA/clouddrive-tools/go1.26.10/go/bin/go.exe。

首次启动会复制配置、安装前端依赖、迁移数据库，并启动 Go 与 Next.js。浏览器打开 http://127.0.0.1:4173/setup，用 .data/dev-setup-token 中的令牌创建管理员。也可以在启动前设置 APP_IAM__LOCAL__SETUPTOKEN。已有管理员时不能再次首次设置。

停止使用 scripts/Stop-Dev.ps1；只停止该脚本记录的进程树，避免按端口结束其它项目。

## 分别启动

~~~powershell
$env:APP_IAM__LOCAL__SETUPTOKEN = '<自行生成的随机设置令牌>'
go run ./cmd/app db migrate up
go run ./cmd/app
# 另一个终端进入 frontend
npx --yes pnpm@10.22.0 install --frozen-lockfile
npx --yes pnpm@10.22.0 dev
~~~

config.yaml 必须存在，可复制 config.example.yaml 或运行 go run ./cmd/app config init。使用 config init 后，应配置 http.cors.allowedOrigins 为实际前端 Origin，如 http://127.0.0.1:4173。

业务 API 使用 /api/v1；控制台使用 /api/console/v1。浏览器请求同源地址，Next.js 将 /api 与 /management 转发到 CLOUDDRIVE_BACKEND_URL（默认 http://127.0.0.1:8080）。管理端口默认 127.0.0.1:9090。

## 数据与模拟模式

默认 SQLite 数据位于 .data/app.db；不导入源项目数据库或账户。MySQL/PostgreSQL 通过 APP_DATABASE__DRIVER 和 APP_DATABASE__DSN 配置，启动前执行相同迁移命令。

只有显式 NEXT_PUBLIC_AUTH_MODE=mock 才进入演示模式。Mock 和纯 UI/参考页面保留演示用途，真实业务接口失败不会降级。切换 NEXT_PUBLIC 配置后须重启开发服务器或重新构建生产前端。

## 验证

Go：go test ./...、go vet ./...、go build ./...；有可用 C 编译器时执行 go test -race ./...。

前端：在 frontend 下用 npx --yes pnpm@10.22.0 check。其中浏览器回归明确启用模拟模式和拦截式契约模式；它们不代替真实后端验收。scripts/Test-Integration.ps1 使用新的 SQLite 数据库，实际创建管理员、待办和部门，并验证真实页面及退出。

[完整部署说明](../operations/clouddrive-deployment.md)；[验证状态](../changes/118-clouddrive-integration/tasks.md)。
