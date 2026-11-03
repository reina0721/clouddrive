# 045 WebUI Origin 策略闭环

状态：已完成。

## 范围

本变更修复 WebUI 经 Vite HTTPS 代理提交 setup/login/logout 时被全局 CORS 拒绝的问题，并让 CORS 与 Auth CSRF 使用同一份显式可信 Origin。修复保持默认拒绝，不使用 `*`、关闭 CORS、移除 Origin 校验或降级 Cookie 安全属性。

截图中出现的 Setup Token 已视为泄露值；实施和验收必须使用新值，文档和提交不得记录任何真实 Token。

## 阅读顺序

1. [研究索引](research/README.md)
2. [需求](requirements.md)
3. [设计](design.md)
4. [任务](tasks.md)
