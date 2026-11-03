# R001 WebUI Origin 拒绝根因

## 1. 运行事实

- 页面从 `https://localhost:5173/setup` 发起请求，浏览器 Origin 是 `https://localhost:5173`。
- Vite 把 `/api/v1` 代理到 `http://127.0.0.1:8080`，并保留浏览器 Origin。
- 当前本地 `config.yaml` 的 `http.cors.allowedOrigins` 为空。
- `pkg/httpx.CORS` 对任何非空 Origin 都要求显式命中 allowlist，因此在 Auth Handler 前返回 `cors_origin_denied`。

## 2. 第二层失败

只向 CORS allowlist 加入 Vite Origin 不能完整修复。`webuiauth.sameOrigin` 当前根据后端请求的 TLS 和 Host 计算自身 Origin；经 Vite 代理后它看到的是后端地址，而浏览器 Origin 是 Vite HTTPS 地址，因此随后会返回 `origin_rejected`。

CORS 和 CSRF Origin 是两个边界：前者决定浏览器 Origin 是否允许进入，后者保护 Cookie 认证的不安全请求。两者必须消费同一份显式可信 Origin，不能各自维护隐式例外。

## 3. CORS 自身语义缺口

浏览器对同源 POST 也可能发送 Origin。当前 CORS 把“存在 Origin”等同于“跨域”，导致空 allowlist 连真实同源请求也拒绝。Middleware 应先识别请求自身 Origin；只有真正跨域时才查询 allowlist。

## 4. 敏感输入

截图中的 Setup Token 输入框以明文显示，且真实值已经进入截图。该值必须轮换，不能继续用于验收。页面应使用密码型输入并关闭不合适的自动填充，但前端遮罩不能替代 Token 轮换和后端只读环境变量边界。

## 5. 结论

修复需要同时覆盖 CORS 同源识别、Auth 可信 Origin 注入、本地显式 allowlist、Vite 固定端口和 Setup Token 输入遮罩。关闭 CORS、允许任意 Origin、改用 HTTP 或删除 CSRF Origin 校验都会破坏现有安全边界，不是可接受方案。关键事实已有运行配置与代码证据，研究门禁通过。
