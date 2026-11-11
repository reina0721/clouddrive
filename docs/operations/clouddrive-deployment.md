# clouddrive 部署

## 构建与进程

使用 Go 1.26.10、Node 24 和 pnpm 10.22.0。Windows 可执行 `scripts/Build.ps1`；已安装工具链的 Linux 环境执行：

```bash
go build -trimpath -buildvcs=false -o dist/clouddrive ./cmd/app
pnpm --dir frontend build
pnpm --dir frontend standalone:check
```

Go 二进制独立运行，数据库迁移在启动或升级前显式执行。前端默认 server 模式产出 `frontend/apps/web/dist/standalone/`，该目录已包含 Next 追踪的运行依赖、编译页面、静态资源和本地 PDF 组件。复制整个目录即可部署；目标机器只需 Node 24，不再安装 pnpm 或复制源码工作区。入口为目录内的 `apps/web/server.js`：

```bash
CLOUDDRIVE_BACKEND_URL=http://127.0.0.1:8080 HOSTNAME=127.0.0.1 PORT=4173 \
  node frontend/apps/web/dist/standalone/apps/web/server.js
```

PowerShell 对应设置 `$env:CLOUDDRIVE_BACKEND_URL`、`$env:HOSTNAME`、`$env:PORT` 后执行同一个入口。`PORT` / `HOSTNAME` 属于 standalone 进程，开发期的 `WEB_PORT` 不用于配置这个入口。

`CLOUDDRIVE_BACKEND_URL` 在服务端处理请求时读取，同一份产物可在不同环境连接不同 Go 服务。值必须是 HTTP(S) 根 Origin，不含路径、凭据、query 或 fragment；默认 `http://127.0.0.1:8080`。Host 的 Next Proxy 只转发 `/api/`、`/wopi/`、`/management/`，保留原有请求、Cookie、CSRF 和范围响应；Go 继续执行认证授权。此变量不进入浏览器公开配置。`NEXT_PUBLIC_*` 仍属于构建期参数，不能在运行时切换认证产品形态。

根 `Dockerfile` 仅构建 Go 镜像；`frontend/Dockerfile` 的运行层只复制上述独立产物，以 node 用户运行，默认监听 `0.0.0.0:4173`。构建上下文排除 `.env`、本地数据和依赖目录。镜像内默认后端为 `http://backend:8080`，通过运行时环境变量指向同一私有网络中的 Go 服务，无需为后端地址重新构建镜像。完整容器构建入口见[构建与容器](build-and-container.md)。

`standalone:check` 把产物复制到仓库外，启动两个不同上游的传输夹具，检查依赖闭包、页面资源、Cookie/CSRF 透传、POST 请求体、范围字节及本地 PDF worker。它不代替真实 Go 会话、文件写入或线上代理验收。容器构建同样执行该检查；CI 分别构建 Go 与 Web 镜像。

静态导出模式仍生成静态站点，包含资源但不包含 Node Proxy；API 必须由部署方的同源反向代理提供。上述 standalone 启动与检查只适用于默认 server 模式。

## 同源与会话

生产只对外暴露 HTTPS 站点，反向代理 / 到 Next.js，/api/ 和 /management/ 到 Go 的业务端口8080；9090 只监听内网/loopback。Go 业务端口的 management facade 同样保留身份和 management:read 权限检查。公开探针按原后端配置开放；不要将 management 或 API 整段配置为免认证。

```nginx
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
```

配置 http.cors.allowedOrigins 为唯一真实站点 Origin，按实际代理配置 trusted proxy CIDR；保留 Cookie Secure/HttpOnly，不把会话凭据写入 localStorage。开发浏览器的 localhost/127.0.0.1 允许 Secure Cookie；生产必须 HTTPS。登录失效后页面返回登录流程。

设置 logger.environment=production、auth.mode=session，设置随机 APP_IAM__LOCAL__SETUPTOKEN，创建管理员后移除设置令牌。注册默认关闭。凭据/数据库/本地配置不进入镜像或版本库。

## 站点信息

在「系统配置 → 站点信息」填写名称、描述、浅色和深色标志、浏览器图标、使用条款和隐私政策链接。保存后当前页面立即更新，其他浏览器下次加载时读取新值。留空可恢复默认名称、图形或浏览器标题，也可隐藏相应链接。深色标志留空时沿用浅色标志。

所有字段均对访客公开。图片和条款链接使用 HTTPS 或以单个斜杠开头的站内路径。浏览器直接请求图片，Go 服务不代理图像。

需要由公网域名生成分享、直链或文档回调时，先在 `console.siteOrigins` 登记转发到同一实例的根地址，再到「站点地址」保存主站及最多八个备选站点。分享和直链在主站或备选站点访问时沿用该地址，其他访问来源生成主站链接。外部阅读器和 WOPI 回调始终使用主站地址。清空后沿用浏览器当前地址。反向代理需要在主站转发相应的网页、公开 API 和 `/wopi/` 路径。

## 数据库与调度

将已有本地数据迁入容器时，保持存储位置标识和访问路径稳定。系统会把本地存储的绝对路径与文件元数据绑定；直接把原目录挂到另一个路径，会触发内容迁移保护并拒绝启动。本地验收沿用原绝对路径作为容器挂载目标与工作目录，使用可读写该目录的非 root UID，数据库和文件保持原样。需要改变存储位置时，应先完成明确的内容迁移。

默认 SQLite；持久化 .data/。MySQL/PostgreSQL 通过 driver/DSN 指定并执行 db migrate up，三种方言迁移均保留。升级前备份数据库；同一数据库必须执行全部六个迁移集。迁移失败/dirty 时停止启动并按原迁移工具恢复，不能直接删除版本记录。

scheduler.enabled 默认 true；任务定义与下次运行时间保存在数据库，重启后重新加载。关闭调度器会保留任务并停止派发。任务由既有 execution 生命周期执行；每次执行重新检查账号状态与权限，执行权通过版本比较领取，避免重复派发。当前本地调度适用于单个后端实例；多实例上线前配置并验证既有协调能力。

API 请求默认禁止私网、loopback、链路本地及元数据地址，重定向和 DNS 解析逐次验证。确需访问内部 API 时，管理员在 console.relay.allowedOrigins 中按协议、主机、端口显式许可，不接受来自浏览器的任意放行规则。默认最长30秒、响应体2MiB、请求体1MiB；服务端不执行任意 JavaScript。带脚本/提取器的集合不能新建服务端任务。UA/自定义允许头可用；代理和 TLS 指纹当前不支持，UI 禁用且接口返回 unsupported。

## 验证记录

验证结果必须记录实际命令、环境、范围和未通过项，见[验证策略](../development/validation.md)。容器、MySQL/PostgreSQL 外部实例和线上代理必须在目标环境再次验证，不能以 SQLite 验收代替。

若使用独立 Go 工具目录执行 Verify-Quality.ps1，先将其 bin 加入当前终端 PATH。race 需要当前终端 CGO_ENABLED=1，并通过 CC 或 PATH 指定 C 编译器；本次使用用户目录中的 w64devkit，不修改全局工具。Start-Dev、Build、Test-Integration 支持 -GoExecutable，也会识别用户目录中的 clouddrive-tools/go。
