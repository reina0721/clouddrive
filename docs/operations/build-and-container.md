# 构建与容器

生产构建执行 `scripts/Build.ps1`，产出 `dist/clouddrive.exe` 与 Next 构建。使用 Go 1.26.10、pnpm 10.22.0，不修改全局版本。完整命令和反向代理配置见 [部署说明](clouddrive-deployment.md)。

Go 质量入口为 `scripts/Verify-Quality.ps1`，包括格式、生成物、测试、race、vet 和无 CGO 构建；前端入口 `scripts/Verify-WebUI.ps1` 执行工作区完整 `check`；文档入口 `scripts/Verify-Docs.ps1`。各项以实际退出结果为准，单项通过不能替代浏览器和部署验收。

## OCI image

根目录 `Dockerfile` 只构建 Go 服务，`frontend/Dockerfile` 构建 Next 服务，两者构建上下文均为仓库根目录：

```sh
docker build -t clouddrive-api .
docker build -f frontend/Dockerfile -t clouddrive-web .
```

运行时显式提供配置与可写数据库卷，management 监听仅暴露给受信网络。Go runtime 为 nonroot；探针使用 management `/startupz`、`/livez`、`/readyz`。`scripts/container-smoke.sh` 检查后端探针和 API 不回退 HTML，前端由独立部署和浏览器验收覆盖。迁移应在启动前显式执行，不隐藏在容器启动中。

容器构建、外部数据库及线上发布必须分别验证；本地源码构建不证明这些检查已经通过。
