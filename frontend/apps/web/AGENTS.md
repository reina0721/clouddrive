# Web Host 开发约束

- 本目录是唯一 Product Surface × Web Runtime 的启动与装配边界，不是 Page Pattern 或业务公共组件的所有者。
- 只拥有 Next Router、Browser API、生命周期、持久化、Error Boundary、View Transition 桥接以及 `surface-foundation` 装配。
- 页面优先组合 Universal Element 与 Page Pattern；可跨后台业务复用的 Layout/Pattern 必须进入 `packages/surface-foundation` 并完成 Contract 门禁。
- Reference 数据、场景 Schema 和可直接打开的 URL 只用于确定性验收，不模拟 API、权限引擎或后端业务正确性。
- 禁止直接导入 HeroUI、React Hook Form、Resolver、i18next/react-i18next；分别经过 `ui-adapter`、`form-foundation` 与 `i18n`。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
