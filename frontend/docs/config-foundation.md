# Global Configuration（全局配置架构）

本文是 `@clouddrive/config`（全局配置架构包）的唯一当前权威文档。

## 1. 定位与分层

- **Workspace**：`packages/config`
- **Package**：`@clouddrive/config`
- **分层**：Universal Frontend Foundation
- **核心原则**：
  - 核心导出（`.`）为**纯 TypeScript**，不依赖 `node:*`、浏览器专属 API、React 或具体 UI 库。
  - Node 专属能力（读取 `.env`、探测当前工程目录、回填 `process.env`）收口在 `./node` 子路径，仅允许在构建、CLI 工具链（`tooling/*`）、Next 配置文件（`next.config.ts`）与 Playwright 运行配置中消费。
  - 应用运行时及浏览器代码只能消费纯配置契约与经过构建期注入的常量，禁止直接导入 `@clouddrive/config/node`。

## 2. 配置字段与默认值

| 环境变量 / 字段                 | 默认值    | 校验与说明                                                                                                     |
| ------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `WEB_HOST`                      | `0.0.0.0` | 开发服务器监听地址。默认对局域网及容器环境开放；若需仅本机访问，可显式设置为 `127.0.0.1`。                     |
| `WEB_PORT`（或 `PORT`）         | `4173`    | 服务端口，范围 1–65535。`WEB_PORT` 优先于 `PORT`。                                                             |
| `WEB_DEPLOYMENT_MODE`           | `static`  | Host 部署模式：`static`（静态导出）、`static-enumerated`（静态枚举）或 `server`（Next SSR/API）。              |
| `NEXT_PUBLIC_AUTH_MODE`         | `mock`    | 认证模式：`mock`（内置演示账号）或 `backend`（真实后端鉴权）。生产环境缺省报错。                               |
| `NEXT_PUBLIC_AUTH_API_BASE_URL` | -         | `backend` 模式下后端 API 基础路径，必须为相对路径或合法的 HTTPS URL（本地开发允许 HTTP localhost/127.0.0.1）。 |
| `NEXT_DIST_DIR`                 | -         | Next 构建产物输出目录覆盖（用于隔离开发缓存与 Playwright 测试运行）。                                          |

## 3. Listen URL 与 Probe URL 契约

由于 `0.0.0.0` 与 `::` 是通配监听地址，客户端（浏览器、Playwright、fetch）无法直接将其作为连接目标。配置包提供纯派生工具：

- `getListenUrl(host, port)`：服务端绑定的监听地址（如 `http://0.0.0.0:4173`、`http://[::]:4173`）。
- `getProbeHost(host)`：将通配符转换为回环地址（`0.0.0.0` $\to$ `127.0.0.1`，`::` $\to$ `[::1]`）；非通配符则原样保留。
- `getProbeUrl(host, port)`：供 Playwright、客户端探针访问的可用 URL（如 `http://127.0.0.1:4173`）。

## 4. 文件加载与覆盖优先级

在 Node 运行时中调用 `loadConfig()` 时，遵循以下优先级：

1. **已存在的 `process.env`**（最高优先级，保证 CI 与命令行显式传入的变量不被覆盖）；
2. **`apps/web/.env`** 文件（Host 本地配置单一来源）；
3. **架构默认值**（如 `WEB_HOST=0.0.0.0`, `WEB_PORT=4173`, `WEB_DEPLOYMENT_MODE=static`）。

配置包提供 `populateProcessEnv(fileEnv)`，仅在 `process.env[key] === undefined` 时进行回填，保证整个开发与构建周期的环境变量一致性。
