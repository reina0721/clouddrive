# 044 WebUI 本地启动闭环修复设计

## 后端

在 `applicationRouter` 的唯一挂载位置执行：

```go
router.Mount(prefix, http.StripPrefix(prefix, adminHandler))
```

prefix 使用当前实现的稳定常量。内部 manifest/Auth Handler 只处理相对路径。测试通过 `httptest` 向完整公开路径发请求，并断言内部 Handler 收到 `/manifest` 与 `/auth/session`。

## 前端

增加官方开发依赖 `@vitejs/plugin-basic-ssl`，在 Vite plugins 中配置本项目名称和 `127.0.0.1`/`localhost` 域名，保持 `server.https: true`。证书缓存位于已忽略的 `node_modules/.vite`，不进入 Git。

自签名证书只服务本地开发；浏览器首次访问需要用户确认风险。生产环境仍由外部同源 HTTPS 托管，不复用该证书。

## 验证

先运行路由定向测试和前端门禁，再启动独立 Vite 端口执行 HTTPS 200 探测并停止该验证进程。最后运行 Go 全量测试、生成 clean check、链接检查和 Diff 审计。
