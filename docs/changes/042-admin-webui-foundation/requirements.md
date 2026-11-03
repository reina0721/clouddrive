# 042 Admin WebUI 模块化宿主与可选 Admin Binding 需求

## 目标

建立独立、可扩展且不穿透业务边界的 Admin WebUI。宿主统一承载后台体验，业务模块只在存在真实管理需求时贡献 Admin 页面、路由、导航、权限引用和语言资源；数据与操作继续通过模块自身应用能力完成。

## 功能要求

| ID | 要求 |
| --- | --- |
| REQ-001 | 新增项目自有 Admin Binding，保持纯数据、不可变、可校验；模块没有真实后台需求时不建立 Admin Binding 或空页面。 |
| REQ-002 | `internal/composition` 显式聚合全部 Admin Binding；禁止自动扫描、`init` 注册、Service Locator、Module Federation 和运行时脚本插件。 |
| REQ-003 | Admin Binding 声明模块 ID、页面 Entry、Route、Navigation、i18n Locale、最低查看 operationID、默认路由和 available/preview 状态。 |
| REQ-004 | Auth 与 Ops 提供 Admin Binding；Todo 不提供 Admin Binding，且不得出现在 Admin manifest、registry、菜单或路由中。 |
| REQ-005 | 模块 React 页面和前端语言资源由模块自身拥有，放在 `internal/module/<name>/binding/admin/web`；页面不得导入宿主 Router、菜单、Session Store 或内部全局状态。 |
| REQ-006 | 生成器从 Composition 的同一 Admin Catalog 输出静态页面 registry、语言 registry 和稳定 revision；禁止手写第二份模块注册清单。 |
| REQ-007 | Admin Host 提供 `/api/v1/admin/manifest`，返回安全的路由/导航/访问状态和 revision，不返回源码路径或文件系统信息；revision 不匹配时 WebUI fail closed。 |
| REQ-008 | 页面与动作只引用已有 HTTP operationID；前端只控制可见性和交互，服务端 Auth policy/operation gate 保持最终授权 authority。 |
| REQ-009 | preview 页面必须明显标识、不得调用不存在的 API 或模拟写入成功，默认不进入生产 registry。 |
| REQ-010 | 新增独立 `webui/`，使用 React 19、Vite、TypeScript、HeroUI v3、Tailwind CSS 4、React Router、TanStack Query、React Hook Form、Zod 和 Lucide；不修改现有 Nuxt `frontend/`。 |
| REQ-011 | 宿主负责响应式布局、导航、路由承载、403/404/装配失败、通知、错误边界、唯一 i18n 实例、品牌和主题；不得硬编码具体业务模块。 |
| REQ-012 | Auth Admin 页面覆盖首次设置、登录和会话；Ops 页面使用现有 build/probe/diagnostics/metrics 能力展示真实运行状态，不使用模拟系统数据。 |
| REQ-013 | 浏览器认证使用服务端有状态 Session；Session ID 为 CSPRNG 生成的32字节随机值并采用 base64url，数据库只保存 SHA-256 摘要。 |
| REQ-014 | Session Cookie 固定为 `__Host-community_go_admin_session`，设置 `HttpOnly`、`Secure`、`SameSite=Lax`、`Path=/` 且不设置 `Domain`；本地开发也使用 HTTPS。 |
| REQ-015 | Auth local 首次设置要求高熵 `APP_AUTH__LOCAL__SETUPTOKEN`，原子创建唯一初始管理员；完成后关闭设置入口并忽略 Token。 |
| REQ-016 | 密码使用 Argon2id PHC，最低19 MiB、2次迭代、并行度1；最少15字符、最大至少64字符，允许 Unicode 和空格；连续5次失败锁定15分钟。 |
| REQ-017 | Session 默认空闲超时30分钟、绝对有效期12小时；登录/设置轮换，注销、密码重置和过期均撤销；提供离线 `admin reset-password` CLI。 |
| REQ-018 | Cookie 认证的不安全方法校验绑定 Session 的 `X-CSRF-Token` 与 `Origin`；密码、setup Token、Session ID 和 JWT 不进入 Web Storage、日志或错误详情。 |
| REQ-019 | 普通业务 API 继续只接受现有开发匿名或 Bearer JWT；WebUI Session 仅用于 Admin/Auth 和 management，management 允许 Bearer 或 Session 并继续执行 operation policy。 |
| REQ-020 | 默认品牌为 `Community Go Admin`；提供 system/light/dark、四个预设和可校验的本地主题编辑、导入导出，不把主题与认证状态混储。 |

## 非目标

- 不实现 Todo Admin 页面、MFA、多管理员管理、网页密码找回、指标历史存储或主题云同步。
- 不把 WebUI Session 扩展为普通业务 API 的通用凭据，不移除 JWT/JWKS。
- 不建立远程插件、页面 DSL、运行时模块下载或独立前端模块容器。
- 不嵌入 Go 二进制，不新增容器、部署、反向代理实现或外部发布。
- 不复用、恢复或复制 `old-backend/` 的历史后台代码。

## 验收标准

- Auth、Ops Binding 经 Composition 生成 registry/manifest，Todo 完全不接入；重复 ID/path、导航环、未知 operation、缺失 Entry/Locale 和多个默认路由构造失败。
- manifest 不泄露 `SourcePath`，静态 registry 与服务端 revision 一致；故意不一致时页面拒绝装配并给出明确诊断。
- 首次设置、登录、Session 查询、Ops 看板、注销形成真实闭环；无权菜单隐藏，直接访问呈现403，实际 API 仍由服务端拒绝未授权请求。
- Cookie 属性、Session 摘要存储、轮换/过期/撤销、CSRF、Origin、锁定、并发首次设置和密码重置均有后端测试。
- 带 Session Cookie 请求 Todo API 仍未认证；合法 Bearer JWT 行为保持回归；management 同时验证 Bearer 与 Session。
- 前端 lint、typecheck、unit、build、E2E 和桌面/移动视觉验收通过；Go 定向测试、全量质量门禁、生成物 clean check 和 `git diff --check` 通过。
- 文档只把真实落地内容标为已实现；未运行的外部 HTTPS/部署验证必须明确记录。
