# 045 WebUI Origin 策略闭环需求

## 要求

| ID | 要求 |
| --- | --- |
| REQ-001 | CORS 必须区分同源请求与真正跨域请求；空 allowlist 继续拒绝跨域。 |
| REQ-002 | WebUI Auth 的 setup/login/logout 必须接受请求自身 Origin或 HTTP 配置显式允许的 Origin。 |
| REQ-003 | CORS 与 WebUI Auth 必须消费同一份 `http.cors.allowedOrigins`，不得建立第二个字符串配置。 |
| REQ-004 | 本地 Vite 固定使用 5173，显式允许 `https://localhost:5173` 与 `https://127.0.0.1:5173`。 |
| REQ-005 | 不允许 `*`、动态反射任意 Origin、关闭 CORS、移除 CSRF Origin、HTTP Cookie 降级或永久开发后门。 |
| REQ-006 | Setup Token 输入必须遮罩且避免普通表单自动填充；泄露的旧值不得继续使用。 |
| REQ-007 | 增加 CORS 同源/跨域测试、Auth 可信 Origin 测试和经 Vite 代理的 setup 运行验收。 |
| REQ-008 | 更新当前本地 `config.yaml` 仅加入两个固定开发 Origin，不写入或提交 Token。 |

## 非目标

- 不设计生产反向代理、TLS 终止或动态租户 Origin。
- 不开放普通 Bearer API 给任意浏览器来源。
- 不改变 Session、Cookie、CSRF Token、密码或 setup 一次性关闭语义。
- 不自动删除、重建或迁移现有数据库。

## 验收

- 同源 POST 在空 allowlist 下通过 CORS；未列入 allowlist 的跨域请求继续返回 `cors_origin_denied`。
- 两个固定 Vite HTTPS Origin 可通过 CORS 和 Auth Origin 校验。
- Vite 非 5173 端口启动应明确失败，不静默切换到未授权 Origin。
- 使用独立临时数据库和新测试 Token 经 Vite 代理完成 setup；提交和日志不包含 Token。
- Go 全量测试、WebUI lint/typecheck/build/generate clean check、文档链接和旧凭据审计通过。
