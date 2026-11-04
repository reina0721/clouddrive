# clouddrive 部署

## 构建与进程

使用 Go 1.26.10 和 pnpm 10.22.0。Windows 执行 scripts/Build.ps1；Linux 执行 go build -trimpath -buildvcs=false -o dist/clouddrive ./cmd/app，再在 frontend 执行 npx --yes pnpm@10.22.0 build。

Next.js 需要 Node 服务进程和整个 frontend 工作区依赖，构建产物位于 frontend/apps/web/dist；使用 npx --yes pnpm@10.22.0 --filter @clouddrive/web exec next start --hostname 127.0.0.1 --port 4173。Go 二进制独立运行，数据库迁移应在启动或升级前执行。

根 Dockerfile 仅构建后端镜像，不再装配旧静态前端。前端使用 frontend/Dockerfile；两个容器通过内部网络通信，前端构建时提供 CLOUDDRIVE_BACKEND_URL=http://backend:8080。未经用户操作，本次不会推送或部署。

## 同源与会话

生产只对外暴露 HTTPS 站点，反向代理 / 到 Next.js，/api/ 和 /management/ 到 Go 的业务端口8080；9090 只监听内网/loopback。Go 业务端口的 management facade 同样保留身份和 management:read 权限检查。公开探针按原后端配置开放；不要将 management 或 API 整段配置为免认证。

~~~nginx
server {
  listen 443 ssl;
  server_name clouddrive.example.com;
  # 配置证书路径
  location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  location /management/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
~~~

配置 http.cors.allowedOrigins 为唯一真实站点 Origin，按实际代理配置 trusted proxy CIDR；保留 Cookie Secure/HttpOnly，不把会话凭据写入 localStorage。开发浏览器的 localhost/127.0.0.1 允许 Secure Cookie；生产必须 HTTPS。登录失效后页面返回登录流程。

设置 logger.environment=production、auth.mode=session，设置随机 APP_IAM__LOCAL__SETUPTOKEN，创建管理员后移除设置令牌。注册默认关闭。凭据/数据库/本地配置不进入镜像或版本库。

## 数据库与调度

默认 SQLite；持久化 .data/。MySQL/PostgreSQL 通过 driver/DSN 指定并执行 db migrate up，三种方言迁移均保留。升级前备份数据库；同一数据库必须执行全部六个迁移集。迁移失败/dirty 时停止启动并按原迁移工具恢复，不能直接删除版本记录。

scheduler.enabled 默认 true；任务定义与下次运行时间保存在数据库，重启后重新加载。关闭调度器会保留任务并停止派发。任务由既有 execution 生命周期执行；每次执行重新检查账号状态与权限，执行权通过版本比较领取，避免重复派发。当前本地调度适用于单个后端实例；多实例上线前配置并验证既有协调能力。

API 请求默认禁止私网、loopback、链路本地及元数据地址，重定向和 DNS 解析逐次验证。确需访问内部 API 时，管理员在 console.relay.allowedOrigins 中按协议、主机、端口显式许可，不接受来自浏览器的任意放行规则。默认最长30秒、响应体2MiB、请求体1MiB；服务端不执行任意 JavaScript。带脚本/提取器的集合不能新建服务端任务。UA/自定义允许头可用；代理和 TLS 指纹当前不支持，UI 禁用且接口返回 unsupported。

## 验证记录

本机验证结果、未通过项及平台限制见 docs/changes/118-clouddrive-integration/tasks.md。容器、MySQL/PostgreSQL 外部实例和线上代理必须在目标环境再次验证，不能以 SQLite 验收代替。

若使用独立 Go 工具目录执行 Verify-Quality.ps1，先将其 bin 加入当前终端 PATH。race 需要当前终端 CGO_ENABLED=1，并通过 CC 或 PATH 指定 C 编译器；本次使用用户目录中的 w64devkit，不修改全局工具。Start-Dev、Build、Test-Integration 支持 -GoExecutable，也会识别用户目录中的 clouddrive-tools/go。
